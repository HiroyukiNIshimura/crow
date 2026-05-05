'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';

const defaultApiUrl =
    process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const schema = z
    .object({
        currentPassword: z.preprocess(
            (value) => (typeof value === 'string' ? value : ''),
            z.string().min(1, '現在のパスワードを入力してください。'),
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
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: 'パスワードが一致しません。',
        path: ['confirmPassword'],
    });

export type ChangePasswordActionState = {
    error: string | null;
    success: boolean;
};

function buildCookieHeader(cookiesToForward: Array<{ name: string; value: string }>) {
    return cookiesToForward
        .map(({ name, value }) => `${name}=${encodeURIComponent(value)}`)
        .join('; ');
}

function extractMessage(payload: unknown): string | undefined {
    if (!payload || typeof payload !== 'object') {
        return undefined;
    }

    const message = (payload as { message?: unknown }).message;

    if (typeof message === 'string') {
        return message;
    }

    if (Array.isArray(message) && typeof message[0] === 'string') {
        return message[0];
    }

    return undefined;
}

export async function changePasswordAction(
    _prevState: ChangePasswordActionState,
    formData: FormData,
): Promise<ChangePasswordActionState> {
    const parsed = schema.safeParse({
        currentPassword: formData.get('currentPassword'),
        newPassword: formData.get('newPassword'),
        confirmPassword: formData.get('confirmPassword'),
    });

    if (!parsed.success) {
        return {
            error: parsed.error.issues[0]?.message ?? '入力内容をご確認ください。',
            success: false,
        };
    }

    const cookieStore = await cookies();
    const sessionCookieName = process.env.NEXT_PUBLIC_SESSION_COOKIE_NAME ?? 'crow_session';
    const csrfCookieName = process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME ?? 'csrf_token';

    const sessionToken = cookieStore.get(sessionCookieName)?.value;
    const csrfToken = cookieStore.get(csrfCookieName)?.value;

    if (!sessionToken) {
        return { error: 'ログインが必要です。', success: false };
    }

    const cookieHeader = buildCookieHeader([
        { name: sessionCookieName, value: sessionToken },
        ...(csrfToken ? [{ name: csrfCookieName, value: csrfToken }] : []),
    ]);

    try {
        const response = await fetch(`${defaultApiUrl}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: cookieHeader,
                ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
            },
            cache: 'no-store',
            body: JSON.stringify({
                currentPassword: parsed.data.currentPassword,
                newPassword: parsed.data.newPassword,
            }),
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => null);
            return {
                error:
                    extractMessage(payload) ?? 'エラーが発生しました。もう一度お試しください。',
                success: false,
            };
        }
    } catch {
        return {
            error: 'ネットワークに接続できませんでした。接続状況を確認してください。',
            success: false,
        };
    }

    return { error: null, success: true };
}
