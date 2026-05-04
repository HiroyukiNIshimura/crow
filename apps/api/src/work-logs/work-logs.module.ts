import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../auth/prisma.service';
import { WorkLogsController } from './work-logs.controller';
import { WorkLogsService } from './work-logs.service';

@Module({
    imports: [AuthModule],
    controllers: [WorkLogsController],
    providers: [WorkLogsService, PrismaService],
})
export class WorkLogsModule {}
