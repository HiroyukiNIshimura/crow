import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { WorkLogsModule } from './work-logs/work-logs.module';

@Module({
    imports: [AuthModule, WorkLogsModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
