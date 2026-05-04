'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { relaySetCookieHeaders } from '../actions/cookie-relay';

const defaultApiUrl =
    process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type LoginActionState = {
    error: string | null;
};

export const initialLoginActionState: LoginActionState = {
    error: null,
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

export async function loginAction(
    _prevState: LoginActionState,
    formData: FormData,
): Promise<LoginActionState> {
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    if (!email || !password) {
        return {
            error: 'メールアドレスとパスワードを入力してください。',
        };
    }

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
                };
            }

            if (response.status >= 500) {
                return {
                    error: 'サーバーでエラーが発生しました。時間をおいて再度お試しください。',
                };
            }

            return {
                error: message ?? 'ログインに失敗しました。入力内容をご確認ください。',
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
        };
    }

    redirect('/');
}
