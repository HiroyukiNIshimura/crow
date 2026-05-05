import { createHash, randomBytes } from 'node:crypto';
import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../auth/prisma.service';
import { SessionStoreService } from '../auth/session-store.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class InvitationsService {
    private readonly logger = new Logger(InvitationsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly sessionStore: SessionStoreService,
        private readonly mail: MailService,
    ) {}

    async create(invitedById: string, email: string, role: 'admin' | 'member' = 'member') {
        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (existingUser) {
            throw new ConflictException('このメールアドレスはすでに登録されています。');
        }

        await this.prisma.userInvitation.deleteMany({
            where: { email: normalizedEmail, usedAt: null },
        });

        const inviter = await this.prisma.user.findUniqueOrThrow({
            where: { id: invitedById },
            select: { displayName: true },
        });

        const rawToken = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(rawToken).digest('hex');
        const expireHours = Number(process.env.INVITATION_EXPIRE_HOURS ?? 48);
        const expiresAt = new Date(Date.now() + expireHours * 60 * 60 * 1000);

        await this.prisma.userInvitation.create({
            data: { email: normalizedEmail, role, tokenHash, invitedById, expiresAt },
        });

        const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
        const acceptUrl = `${frontendOrigin}/accept-invitation?token=${rawToken}`;

        try {
            await this.mail.sendInvitation({
                to: normalizedEmail,
                invitedBy: inviter.displayName,
                acceptUrl,
                expiresInHours: expireHours,
            });
        } catch (error) {
            await this.prisma.userInvitation.delete({ where: { tokenHash } });
            throw error;
        }

        this.logger.log(`Invitation created for ${normalizedEmail} by user ${invitedById}`);

        return { message: '招待メールを送信しました。' };
    }

    async accept(rawToken: string, displayName: string, password: string) {
        const tokenHash = createHash('sha256').update(rawToken).digest('hex');

        const invitation = await this.prisma.userInvitation.findUnique({
            where: { tokenHash },
        });

        if (!invitation) {
            throw new NotFoundException('招待リンクが無効です。');
        }
        if (invitation.usedAt) {
            throw new BadRequestException('この招待リンクはすでに使用済みです。');
        }
        if (invitation.expiresAt < new Date()) {
            throw new BadRequestException('招待リンクの有効期限が切れています。');
        }

        const existingUser = await this.prisma.user.findUnique({
            where: { email: invitation.email },
        });
        if (existingUser) {
            throw new ConflictException('このメールアドレスはすでに登録されています。');
        }

        const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

        const [newUser] = await this.prisma.$transaction([
            this.prisma.user.create({
                data: {
                    email: invitation.email,
                    displayName: displayName.trim(),
                    role: invitation.role,
                    passwordHash,
                    provider: 'local',
                    isActive: true,
                },
            }),
            this.prisma.userInvitation.update({
                where: { tokenHash },
                data: { usedAt: new Date() },
            }),
        ]);

        const session = await this.sessionStore.create({ userId: newUser.id });

        this.logger.log(`Invitation accepted for ${invitation.email}`);

        return {
            user: {
                id: newUser.id,
                email: newUser.email,
                displayName: newUser.displayName,
                role: newUser.role,
            },
            session,
        };
    }
}
