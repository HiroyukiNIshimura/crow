'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';

const defaultApiUrl =
    process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const createInvitationSchema = z.object({
    email: z.preprocess(
        (v) => (typeof v === 'string' ? v.trim() : ''),
        z
            .string()
            .email('メールアドレスの形式が正しくありません。')
            .min(1, 'メールアドレスを入力してください。')
            .max(255, 'メールアドレスは255文字以内で入力してください。'),
    ),
    role: z.preprocess(
        (v) => (typeof v === 'string' ? v : 'member'),
        z.enum(['admin', 'member']),
    ),
});

export type CreateInvitationState = {
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

async function getAuthContext() {
    const cookieStore = await cookies();
    const sessionCookieName = process.env.NEXT_PUBLIC_SESSION_COOKIE_NAME ?? 'crow_session';
    const csrfCookieName = process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME ?? 'csrf_token';

    const sessionToken = cookieStore.get(sessionCookieName)?.value;
    const csrfToken = cookieStore.get(csrfCookieName)?.value;

    if (!sessionToken) return null;

    const cookieHeader = [
        `${sessionCookieName}=${encodeURIComponent(sessionToken)}`,
        ...(csrfToken ? [`${csrfCookieName}=${encodeURIComponent(csrfToken)}`] : []),
    ].join('; ');

    return { cookieHeader, csrfToken };
}

export async function createInvitationAction(
    _prevState: CreateInvitationState,
    formData: FormData,
): Promise<CreateInvitationState> {
    const parsed = createInvitationSchema.safeParse({
        email: formData.get('email'),
        role: formData.get('role'),
    });

    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? '入力内容をご確認ください。', success: false };
    }

    const authContext = await getAuthContext();
    if (!authContext) {
        return { error: 'セッションが見つかりません。再ログインしてください。', success: false };
    }

    try {
        const response = await fetch(`${defaultApiUrl}/invitations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: authContext.cookieHeader,
                ...(authContext.csrfToken ? { 'X-CSRF-Token': authContext.csrfToken } : {}),
            },
            cache: 'no-store',
            body: JSON.stringify(parsed.data),
        });

        if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as unknown;
            const message = extractMessage(payload);

            if (response.status === 403) {
                return { error: '管理者権限が必要です。', success: false };
            }
            if (response.status === 409) {
                return { error: message ?? 'このメールアドレスへの招待はすでに存在します。', success: false };
            }
            if (response.status >= 500) {
                return { error: 'サーバーでエラーが発生しました。時間をおいて再度お試しください。', success: false };
            }

            return { error: message ?? '招待の送信に失敗しました。', success: false };
        }
    } catch {
        return { error: 'ネットワークに接続できませんでした。接続状況を確認してください。', success: false };
    }

    return { error: null, success: true };
}
