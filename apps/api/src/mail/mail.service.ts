import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

type InvitationMailOptions = {
    to: string;
    invitedBy: string;
    acceptUrl: string;
    expiresInHours: number;
};

type PasswordResetMailOptions = {
    to: string;
    resetUrl: string;
    expiresInMinutes: number;
};

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    constructor(private readonly mailer: MailerService) {}

    async sendInvitation(options: InvitationMailOptions): Promise<void> {
        await this.mailer.sendMail({
            to: options.to,
            subject: `${options.invitedBy} さんから Crow への招待が届いています`,
            template: 'invitation',
            context: {
                invitedBy: options.invitedBy,
                acceptUrl: options.acceptUrl,
                expiresInHours: options.expiresInHours,
            },
        });

        this.logger.log(`Invitation mail sent to ${options.to}`);
    }

    async sendPasswordReset(options: PasswordResetMailOptions): Promise<void> {
        await this.mailer.sendMail({
            to: options.to,
            subject: 'Crow パスワード再設定のご案内',
            template: 'password-reset',
            context: {
                resetUrl: options.resetUrl,
                expiresInMinutes: options.expiresInMinutes,
            },
        });

        this.logger.log(`Password reset mail sent to ${options.to}`);
    }
}
