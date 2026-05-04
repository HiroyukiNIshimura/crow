import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from './prisma.service';
import { SessionStoreService } from './session-store.service';

@Module({
    controllers: [AuthController],
    providers: [AuthService, SessionStoreService, PrismaService],
})
export class AuthModule {}
