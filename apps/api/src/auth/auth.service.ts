import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '@crow/database';
import {
    BadRequestException,
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
    NotFoundException,
    type OnModuleInit,
    UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { MailService } from '../mail/mail.service';
import { PrismaService } from './prisma.service';
import { SessionStoreService } from './session-store.service';

type SafeUser = {
    id: string;
    email: string;
    displayName: string;
    role: 'admin' | 'member';
};

type RequestMetadata = {
    ipAddress?: string;
    userAgent?: string;
};

@Injectable()
export class AuthService implements OnModuleInit {
    private readonly logger = new Logger(AuthService.name);
    private readonly loginAttemptWindowMs =
        Number(process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS ?? 60) * 1000;
    private readonly loginAttemptMax = Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 5);
    private readonly loginAttempts = new Map<string, { count: number; firstAttemptAt: number }>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly sessionStore: SessionStoreService,
        private readonly mail: MailService,
    ) {}

    async onModuleInit() {
        if (!this.isAdminUserProvisioningEnabled()) {
            return;
        }

        await this.ensureAdminUser();
    }

    async login(email: string, password: string, metadata: RequestMetadata) {
        const normalizedEmail = email.trim().toLowerCase();
        this.assertLoginAttemptAllowed(normalizedEmail);

        const user = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        if (!user?.isActive || !user.passwordHash) {
            this.registerFailedAttempt(normalizedEmail);
            await this.createAuditLog({
                eventType: 'LOGIN_FAILED',
                userId: user?.id,
                emailOrIdentifier: normalizedEmail,
                ipAddress: metadata.ipAddress,
                userAgent: metadata.userAgent,
                metadata: {
                    reason: user ? 'password_not_set_or_inactive' : 'user_not_found',
                },
            });
            throw new UnauthorizedException('メールアドレスまたはパスワードが正しくありません。');
        }

        const verified = await argon2.verify(user.passwordHash, password);

        if (!verified) {
            this.registerFailedAttempt(normalizedEmail);
            await this.createAuditLog({
                eventType: 'LOGIN_FAILED',
                userId: user.id,
                emailOrIdentifier: normalizedEmail,
                ipAddress: metadata.ipAddress,
                userAgent: metadata.userAgent,
                metadata: {
                    reason: 'invalid_password',
                },
            });
            throw new UnauthorizedException('メールアドレスまたはパスワードが正しくありません。');
        }

        this.loginAttempts.delete(normalizedEmail);

        const session = await this.sessionStore.create({
            userId: user.id,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
        });

        await this.createAuditLog({
            eventType: 'LOGIN_SUCCESS',
            userId: user.id,
            emailOrIdentifier: user.email,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            metadata: {
                role: user.role,
            },
        });

        this.logger.log(`Login succeeded for ${user.email}`);

        return {
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
            } satisfies SafeUser,
            session,
        };
    }

    async getSession(token?: string | null) {
        if (!token) {
            return null;
        }

        return this.sessionStore.get(token);
    }

    async logout(token?: string | null, metadata?: RequestMetadata) {
        if (!token) {
            return;
        }

        const session = await this.sessionStore.get(token);

        await this.sessionStore.revoke(token);

        await this.createAuditLog({
            eventType: 'LOGOUT',
            userId: session?.user.id,
            emailOrIdentifier: session?.user.email,
            ipAddress: metadata?.ipAddress,
            userAgent: metadata?.userAgent,
            metadata: {
                reason: 'manual_logout',
            },
        });
    }

    /** 指定ユーザーのアクティブなセッション一覧を返す */
    async listSessions(userId: string) {
        return this.sessionStore.listByUser(userId);
    }

    /**
     * 指定 ID のセッションを無効化する。
     * userId 照合は SessionStoreService 側で行う。
     */
    async revokeSessionById(sessionId: string, userId: string, metadata?: RequestMetadata) {
        await this.sessionStore.revokeById(sessionId, userId);

        await this.createAuditLog({
            eventType: 'SESSION_REVOKED',
            userId,
            ipAddress: metadata?.ipAddress,
            userAgent: metadata?.userAgent,
            metadata: { sessionId },
        });
    }

    async requestPasswordReset(email: string, metadata?: RequestMetadata) {
        const normalizedEmail = email.trim().toLowerCase();

        const user = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        // タイミング攻撃防止: ユーザーが存在しない場合も同一レスポンスを返す
        if (!user?.isActive) {
            this.logger.log(
                `Password reset requested for unknown/inactive email: ${normalizedEmail}`,
            );
            return;
        }

        // 既存の未使用トークンを削除
        await this.prisma.passwordResetToken.deleteMany({
            where: { userId: user.id, usedAt: null },
        });

        const rawToken = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(rawToken).digest('hex');
        const expireMinutes = Number(process.env.PASSWORD_RESET_EXPIRE_MINUTES ?? 30);
        const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000);

        await this.prisma.passwordResetToken.create({
            data: { userId: user.id, tokenHash, expiresAt },
        });

        const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
        const resetUrl = `${frontendOrigin}/reset-password?token=${rawToken}`;

        await this.mail.sendPasswordReset({
            to: normalizedEmail,
            resetUrl,
            expiresInMinutes: expireMinutes,
        });

        await this.createAuditLog({
            eventType: 'PASSWORD_RESET_REQUESTED',
            userId: user.id,
            emailOrIdentifier: normalizedEmail,
            ipAddress: metadata?.ipAddress,
            userAgent: metadata?.userAgent,
        });

        this.logger.log(`Password reset requested for ${normalizedEmail}`);
    }

    async resetPassword(rawToken: string, newPassword: string, metadata?: RequestMetadata) {
        const tokenHash = createHash('sha256').update(rawToken).digest('hex');

        const record = await this.prisma.passwordResetToken.findUnique({
            where: { tokenHash },
            include: { user: true },
        });

        if (!record) {
            throw new NotFoundException('リセットリンクが無効です。');
        }

        if (record.usedAt) {
            throw new BadRequestException('このリンクはすでに使用済みです。');
        }

        if (record.expiresAt < new Date()) {
            throw new BadRequestException(
                'リセットリンクの有効期限が切れています。再度パスワード再設定をお試しください。',
            );
        }

        if (!record.user.isActive) {
            throw new BadRequestException('アカウントが無効です。管理者にお問い合わせください。');
        }

        const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });

        await this.prisma.$transaction(async (tx) => {
            // パスワード更新
            await tx.user.update({
                where: { id: record.userId },
                data: { passwordHash },
            });

            // トークンを使用済みにする
            await tx.passwordResetToken.update({
                where: { tokenHash },
                data: { usedAt: new Date() },
            });

            // 既存セッションをすべて失効
            await tx.session.updateMany({
                where: { userId: record.userId, revokedAt: null },
                data: { revokedAt: new Date() },
            });
        });

        await this.createAuditLog({
            eventType: 'PASSWORD_RESET_COMPLETED',
            userId: record.userId,
            emailOrIdentifier: record.user.email,
            ipAddress: metadata?.ipAddress,
            userAgent: metadata?.userAgent,
        });

        this.logger.log(`Password reset completed for ${record.user.email}`);
    }

    async changePassword(
        userId: string,
        currentPassword: string,
        newPassword: string,
        currentSessionToken: string,
        metadata?: RequestMetadata,
    ) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });

        if (!user?.passwordHash) {
            throw new UnauthorizedException('パスワードが設定されていません。');
        }

        const verified = await argon2.verify(user.passwordHash, currentPassword);
        if (!verified) {
            throw new UnauthorizedException('現在のパスワードが正しくありません。');
        }

        const isSame = await argon2.verify(user.passwordHash, newPassword);
        if (isSame) {
            throw new BadRequestException(
                '新しいパスワードは現在のパスワードと異なる値にしてください。',
            );
        }

        const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });

        const currentTokenHash = createHash('sha256').update(currentSessionToken).digest('hex');
        const currentSession = await this.prisma.session.findUnique({
            where: { sessionTokenHash: currentTokenHash },
            select: { id: true },
        });

        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: { passwordHash },
            });

            await tx.session.updateMany({
                where: {
                    userId,
                    revokedAt: null,
                    ...(currentSession ? { id: { not: currentSession.id } } : {}),
                },
                data: { revokedAt: new Date() },
            });
        });

        await this.createAuditLog({
            eventType: 'PASSWORD_CHANGED',
            userId,
            emailOrIdentifier: user.email,
            ipAddress: metadata?.ipAddress,
            userAgent: metadata?.userAgent,
        });

        this.logger.log(`Password changed for ${user.email}`);
    }

    async ensureAdminUser() {
        const email = (process.env.ADMIN_USER_EMAIL ?? 'admin@example.com').trim().toLowerCase();
        const password = process.env.ADMIN_USER_PASSWORD ?? 'password123!';
        const displayName = process.env.ADMIN_USER_NAME ?? 'Crow Admin';

        const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

        await this.prisma.user.upsert({
            where: { email },
            create: {
                email,
                displayName,
                role: 'admin',
                passwordHash,
                provider: 'local',
                isActive: true,
            },
            update: { displayName, role: 'admin', passwordHash, provider: 'local', isActive: true },
        });
    }

    private isAdminUserProvisioningEnabled() {
        const flag = process.env.ADMIN_USER_ENABLED;

        if (flag === 'false') {
            return false;
        }

        return flag === 'true';
    }

    private assertLoginAttemptAllowed(email: string) {
        const current = this.loginAttempts.get(email);

        if (!current) {
            return;
        }

        const now = Date.now();

        if (now - current.firstAttemptAt > this.loginAttemptWindowMs) {
            this.loginAttempts.delete(email);
            return;
        }

        if (current.count >= this.loginAttemptMax) {
            throw new HttpException(
                'ログイン試行が多すぎます。少し時間をおいて再度お試しください。',
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }
    }

    private registerFailedAttempt(email: string) {
        const now = Date.now();
        const current = this.loginAttempts.get(email);

        if (!current || now - current.firstAttemptAt > this.loginAttemptWindowMs) {
            this.loginAttempts.set(email, {
                count: 1,
                firstAttemptAt: now,
            });
            return;
        }

        current.count += 1;
        this.loginAttempts.set(email, current);
    }

    private async createAuditLog(input: {
        userId?: string;
        eventType: string;
        emailOrIdentifier?: string;
        ipAddress?: string;
        userAgent?: string;
        metadata?: Prisma.InputJsonValue;
    }) {
        await this.prisma.authAuditLog.create({
            data: {
                userId: input.userId,
                eventType: input.eventType,
                emailOrIdentifier: input.emailOrIdentifier,
                ipAddress: input.ipAddress,
                userAgent: input.userAgent,
                metadata: input.metadata,
            },
        });
    }
}
