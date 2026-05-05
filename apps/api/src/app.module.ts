import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { InvitationsModule } from './invitations/invitations.module';
import { MailModule } from './mail/mail.module';
import { WorkLogsModule } from './work-logs/work-logs.module';

@Module({
    imports: [AuthModule, InvitationsModule, MailModule, WorkLogsModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
