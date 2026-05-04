import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter({ logger: true }),
    );

    const cookieSecret = process.env.SESSION_SECRET ?? 'replace-with-a-long-random-secret';
    const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
    const port = Number(process.env.API_PORT ?? 3001);
    const isProduction = process.env.NODE_ENV === 'production';
    const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? (isProduction ? 120 : 1000));
    const rateLimitWindow = process.env.RATE_LIMIT_WINDOW ?? '1 minute';

    await app.register(cookie, { secret: cookieSecret });
    await app.register(cors, {
        origin: frontendOrigin,
        credentials: true,
    });
    await app.register(rateLimit, {
        max: rateLimitMax,
        timeWindow: rateLimitWindow,
        // 開発時は localhost からの操作をレート制限対象外にして、
        // Server Action 経由の複数リクエストで 429 が出ないようにする。
        ...(isProduction
            ? {}
            : {
                  allowList: ['127.0.0.1', '::1', 'localhost'],
              }),
    });

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
        }),
    );

    await app.listen(port, '0.0.0.0');
}

void bootstrap();
