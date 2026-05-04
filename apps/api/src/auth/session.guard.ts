import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { SessionStoreService } from './session-store.service';

/** Fastify リクエストへの `user` フィールドの型拡張 */
declare module 'fastify' {
    interface FastifyRequest {
        user?: {
            id: string;
            email: string;
            displayName: string;
            role: string;
        };
    }
}

/**
 * セッション Cookie を検証して request.user にユーザー情報をセットするガード。
 * 保護対象のエンドポイントに @UseGuards(SessionGuard) を付与する。
 */
@Injectable()
export class SessionGuard implements CanActivate {
    constructor(private readonly sessionStore: SessionStoreService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<FastifyRequest>();
        const cookieName = process.env.SESSION_COOKIE_NAME ?? 'crow_session';
        const token = request.cookies?.[cookieName];

        if (!token) {
            throw new UnauthorizedException('認証が必要です。');
        }

        const session = await this.sessionStore.get(token);

        if (!session) {
            throw new UnauthorizedException('セッションが無効または期限切れです。');
        }

        request.user = session.user;

        return true;
    }
}
