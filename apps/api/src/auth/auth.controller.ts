import { randomBytes } from 'node:crypto';
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    Post,
    Req,
    Res,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { CsrfGuard } from './csrf.guard';
import { CurrentUser } from './current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SessionGuard } from './session.guard';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('login')
    @HttpCode(200)
    async login(
        @Body() body: LoginDto,
        @Req() request: FastifyRequest,
        @Res({ passthrough: true }) reply: FastifyReply,
    ) {
        const userAgent = this.resolveUserAgent(request.headers['user-agent']);
        const result = await this.authService.login(body.email, body.password, {
            ipAddress: request.ip,
            userAgent,
        });

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

        // Double-Submit Cookie 用: 非 HttpOnly で JS から読み取り可能
        const csrfToken = randomBytes(32).toString('hex');
        reply.setCookie(csrfCookieName, csrfToken, {
            httpOnly: false,
            secure: isProduction,
            sameSite: 'lax',
            path: '/',
            maxAge,
        });

        return {
            user: result.user,
            message: 'ログインしました。',
        };
    }

    @Get('session')
    @UseGuards(SessionGuard)
    async getSession(@CurrentUser() user: FastifyRequest['user']) {
        return user;
    }

    @Post('logout')
    @HttpCode(200)
    @UseGuards(SessionGuard, CsrfGuard)
    async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
        const cookieName = process.env.SESSION_COOKIE_NAME ?? 'crow_session';
        const csrfCookieName = process.env.CSRF_COOKIE_NAME ?? 'csrf_token';
        const userAgent = this.resolveUserAgent(request.headers['user-agent']);

        await this.authService.logout(request.cookies[cookieName], {
            ipAddress: request.ip,
            userAgent,
        });

        reply.clearCookie(cookieName, { path: '/', httpOnly: true, sameSite: 'lax' });
        reply.clearCookie(csrfCookieName, { path: '/' });

        return { message: 'ログアウトしました。' };
    }

    /** 自分のアクティブなセッション一覧 */
    @Get('sessions')
    @UseGuards(SessionGuard)
    async listSessions(@CurrentUser() user: FastifyRequest['user']) {
        if (!user) {
            throw new UnauthorizedException();
        }

        return this.authService.listSessions(user.id);
    }

    /** 指定セッションを無効化（自分のセッションのみ） */
    @Delete('sessions/:id')
    @HttpCode(200)
    @UseGuards(SessionGuard, CsrfGuard)
    async revokeSession(
        @Param('id') sessionId: string,
        @Req() request: FastifyRequest,
        @CurrentUser() user: FastifyRequest['user'],
    ) {
        if (!user) {
            throw new UnauthorizedException();
        }

        const userAgent = this.resolveUserAgent(request.headers['user-agent']);
        await this.authService.revokeSessionById(sessionId, user.id, {
            ipAddress: request.ip,
            userAgent,
        });

        return { message: 'セッションを無効化しました。' };
    }

    private resolveUserAgent(value: string | string[] | undefined) {
        if (Array.isArray(value)) {
            return value.join(', ');
        }

        return value;
    }

    @Post('forgot-password')
    @HttpCode(200)
    async forgotPassword(@Body() body: ForgotPasswordDto, @Req() request: FastifyRequest) {
        const userAgent = this.resolveUserAgent(request.headers['user-agent']);
        await this.authService.requestPasswordReset(body.email, {
            ipAddress: request.ip,
            userAgent,
        });
        // ユーザー存在有無にかかわらず同一レスポンスを返す
        return {
            message: 'メールアドレスが登録されている場合、パスワード再設定のメールを送信しました。',
        };
    }

    @Post('reset-password')
    @HttpCode(200)
    async resetPassword(@Body() body: ResetPasswordDto, @Req() request: FastifyRequest) {
        const userAgent = this.resolveUserAgent(request.headers['user-agent']);
        await this.authService.resetPassword(body.token, body.newPassword, {
            ipAddress: request.ip,
            userAgent,
        });
        return { message: 'パスワードを変更しました。新しいパスワードでログインしてください。' };
    }

    @Post('change-password')
    @HttpCode(200)
    @UseGuards(SessionGuard, CsrfGuard)
    async changePassword(
        @Body() body: ChangePasswordDto,
        @Req() request: FastifyRequest,
        @CurrentUser() user: FastifyRequest['user'],
    ) {
        if (!user) {
            throw new UnauthorizedException();
        }

        const cookieName = process.env.SESSION_COOKIE_NAME ?? 'crow_session';
        const sessionToken = request.cookies[cookieName];

        if (!sessionToken) {
            throw new UnauthorizedException();
        }

        const userAgent = this.resolveUserAgent(request.headers['user-agent']);
        await this.authService.changePassword(
            user.id,
            body.currentPassword,
            body.newPassword,
            sessionToken,
            { ipAddress: request.ip, userAgent },
        );

        return { message: 'パスワードを変更しました。' };
    }
}
