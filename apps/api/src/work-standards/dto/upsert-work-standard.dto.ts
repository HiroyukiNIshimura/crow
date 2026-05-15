import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpsertWorkStandardDto {
    @Type(() => Number)
    @IsInt()
    @Min(2000)
    @Max(2100)
    year!: number;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(12)
    month!: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0.5)
    @Max(24)
    hoursPerDay!: number;

    @Type(() => Number)
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(31)
    workDaysInMonth?: number;
}
