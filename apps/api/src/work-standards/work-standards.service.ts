import { Injectable } from '@nestjs/common';
import { PrismaService } from '../auth/prisma.service';
import { UpsertWorkStandardDto } from './dto/upsert-work-standard.dto';

@Injectable()
export class WorkStandardsService {
    constructor(private readonly prisma: PrismaService) {}

    private calculateWorkDays(year: number, month: number): number {
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        let workDays = 0;
        for (let d = 1; d <= lastDay; d++) {
            const day = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
            if (day !== 0 && day !== 6) {
                workDays++;
            }
        }
        return workDays;
    }

    async get(userId: string, year: number, month: number) {
        return this.prisma.monthlyWorkStandard.findUnique({
            where: { userId_year_month: { userId, year, month } },
        });
    }

    async upsert(userId: string, dto: UpsertWorkStandardDto) {
        const workDaysInMonth = dto.workDaysInMonth ?? this.calculateWorkDays(dto.year, dto.month);
        const totalHours = workDaysInMonth * dto.hoursPerDay;

        return this.prisma.monthlyWorkStandard.upsert({
            where: {
                userId_year_month: { userId, year: dto.year, month: dto.month },
            },
            create: {
                userId,
                year: dto.year,
                month: dto.month,
                hoursPerDay: dto.hoursPerDay,
                workDaysInMonth,
                totalHours,
            },
            update: {
                hoursPerDay: dto.hoursPerDay,
                workDaysInMonth,
                totalHours,
            },
        });
    }

    async delete(userId: string, year: number, month: number) {
        return this.prisma.monthlyWorkStandard.delete({
            where: { userId_year_month: { userId, year, month } },
        });
    }
}
