'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';

const defaultApiUrl =
    process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function buildCookieHeader(cookiesToForward: Array<{ name: string; value: string }>) {
    return cookiesToForward
        .map(({ name, value }) => `${name}=${encodeURIComponent(value)}`)
        .join('; ');
}

async function getAuthContext() {
    const cookieStore = await cookies();
    const sessionCookieName = process.env.NEXT_PUBLIC_SESSION_COOKIE_NAME ?? 'crow_session';
    const csrfCookieName = process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME ?? 'csrf_token';

    const sessionToken = cookieStore.get(sessionCookieName)?.value;
    const csrfToken = cookieStore.get(csrfCookieName)?.value;

    if (!sessionToken) {
        return null;
    }

    const cookieHeader = buildCookieHeader([
        { name: sessionCookieName, value: sessionToken },
        ...(csrfToken ? [{ name: csrfCookieName, value: csrfToken }] : []),
    ]);

    return { cookieHeader, csrfToken };
}

export type WorkStandard = {
    id: string;
    userId: string;
    year: number;
    month: number;
    hoursPerDay: number;
    workDaysInMonth: number;
    totalHours: number;
    createdAt: string;
    updatedAt: string;
};

const upsertWorkStandardSchema = z.object({
    year: z.preprocess(
        (v) => (typeof v === 'string' ? Number(v) : v),
        z.number().int().min(2000).max(2100),
    ),
    month: z.preprocess(
        (v) => (typeof v === 'string' ? Number(v) : v),
        z.number().int().min(1).max(12),
    ),
    hoursPerDay: z.preprocess(
        (v) => (typeof v === 'string' ? Number(v) : v),
        z.number().min(0.5).max(24),
    ),
    workDaysInMonth: z.preprocess((v) => {
        if (v === '' || v === undefined || v === null) return undefined;
        return typeof v === 'string' ? Number(v) : v;
    }, z.number().int().min(1).max(31).optional()),
});

export async function getWorkStandard(year: number, month: number): Promise<WorkStandard | null> {
    const ctx = await getAuthContext();
    if (!ctx) return null;

    try {
        const response = await fetch(`${defaultApiUrl}/work-standards/${year}/${month}`, {
            method: 'GET',
            headers: { Cookie: ctx.cookieHeader },
            cache: 'no-store',
        });

        if (!response.ok) return null;

        return (await response.json()) as WorkStandard | null;
    } catch {
        return null;
    }
}

export type UpsertWorkStandardResult =
    | { success: true; data: WorkStandard }
    | { success: false; error: string };

export async function upsertWorkStandard(
    _prevState: UpsertWorkStandardResult,
    formData: FormData,
): Promise<UpsertWorkStandardResult> {
    const ctx = await getAuthContext();
    if (!ctx) return { success: false, error: '認証が必要です。' };

    const parsed = upsertWorkStandardSchema.safeParse({
        year: formData.get('year'),
        month: formData.get('month'),
        hoursPerDay: formData.get('hoursPerDay'),
        workDaysInMonth: formData.get('workDaysInMonth'),
    });

    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容が不正です。' };
    }

    try {
        const response = await fetch(`${defaultApiUrl}/work-standards`, {
            method: 'PUT',
            headers: {
                Cookie: ctx.cookieHeader,
                'Content-Type': 'application/json',
                ...(ctx.csrfToken ? { 'X-CSRF-Token': ctx.csrfToken } : {}),
            },
            body: JSON.stringify(parsed.data),
            cache: 'no-store',
        });

        if (!response.ok) {
            const body = (await response.json().catch(() => ({}))) as { message?: string };
            return { success: false, error: body.message ?? '保存に失敗しました。' };
        }

        const data = (await response.json()) as WorkStandard;
        revalidatePath('/work-standards');
        return { success: true, data };
    } catch {
        return { success: false, error: '通信エラーが発生しました。' };
    }
}

export type DeleteWorkStandardResult = { success: true } | { success: false; error: string };

export async function deleteWorkStandard(
    year: number,
    month: number,
): Promise<DeleteWorkStandardResult> {
    const ctx = await getAuthContext();
    if (!ctx) return { success: false, error: '認証が必要です。' };

    try {
        const response = await fetch(`${defaultApiUrl}/work-standards/${year}/${month}`, {
            method: 'DELETE',
            headers: {
                Cookie: ctx.cookieHeader,
                ...(ctx.csrfToken ? { 'X-CSRF-Token': ctx.csrfToken } : {}),
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            const body = (await response.json().catch(() => ({}))) as { message?: string };
            return { success: false, error: body.message ?? '削除に失敗しました。' };
        }

        revalidatePath('/work-standards');
        return { success: true };
    } catch {
        return { success: false, error: '通信エラーが発生しました。' };
    }
}
