import { Injectable, Logger, type OnModuleInit, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { SessionStoreService } from './session-store.service';

type SafeUser = {
    id: string;
    email: string;
    displayName: string;
    role: 'admin' | 'member';
};

@Injectable()
export class AuthService implements OnModuleInit {
    private readonly logger = new Logger(AuthService.name);
    private passwordHash = '';
    private readonly demoUser: SafeUser = {
        id: 'seed-admin',
        email: process.env.DEMO_USER_EMAIL ?? 'admin@example.com',
        displayName: 'Crow Admin',
        role: 'admin',
    };

    constructor(private readonly sessionStore: SessionStoreService) {}

    async onModuleInit() {
        const seedPassword = process.env.DEMO_USER_PASSWORD ?? 'password123!';
        this.passwordHash = await argon2.hash(seedPassword, {
            type: argon2.argon2id,
        });
    }

    async login(
        email: string,
        password: string,
        metadata: { ipAddress?: string; userAgent?: string },
    ) {
        if (email !== this.demoUser.email) {
            this.logger.warn(`Failed login for unknown email: ${email}`);
            throw new UnauthorizedException('メールアドレスまたはパスワードが正しくありません。');
        }

        const verified = await argon2.verify(this.passwordHash, password);

        if (!verified) {
            this.logger.warn(`Failed login for email: ${email}`);
            throw new UnauthorizedException('メールアドレスまたはパスワードが正しくありません。');
        }

        const session = this.sessionStore.create({
            userId: this.demoUser.id,
            email: this.demoUser.email,
            displayName: this.demoUser.displayName,
            role: this.demoUser.role,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
        });

        this.logger.log(`Login succeeded for ${email}`);

        return {
            user: this.demoUser,
            session,
        };
    }

    getSession(token?: string | null) {
        if (!token) {
            return null;
        }

        const session = this.sessionStore.get(token);

        if (!session) {
            return null;
        }

        return {
            user: {
                id: session.userId,
                email: session.email,
                displayName: session.displayName,
                role: session.role,
            },
            expiresAt: session.expiresAt,
            lastSeenAt: session.lastSeenAt,
        };
    }

    logout(token?: string | null) {
        if (token) {
            this.sessionStore.revoke(token);
        }
    }
}
