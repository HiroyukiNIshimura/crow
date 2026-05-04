import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@crow/database';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
    constructor() {
        const connectionString =
            process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/crow';

        const adapter = new PrismaPg({
            connectionString,
        });

        super({
            adapter,
        });
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
