import { IsInt, IsOptional, IsString, Matches, Max, Min, MinLength } from 'class-validator';

export class UpdateWorkLogDto {
    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    workDate?: string;

    @IsOptional()
    @IsString()
    @MinLength(1)
    title?: string;

    @IsOptional()
    @IsString()
    note?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(24 * 60)
    durationMinutes?: number;
}
