import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../auth/prisma.service';
import { SessionStoreService } from '../auth/session-store.service';

@Injectable()
export class UsersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly sessionStore: SessionStoreService,
    ) {}

    async list() {
        return this.prisma.user.findMany({
            orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }

    async updateActive(targetUserId: string, isActive: boolean, actorUserId: string) {
        if (targetUserId === actorUserId && !isActive) {
            throw new BadRequestException('自分自身を無効化することはできません。');
        }

        const existingUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            select: {
                id: true,
                isActive: true,
                email: true,
            },
        });

        if (!existingUser) {
            throw new NotFoundException('対象ユーザーが見つかりません。');
        }

        if (existingUser.isActive === isActive) {
            return this.prisma.user.findUniqueOrThrow({
                where: { id: targetUserId },
                select: {
                    id: true,
                    email: true,
                    displayName: true,
                    role: true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
        }

        const updatedUser = await this.prisma.user.update({
            where: { id: targetUserId },
            data: { isActive },
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        let revokedSessionCount = 0;
        if (!isActive) {
            revokedSessionCount = await this.sessionStore.revokeAllByUser(targetUserId);
        }

        await this.prisma.authAuditLog.create({
            data: {
                userId: targetUserId,
                eventType: isActive ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
                emailOrIdentifier: existingUser.email,
                metadata: {
                    actorUserId,
                    revokedSessionCount,
                },
            },
        });

        return updatedUser;
    }
}