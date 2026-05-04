import {
    Body,
    Controller,
    Get,
    HttpCode,
    Post,
    Req,
    Res,
    UnauthorizedException,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';

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
        const result = await this.authService.login(body.email, body.password, {
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
        });

        const cookieName = process.env.SESSION_COOKIE_NAME ?? 'crow_session';
        const isProduction = process.env.NODE_ENV === 'production';

        reply.setCookie(cookieName, result.session.token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7,
        });

        return {
            user: result.user,
            message: 'ログインしました。',
            mode: 'development-stub',
        };
    }

    @Get('session')
    async getSession(@Req() request: FastifyRequest) {
        const cookieName = process.env.SESSION_COOKIE_NAME ?? 'crow_session';
        const session = this.authService.getSession(request.cookies[cookieName]);

        if (!session) {
            throw new UnauthorizedException('有効なセッションがありません。');
        }

        return session;
    }

    @Post('logout')
    @HttpCode(200)
    async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
        const cookieName = process.env.SESSION_COOKIE_NAME ?? 'crow_session';
        this.authService.logout(request.cookies[cookieName]);

        reply.clearCookie(cookieName, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
        });

        return { message: 'ログアウトしました。' };
    }
}
