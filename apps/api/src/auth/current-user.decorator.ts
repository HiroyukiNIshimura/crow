import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

/**
 * SessionGuard によってセットされた request.user を取り出すパラメータデコレーター。
 *
 * @example
 * @Get('me')
 * @UseGuards(SessionGuard)
 * getMe(@CurrentUser() user: FastifyRequest['user']) { ... }
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    return request.user;
});
