import { IsString, MinLength } from 'class-validator';

export class AcceptInvitationDto {
    @IsString()
    displayName!: string;

    @IsString()
    @MinLength(8)
    password!: string;
}
