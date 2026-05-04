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

    await app.register(cookie, { secret: cookieSecret });
    await app.register(cors, {
        origin: frontendOrigin,
        credentials: true,
    });
    await app.register(rateLimit, {
        max: 20,
        timeWindow: '1 minute',
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
