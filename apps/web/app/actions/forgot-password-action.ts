'use server';

import { z } from 'zod';

const defaultApiUrl =
    process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const schema = z.object({
    email: z.preprocess(
        (value) => (typeof value === 'string' ? value : ''),
        z
            .email('メールアドレスの形式が正しくありません。')
            .trim()
            .min(1, 'メールアドレスを入力してください。')
            .max(255, 'メールアドレスは255文字以内で入力してください。'),
    ),
});

export type ForgotPasswordActionState = {
    error: string | null;
    success: boolean;
};

export async function forgotPasswordAction(
    _prevState: ForgotPasswordActionState,
    formData: FormData,
): Promise<ForgotPasswordActionState> {
    const parsed = schema.safeParse({ email: formData.get('email') });

    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? '入力内容をご確認ください。', success: false };
    }

    try {
        const response = await fetch(`${defaultApiUrl}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ email: parsed.data.email }),
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => null);
            const message =
                (payload as { message?: string })?.message ??
                'エラーが発生しました。しばらく時間をおいて再度お試しください。';
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
