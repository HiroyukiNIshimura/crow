'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { relaySetCookieHeaders } from './cookie-relay';

const defaultApiUrl =
    process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type LogoutActionState = {
    error: string | null;
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

export async function logoutAction(
    _prevState: LogoutActionState,
    _formData: FormData,
): Promise<LogoutActionState> {
    const cookieStore = await cookies();
    const sessionCookieName = process.env.NEXT_PUBLIC_SESSION_COOKIE_NAME ?? 'crow_session';
    const csrfCookieName = process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME ?? 'csrf_token';

    const sessionToken = cookieStore.get(sessionCookieName)?.value;
    const csrfToken = cookieStore.get(csrfCookieName)?.value;

    if (!sessionToken) {
        redirect('/login');
    }

    const cookieHeader = buildCookieHeader([
        { name: sessionCookieName, value: sessionToken },
        ...(csrfToken ? [{ name: csrfCookieName, value: csrfToken }] : []),
    ]);

    try {
        const response = await fetch(`${defaultApiUrl}/auth/logout`, {
            method: 'POST',
            headers: {
                ...(cookieHeader ? { Cookie: cookieHeader } : {}),
                ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as unknown;
            return {
                error: extractMessage(payload) ?? 'ログアウトに失敗しました。',
            };
        }

        relaySetCookieHeaders(response, cookieStore);
    } catch {
        return {
            error: 'ネットワークエラーが発生しました。',
        };
    }

    redirect('/login');
}
