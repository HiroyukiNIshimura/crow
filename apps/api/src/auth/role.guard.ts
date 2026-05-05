import { type CanActivate, type ExecutionContext, ForbiddenException, mixin } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

export function RoleGuard(requiredRole: 'admin' | 'member') {
    class Guard implements CanActivate {
        canActivate(context: ExecutionContext): boolean {
            const request = context.switchToHttp().getRequest<FastifyRequest>();
            const user = request.user;

            if (!user || user.role !== requiredRole) {
                throw new ForbiddenException('この操作には管理者権限が必要です。');
            }

            return true;
        }
    }

    return mixin(Guard);
}
