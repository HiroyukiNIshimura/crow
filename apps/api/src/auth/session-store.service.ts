import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from './prisma.service';

type SessionInput = {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
};

type SessionRecord = {
    token: string;
    userId: string;
    expiresAt: Date;
    lastSeenAt: Date;
};

@Injectable()
export class SessionStoreService {
    private readonly sessionTtlMs =
        Number(process.env.SESSION_MAX_AGE_SECONDS ?? 60 * 60 * 24) * 1000;
    private readonly idleTimeoutMs =
        Number(process.env.SESSION_IDLE_TIMEOUT_SECONDS ?? 60 * 30) * 1000;

    constructor(private readonly prisma: PrismaService) {}

    async create(input: SessionInput): Promise<SessionRecord> {
        const token = randomBytes(32).toString('hex');
        const sessionTokenHash = this.hashToken(token);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.sessionTtlMs);

        await this.prisma.session.create({
            data: {
                userId: input.userId,
                sessionTokenHash,
                expiresAt,
                lastSeenAt: now,
                ipAddress: input.ipAddress,
                userAgent: input.userAgent,
            },
        });

        return {
            token,
            userId: input.userId,
            expiresAt,
            lastSeenAt: now,
        };
    }

    async get(token: string) {
        const sessionTokenHash = this.hashToken(token);
        const session = await this.prisma.session.findUnique({
            where: { sessionTokenHash },
            include: {
                user: true,
            },
        });

        if (!session) {
            return null;
        }

        if (!session.user.isActive) {
            const now = new Date();

            await this.prisma.session.updateMany({
                where: {
                    userId: session.userId,
                    revokedAt: null,
                },
                data: { revokedAt: now },
            });

            return null;
        }

        if (session.revokedAt) {
            return null;
        }

        const now = new Date();

        if (session.expiresAt.getTime() <= now.getTime()) {
            await this.prisma.session.update({
                where: { id: session.id },
                data: { revokedAt: now },
            });
            return null;
        }

        if (session.lastSeenAt.getTime() + this.idleTimeoutMs <= now.getTime()) {
            await this.prisma.session.update({
                where: { id: session.id },
                data: { revokedAt: now },
            });
            return null;
        }

        await this.prisma.session.update({
            where: { id: session.id },
            data: { lastSeenAt: now },
        });

        return {
            user: {
                id: session.user.id,
                email: session.user.email,
                displayName: session.user.displayName,
                role: session.user.role,
            },
            expiresAt: session.expiresAt,
            lastSeenAt: now,
        };
    }

    async revoke(token: string) {
        const sessionTokenHash = this.hashToken(token);

        await this.prisma.session.updateMany({
            where: {
                sessionTokenHash,
                revokedAt: null,
            },
            data: {
                revokedAt: new Date(),
            },
        });
    }

    /** 指定ユーザーのアクティブなセッション一覧を返す（トークンハッシュは含まない） */
    async listByUser(userId: string) {
        const now = new Date();

        return this.prisma.session.findMany({
            where: {
                userId,
                revokedAt: null,
                expiresAt: { gt: now },
            },
            orderBy: { lastSeenAt: 'desc' },
            select: {
                id: true,
                createdAt: true,
                lastSeenAt: true,
                expiresAt: true,
                ipAddress: true,
                userAgent: true,
            },
        });
    }

    /**
     * 指定 ID のセッションを無効化する。
     * userId を照合して自分のセッション以外は無効化できない。
     */
    async revokeById(id: string, userId: string) {
        await this.prisma.session.updateMany({
            where: {
                id,
                userId,
                revokedAt: null,
            },
            data: {
                revokedAt: new Date(),
            },
        });
    }

    /** 指定ユーザーのアクティブなセッションをすべて無効化する */
    async revokeAllByUser(userId: string) {
        const result = await this.prisma.session.updateMany({
            where: {
                userId,
                revokedAt: null,
            },
            data: {
                revokedAt: new Date(),
            },
        });

        return result.count;
    }

    private hashToken(token: string) {
        return createHash('sha256').update(token).digest('hex');
    }
}
