import { randomBytes } from 'node:crypto';
import { Body, Controller, HttpCode, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RoleGuard } from '../auth/role.guard';
import { SessionGuard } from '../auth/session.guard';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationsService } from './invitations.service';

@Controller('invitations')
export class InvitationsController {
    constructor(private readonly invitationsService: InvitationsService) {}

    @Post()
    @UseGuards(SessionGuard, CsrfGuard, RoleGuard('admin'))
    async create(@Body() body: CreateInvitationDto, @CurrentUser() user: FastifyRequest['user']) {
        return this.invitationsService.create(user?.id ?? '', body.email, body.role);
    }

    @Post(':token/accept')
    @HttpCode(200)
    async accept(
        @Param('token') token: string,
        @Body() body: AcceptInvitationDto,
        @Res({ passthrough: true }) reply: FastifyReply,
    ) {
        const result = await this.invitationsService.accept(token, body.displayName, body.password);

        const cookieName = process.env.SESSION_COOKIE_NAME ?? 'crow_session';
        const csrfCookieName = process.env.CSRF_COOKIE_NAME ?? 'csrf_token';
        const isProduction = process.env.NODE_ENV === 'production';
        const maxAge = 60 * 60 * 24 * 7;

        reply.setCookie(cookieName, result.session.token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            path: '/',
            maxAge,
        });

        const csrfToken = randomBytes(32).toString('hex');
        reply.setCookie(csrfCookieName, csrfToken, {
            httpOnly: false,
            secure: isProduction,
            sameSite: 'lax',
            path: '/',
            maxAge,
        });

        return { user: result.user };
    }
}
