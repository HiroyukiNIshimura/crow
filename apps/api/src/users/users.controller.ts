import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CsrfGuard } from '../auth/csrf.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RoleGuard } from '../auth/role.guard';
import { SessionGuard } from '../auth/session.guard';
import { UpdateUserActiveDto } from './dto/update-user-active.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(SessionGuard, RoleGuard('admin'))
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get()
    async list() {
        return this.usersService.list();
    }

    @Patch(':id/active')
    @UseGuards(CsrfGuard)
    async updateActive(
        @Param('id') id: string,
        @Body() body: UpdateUserActiveDto,
        @CurrentUser() user: FastifyRequest['user'],
    ) {
        if (!user) {
            throw new UnauthorizedException('認証が必要です。');
        }

        return this.usersService.updateActive(id, body.isActive, user.id);
    }
}
