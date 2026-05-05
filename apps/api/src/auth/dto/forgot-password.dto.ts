import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
    @IsEmail({}, { message: 'メールアドレスの形式が正しくありません。' })
    email!: string;
}
