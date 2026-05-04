import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../auth/prisma.service';
import { CreateWorkLogDto } from './dto/create-work-log.dto';
import { UpdateWorkLogDto } from './dto/update-work-log.dto';

type MonthSummary = {
    recordedDays: number;
    totalDurationMinutes: number;
    memoDays: number;
    totalLogs: number;
};

@Injectable()
export class WorkLogsService {
    constructor(private readonly prisma: PrismaService) {}

    async getMonth(userId: string, year: number, month: number) {
        const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

        const logs = await this.prisma.workLog.findMany({
            where: {
                userId,
                workDate: {
                    gte: start,
                    lt: end,
                },
            },
            select: {
                id: true,
                workDate: true,
                note: true,
                durationMinutes: true,
            },
            orderBy: {
                workDate: 'asc',
            },
        });

        const byDate = new Map<
            string,
            {
                logCount: number;
                totalDurationMinutes: number;
                hasMemo: boolean;
            }
        >();

        for (const log of logs) {
            const date = log.workDate.toISOString().slice(0, 10);
            const prev = byDate.get(date) ?? {
                logCount: 0,
                totalDurationMinutes: 0,
                hasMemo: false,
            };

            prev.logCount += 1;
            prev.totalDurationMinutes += log.durationMinutes ?? 0;
            prev.hasMemo ||= Boolean(log.note?.trim());

            byDate.set(date, prev);
        }

        const summary: MonthSummary = {
            recordedDays: byDate.size,
            totalDurationMinutes: 0,
            memoDays: 0,
            totalLogs: logs.length,
        };

        const days = Array.from(byDate.entries()).map(([date, data]) => {
            summary.totalDurationMinutes += data.totalDurationMinutes;
            if (data.hasMemo) {
                summary.memoDays += 1;
            }

            return {
                date,
                logCount: data.logCount,
                totalDurationMinutes: data.totalDurationMinutes,
                hasMemo: data.hasMemo,
            };
        });

        return {
            month: `${year}-${String(month).padStart(2, '0')}`,
            summary,
            days,
        };
    }

    async getDay(userId: string, dateText: string) {
        const [year, month, day] = dateText.split('-').map(Number);
        const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));

        const logs = await this.prisma.workLog.findMany({
            where: {
                userId,
                workDate: {
                    gte: start,
                    lt: end,
                },
            },
            select: {
                id: true,
                title: true,
                note: true,
                durationMinutes: true,
                createdAt: true,
                updatedAt: true,
                workDate: true,
            },
            orderBy: [{ workDate: 'asc' }, { createdAt: 'asc' }],
        });

        const totalDurationMinutes = logs.reduce((acc, log) => acc + (log.durationMinutes ?? 0), 0);

        return {
            date: dateText,
            totalDurationMinutes,
            logs,
        };
    }

    async create(userId: string, input: CreateWorkLogDto) {
        const [year, month, day] = input.workDate.split('-').map(Number);
        const workDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

        return this.prisma.workLog.create({
            data: {
                userId,
                workDate,
                title: input.title.trim(),
                note: input.note?.trim() ? input.note.trim() : null,
                durationMinutes: input.durationMinutes,
            },
            select: {
                id: true,
                workDate: true,
                title: true,
                note: true,
                durationMinutes: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }

    async update(userId: string, id: string, input: UpdateWorkLogDto) {
        const existing = await this.prisma.workLog.findFirst({
            where: {
                id,
                userId,
            },
            select: {
                id: true,
            },
        });

        if (!existing) {
            throw new NotFoundException('作業ログが見つかりません。');
        }

        const workDate = input.workDate
            ? (() => {
                  const [year, month, day] = input.workDate.split('-').map(Number);
                  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
              })()
            : undefined;

        return this.prisma.workLog.update({
            where: { id },
            data: {
                ...(typeof input.title === 'string' ? { title: input.title.trim() } : {}),
                ...(typeof input.note === 'string'
                    ? { note: input.note.trim() ? input.note.trim() : null }
                    : {}),
                ...(typeof input.durationMinutes === 'number'
                    ? { durationMinutes: input.durationMinutes }
                    : {}),
                ...(workDate ? { workDate } : {}),
            },
            select: {
                id: true,
                workDate: true,
                title: true,
                note: true,
                durationMinutes: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }

    async remove(userId: string, id: string) {
        const result = await this.prisma.workLog.deleteMany({
            where: {
                id,
                userId,
            },
        });

        if (result.count === 0) {
            throw new NotFoundException('作業ログが見つかりません。');
        }
    }
}
