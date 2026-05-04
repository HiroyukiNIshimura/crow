import {
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
    type OnModuleInit,
    UnauthorizedException,
} from '@nestjs/common';
import type { Prisma } from '@crow/database';
import * as argon2 from 'argon2';
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
    ) {}

    async onModuleInit() {
        await this.ensureDemoUser();
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

    async ensureDemoUser() {
        const demoEmail = (process.env.DEMO_USER_EMAIL ?? 'admin@example.com').trim().toLowerCase();
        const demoPassword = process.env.DEMO_USER_PASSWORD ?? 'password123!';
        const demoDisplayName = process.env.DEMO_USER_NAME ?? 'Crow Admin';

        const passwordHash = await argon2.hash(demoPassword, {
            type: argon2.argon2id,
        });

        await this.prisma.user.upsert({
            where: { email: demoEmail },
            create: {
                email: demoEmail,
                displayName: demoDisplayName,
                role: 'admin',
                passwordHash,
                provider: 'local',
                isActive: true,
            },
            update: {
                displayName: demoDisplayName,
                role: 'admin',
                passwordHash,
                provider: 'local',
                isActive: true,
            },
        });
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
