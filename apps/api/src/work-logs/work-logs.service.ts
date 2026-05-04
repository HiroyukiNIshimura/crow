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

    private buildDayRange(dateText: string) {
        const [year, month, day] = dateText.split('-').map(Number);
        const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));

        return { end, start };
    }

    private buildRecordedAt(dateText: string, workTime?: string) {
        if (!workTime) {
            return null;
        }

        return new Date(`${dateText}T${workTime}:00+09:00`);
    }

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

        const dailyNotes = await this.prisma.dailyNote.findMany({
            where: {
                userId,
                workDate: {
                    gte: start,
                    lt: end,
                },
            },
            select: {
                workDate: true,
                note: true,
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

        for (const dailyNote of dailyNotes) {
            if (!dailyNote.note.trim()) {
                continue;
            }

            const date = dailyNote.workDate.toISOString().slice(0, 10);
            const prev = byDate.get(date) ?? {
                logCount: 0,
                totalDurationMinutes: 0,
                hasMemo: false,
            };

            prev.hasMemo = true;
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
        const { start, end } = this.buildDayRange(dateText);

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
                recordedAt: true,
                durationMinutes: true,
                createdAt: true,
                updatedAt: true,
                workDate: true,
            },
            orderBy: [{ workDate: 'asc' }, { createdAt: 'asc' }],
        });

        const sortedLogs = [...logs].sort((a, b) => {
            const aTime = (a.recordedAt ?? a.createdAt).getTime();
            const bTime = (b.recordedAt ?? b.createdAt).getTime();

            if (aTime !== bTime) {
                return aTime - bTime;
            }

            return a.createdAt.getTime() - b.createdAt.getTime();
        });

        const totalDurationMinutes = sortedLogs.reduce(
            (acc, log) => acc + (log.durationMinutes ?? 0),
            0,
        );

        const dayNoteRecord = await this.prisma.dailyNote.findUnique({
            where: {
                userId_workDate: {
                    userId,
                    workDate: start,
                },
            },
            select: {
                note: true,
            },
        });

        return {
            date: dateText,
            dayNote: dayNoteRecord?.note ?? null,
            totalDurationMinutes,
            logs: sortedLogs,
        };
    }

    async create(userId: string, input: CreateWorkLogDto) {
        const [year, month, day] = input.workDate.split('-').map(Number);
        const workDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        const recordedAt = this.buildRecordedAt(input.workDate, input.workTime);

        return this.prisma.workLog.create({
            data: {
                userId,
                workDate,
                recordedAt,
                title: input.title.trim(),
                note: input.note?.trim() ? input.note.trim() : null,
                durationMinutes: input.durationMinutes,
            },
            select: {
                id: true,
                workDate: true,
                recordedAt: true,
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
                workDate: true,
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

        const effectiveDateText = input.workDate ?? existing.workDate.toISOString().slice(0, 10);

        const recordedAt =
            typeof input.workTime === 'string'
                ? this.buildRecordedAt(effectiveDateText, input.workTime)
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
                ...(recordedAt !== undefined ? { recordedAt } : {}),
            },
            select: {
                id: true,
                workDate: true,
                recordedAt: true,
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

    async updateDayNote(userId: string, dateText: string, note?: string) {
        const { start } = this.buildDayRange(dateText);
        const normalized = note?.trim() ?? '';

        if (!normalized) {
            await this.prisma.dailyNote.deleteMany({
                where: {
                    userId,
                    workDate: start,
                },
            });

            return {
                date: dateText,
                note: null,
            };
        }

        const saved = await this.prisma.dailyNote.upsert({
            where: {
                userId_workDate: {
                    userId,
                    workDate: start,
                },
            },
            create: {
                userId,
                workDate: start,
                note: normalized,
            },
            update: {
                note: normalized,
            },
            select: {
                note: true,
                workDate: true,
            },
        });

        return {
            date: saved.workDate.toISOString().slice(0, 10),
            note: saved.note,
        };
    }
}
