'use server';

import { z } from 'zod';

const defaultApiUrl =
    process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const schema = z.object({
    token: z.preprocess(
        (value) => (typeof value === 'string' ? value : ''),
        z.string().min(1, 'トークンが見つかりません。'),
    ),
    newPassword: z.preprocess(
        (value) => (typeof value === 'string' ? value : ''),
        z
            .string()
            .min(8, 'パスワードは8文字以上で入力してください。')
            .max(255, 'パスワードは255文字以内で入力してください。'),
    ),
    confirmPassword: z.preprocess(
        (value) => (typeof value === 'string' ? value : ''),
        z.string().min(1, '確認用パスワードを入力してください。'),
    ),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: 'パスワードが一致しません。',
    path: ['confirmPassword'],
});

export type ResetPasswordActionState = {
    error: string | null;
    success: boolean;
};

export async function resetPasswordAction(
    _prevState: ResetPasswordActionState,
    formData: FormData,
): Promise<ResetPasswordActionState> {
    const parsed = schema.safeParse({
        token: formData.get('token'),
        newPassword: formData.get('newPassword'),
        confirmPassword: formData.get('confirmPassword'),
    });

    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? '入力内容をご確認ください。', success: false };
    }

    try {
        const response = await fetch(`${defaultApiUrl}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({
                token: parsed.data.token,
                newPassword: parsed.data.newPassword,
            }),
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => null);
            const message =
                (payload as { message?: string })?.message ??
                'エラーが発生しました。もう一度お試しください。';
            return { error: message, success: false };
        }
    } catch {
        return {
            error: 'ネットワークに接続できませんでした。接続状況を確認してください。',
            success: false,
        };
    }

    return { error: null, success: true };
}
