import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    Patch,
    Post,
    Query,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { CreateWorkLogDto } from './dto/create-work-log.dto';
import { DayQueryDto } from './dto/day-query.dto';
import { MonthQueryDto } from './dto/month-query.dto';
import { UpdateWorkLogDto } from './dto/update-work-log.dto';
import { WorkLogsService } from './work-logs.service';

@Controller('work-logs')
@UseGuards(SessionGuard)
export class WorkLogsController {
    constructor(private readonly workLogsService: WorkLogsService) {}

    @Get('month')
    async getMonth(@CurrentUser() user: FastifyRequest['user'], @Query() query: MonthQueryDto) {
        if (!user) {
            throw new UnauthorizedException('認証が必要です。');
        }

        return this.workLogsService.getMonth(user.id, query.year, query.month);
    }

    @Get('day')
    async getDay(@CurrentUser() user: FastifyRequest['user'], @Query() query: DayQueryDto) {
        if (!user) {
            throw new UnauthorizedException('認証が必要です。');
        }

        return this.workLogsService.getDay(user.id, query.date);
    }

    @Post()
    @UseGuards(CsrfGuard)
    @HttpCode(201)
    async create(@CurrentUser() user: FastifyRequest['user'], @Body() body: CreateWorkLogDto) {
        if (!user) {
            throw new UnauthorizedException('認証が必要です。');
        }

        return this.workLogsService.create(user.id, body);
    }

    @Patch(':id')
    @UseGuards(CsrfGuard)
    async update(
        @CurrentUser() user: FastifyRequest['user'],
        @Param('id') id: string,
        @Body() body: UpdateWorkLogDto,
    ) {
        if (!user) {
            throw new UnauthorizedException('認証が必要です。');
        }

        return this.workLogsService.update(user.id, id, body);
    }

    @Delete(':id')
    @UseGuards(CsrfGuard)
    @HttpCode(200)
    async remove(@CurrentUser() user: FastifyRequest['user'], @Param('id') id: string) {
        if (!user) {
            throw new UnauthorizedException('認証が必要です。');
        }

        await this.workLogsService.remove(user.id, id);

        return { message: '作業ログを削除しました。' };
    }
}
