import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-Submit Cookie パターンによる CSRF 対策ガード。
 *
 * ログイン時に非 HttpOnly の csrf_token Cookie がセットされる。
 * 状態変更リクエスト (POST/PUT/PATCH/DELETE) では、クライアントが
 * その値を X-CSRF-Token ヘッダーに付与する必要がある。
 *
 * - GET/HEAD/OPTIONS はスキップ（副作用なし）
 * - SameSite=Lax と組み合わせて多層防御を実現
 */
@Injectable()
export class CsrfGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<FastifyRequest>();

        if (SAFE_METHODS.has(request.method)) {
            return true;
        }

        const cookieName = process.env.CSRF_COOKIE_NAME ?? 'csrf_token';
        const cookieValue = request.cookies?.[cookieName];
        const headerValue = request.headers['x-csrf-token'];

        if (!cookieValue || !headerValue || cookieValue !== headerValue) {
            throw new ForbiddenException('CSRFトークンが無効です。');
        }

        return true;
    }
}
