import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    NotFoundException,
    Param,
    ParseIntPipe,
    Put,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { UpsertWorkStandardDto } from './dto/upsert-work-standard.dto';
import { WorkStandardsService } from './work-standards.service';

@Controller('work-standards')
@UseGuards(SessionGuard)
export class WorkStandardsController {
    constructor(private readonly workStandardsService: WorkStandardsService) {}

    @Get(':year/:month')
    async get(
        @CurrentUser() user: FastifyRequest['user'],
        @Param('year', ParseIntPipe) year: number,
        @Param('month', ParseIntPipe) month: number,
    ) {
        if (!user) {
            throw new UnauthorizedException('認証が必要です。');
        }

        const standard = await this.workStandardsService.get(user.id, year, month);
        return standard ?? null;
    }

    @Put()
    @UseGuards(CsrfGuard)
    @HttpCode(200)
    async upsert(@CurrentUser() user: FastifyRequest['user'], @Body() body: UpsertWorkStandardDto) {
        if (!user) {
            throw new UnauthorizedException('認証が必要です。');
        }

        return this.workStandardsService.upsert(user.id, body);
    }

    @Delete(':year/:month')
    @UseGuards(CsrfGuard)
    @HttpCode(204)
    async delete(
        @CurrentUser() user: FastifyRequest['user'],
        @Param('year', ParseIntPipe) year: number,
        @Param('month', ParseIntPipe) month: number,
    ) {
        if (!user) {
            throw new UnauthorizedException('認証が必要です。');
        }

        const existing = await this.workStandardsService.get(user.id, year, month);
        if (!existing) {
            throw new NotFoundException('稼働基準時間が設定されていません。');
        }

        await this.workStandardsService.delete(user.id, year, month);
    }
}
