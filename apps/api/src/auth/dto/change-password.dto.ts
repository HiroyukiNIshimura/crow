import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
    @IsString()
    currentPassword!: string;

    @IsString()
    @MinLength(8, { message: 'パスワードは8文字以上で入力してください。' })
    @MaxLength(255, { message: 'パスワードは255文字以内で入力してください。' })
    newPassword!: string;
}
