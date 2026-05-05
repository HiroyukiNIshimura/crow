'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';
import { relaySetCookieHeaders } from './cookie-relay';

const defaultApiUrl =
    process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const acceptInvitationSchema = z.object({
    token: z.string().min(1),
    displayName: z.preprocess(
        (v) => (typeof v === 'string' ? v.trim() : ''),
        z.string().min(1, '表示名を入力してください。').max(100, '表示名は100文字以内で入力してください。'),
    ),
    password: z.preprocess(
        (v) => (typeof v === 'string' ? v : ''),
        z
            .string()
            .min(8, 'パスワードは8文字以上で入力してください。')
            .max(255, 'パスワードは255文字以内で入力してください。'),
    ),
});

export type AcceptInvitationState = {
    error: string | null;
    success: boolean;
};

function extractMessage(payload: unknown): string | undefined {
    if (!payload || typeof payload !== 'object') return undefined;
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
    return undefined;
}

export async function acceptInvitationAction(
    _prevState: AcceptInvitationState,
    formData: FormData,
): Promise<AcceptInvitationState> {
    const parsed = acceptInvitationSchema.safeParse({
        token: formData.get('token'),
        displayName: formData.get('displayName'),
        password: formData.get('password'),
    });

    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? '入力内容をご確認ください。', success: false };
    }

    const { token, displayName, password } = parsed.data;

    let response: Response;
    try {
        response = await fetch(`${defaultApiUrl}/invitations/${token}/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ displayName, password }),
        });
    } catch {
        return { error: 'ネットワークに接続できませんでした。接続状況を確認してください。', success: false };
    }

    if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown;
        const message = extractMessage(payload);

        if (response.status === 400 || response.status === 404) {
            return { error: message ?? '招待リンクが無効または期限切れです。', success: false };
        }
        if (response.status === 409) {
            return { error: message ?? 'このメールアドレスはすでに登録されています。', success: false };
        }
        if (response.status >= 500) {
            return { error: 'サーバーでエラーが発生しました。時間をおいて再度お試しください。', success: false };
        }

        return { error: message ?? 'アカウントの作成に失敗しました。', success: false };
    }

    const cookieStore = await cookies();
    relaySetCookieHeaders(response, cookieStore);

    return { error: null, success: true };
}
