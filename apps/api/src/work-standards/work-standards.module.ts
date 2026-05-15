import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../auth/prisma.service';
import { WorkStandardsController } from './work-standards.controller';
import { WorkStandardsService } from './work-standards.service';

@Module({
    imports: [AuthModule],
    controllers: [WorkStandardsController],
    providers: [WorkStandardsService, PrismaService],
})
export class WorkStandardsModule {}
