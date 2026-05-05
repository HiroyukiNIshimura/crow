'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';
import { relaySetCookieHeaders } from './cookie-relay';

const defaultApiUrl =
    process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const loginInputSchema = z.object({
    email: z.preprocess(
        (value) => (typeof value === 'string' ? value : ''),
        z
            .email('メールアドレスの形式が正しくありません。')
            .trim()
            .min(1, 'メールアドレスを入力してください。')
            .max(255, 'メールアドレスは255文字以内で入力してください。'),
    ),
    password: z.preprocess(
        (value) => (typeof value === 'string' ? value : ''),
        z
            .string()
            .min(1, 'パスワードを入力してください。')
            .min(8, 'パスワードは8文字以上で入力してください。')
            .max(255, 'パスワードは255文字以内で入力してください。'),
    ),
});

export type LoginActionState = {
    error: string | null;
    success: boolean;
};

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

function extractValidationMessage(error: z.ZodError): string {
    return error.issues[0]?.message ?? '入力内容をご確認ください。';
}

export async function loginAction(
    _prevState: LoginActionState,
    formData: FormData,
): Promise<LoginActionState> {
    const parsedInput = loginInputSchema.safeParse({
        email: formData.get('email'),
        password: formData.get('password'),
    });

    if (!parsedInput.success) {
        return {
            error: extractValidationMessage(parsedInput.error),
            success: false,
        };
    }

    const { email, password } = parsedInput.data;

    try {
        const response = await fetch(`${defaultApiUrl}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as unknown;
            const message = extractMessage(payload);

            if (response.status === 401) {
                return {
                    error: message ?? 'メールアドレスまたはパスワードが正しくありません。',
                    success: false,
                };
            }

            if (response.status >= 500) {
                return {
                    error: 'サーバーでエラーが発生しました。時間をおいて再度お試しください。',
                    success: false,
                };
            }

            return {
                error: message ?? 'ログインに失敗しました。入力内容をご確認ください。',
                success: false,
            };
        }

        const cookieStore = await cookies();
        relaySetCookieHeaders(response, cookieStore);
    } catch (submitError) {
        return {
            error:
                submitError instanceof TypeError
                    ? 'ネットワークに接続できませんでした。接続状況を確認してください。'
                    : '不明なエラーが発生しました。',
            success: false,
        };
    }

    return {
        error: null,
        success: true,
    };
}
