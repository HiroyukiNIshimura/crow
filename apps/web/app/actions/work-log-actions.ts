'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const defaultApiUrl =
    process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const dateRangeSchema = z.object({
    month: z.preprocess((v) => (typeof v === 'string' ? v : ''), z.string().regex(/^\d{4}-\d{2}$/)),
    date: z.preprocess(
        (v) => (typeof v === 'string' ? v : ''),
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ),
});

const workLogMutableFieldsSchema = z.object({
    title: z.preprocess(
        (v) => (typeof v === 'string' ? v.trim() : ''),
        z.string().min(1, 'タイトルは必須です。'),
    ),
    note: z.preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string()),
    workTime: z.preprocess(
        (v) => (typeof v === 'string' ? v.trim() : ''),
        z
            .string()
            .refine((s) => s === '' || /^([01]\d|2[0-3]):([0-5]\d)$/.test(s), {
                message: '開始時刻は HH:mm 形式で入力してください。',
            }),
    ),
    endTime: z.preprocess(
        (v) => (typeof v === 'string' ? v.trim() : ''),
        z
            .string()
            .refine((s) => s === '' || /^([01]\d|2[0-3]):([0-5]\d)$/.test(s), {
                message: '終了時刻は HH:mm 形式で入力してください。',
            }),
    ),
    durationMinutes: z.preprocess(
        (v) => (typeof v === 'string' ? v.trim() : ''),
        z.string().transform((s, ctx) => {
            if (s === '') return undefined;
            const n = Number(s);
            if (!Number.isInteger(n)) {
                ctx.addIssue({ code: 'custom', message: '作業時間は分単位で入力してください。' });
                return z.NEVER;
            }
            return n;
        }),
    ),
});

const deleteWorkLogSchema = z.object({
    logId: z.preprocess(
        (v) => (typeof v === 'string' ? v : ''),
        z.string().min(1, '削除対象が不正です。'),
    ),
});

const updateWorkLogSchema = workLogMutableFieldsSchema.extend({
    logId: z.preprocess(
        (v) => (typeof v === 'string' ? v : ''),
        z.string().min(1, '更新対象が不正です。'),
    ),
});

function extractValidationMessage(error: z.ZodError): string {
    return error.issues[0]?.message ?? '入力内容が不正です。';
}

type DaySummary = {
    date: string;
    logCount: number;
    totalDurationMinutes: number;
    hasMemo: boolean;
};

export type MonthLogsResponse = {
    month: string;
    summary: {
        recordedDays: number;
        totalDurationMinutes: number;
        memoDays: number;
        totalLogs: number;
    };
    days: DaySummary[];
};

export type DayLogsResponse = {
    date: string;
    dayNote: string | null;
    totalDurationMinutes: number;
    logs: Array<{
        id: string;
        title: string;
        note: string | null;
        recordedAt: string | null;
        endRecordedAt: string | null;
        durationMinutes: number | null;
        createdAt: string;
        updatedAt: string;
        workDate: string;
    }>;
};

function buildCookieHeader(cookiesToForward: Array<{ name: string; value: string }>) {
    return cookiesToForward
        .map(({ name, value }) => `${name}=${encodeURIComponent(value)}`)
        .join('; ');
}

async function getAuthCookieHeader() {
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

    return cookieHeader;
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

    return {
        cookieHeader,
        csrfToken,
    };
}

function getRedirectUrl(month: string, date: string, error?: string) {
    const query = new URLSearchParams({
        month,
        date,
        ...(error ? { error } : {}),
    });

    return `/?${query.toString()}`;
}

export async function getMonthLogs(year: number, month: number): Promise<MonthLogsResponse | null> {
    const cookieHeader = await getAuthCookieHeader();

    if (!cookieHeader) {
        return null;
    }

    const query = new URLSearchParams({
        year: String(year),
        month: String(month),
    });

    try {
        const response = await fetch(`${defaultApiUrl}/work-logs/month?${query.toString()}`, {
            method: 'GET',
            headers: {
                Cookie: cookieHeader,
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            return null;
        }

        return (await response.json()) as MonthLogsResponse;
    } catch {
        return null;
    }
}

export async function getDayLogs(dateText: string): Promise<DayLogsResponse | null> {
    const cookieHeader = await getAuthCookieHeader();

    if (!cookieHeader) {
        return null;
    }

    const query = new URLSearchParams({ date: dateText });

    try {
        const response = await fetch(`${defaultApiUrl}/work-logs/day?${query.toString()}`, {
            method: 'GET',
            headers: {
                Cookie: cookieHeader,
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            return null;
        }

        return (await response.json()) as DayLogsResponse;
    } catch {
        return null;
    }
}

export async function createWorkLogAction(formData: FormData) {
    const parsedDate = dateRangeSchema.safeParse({
        month: formData.get('month'),
        date: formData.get('date'),
    });

    if (!parsedDate.success) {
        redirect('/');
    }

    const { month, date } = parsedDate.data;

    const parsedFields = workLogMutableFieldsSchema.safeParse({
        title: formData.get('title'),
        note: formData.get('note'),
        workTime: formData.get('workTime'),
        endTime: formData.get('endTime'),
        durationMinutes: formData.get('durationMinutes'),
    });

    if (!parsedFields.success) {
        redirect(getRedirectUrl(month, date, extractValidationMessage(parsedFields.error)));
    }

    const { title, note, workTime, endTime, durationMinutes } = parsedFields.data;

    const authContext = await getAuthContext();
    if (!authContext) {
        redirect(
            getRedirectUrl(month, date, 'セッションが見つかりません。再読み込みしてください。'),
        );
    }

    let actionError: string | null = null;

    try {
        const response = await fetch(`${defaultApiUrl}/work-logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: authContext.cookieHeader,
                ...(authContext.csrfToken ? { 'X-CSRF-Token': authContext.csrfToken } : {}),
            },
            body: JSON.stringify({
                workDate: date,
                title,
                note,
                ...(workTime ? { workTime } : {}),
                ...(endTime ? { endTime } : {}),
                durationMinutes,
            }),
            cache: 'no-store',
        });

        if (!response.ok) {
            actionError = '作業ログの追加に失敗しました。';
        }
    } catch {
        actionError = 'ネットワークエラーが発生しました。';
    }

    redirect(getRedirectUrl(month, date, actionError ?? undefined));
}

export async function deleteWorkLogAction(formData: FormData) {
    const parsedDate = dateRangeSchema.safeParse({
        month: formData.get('month'),
        date: formData.get('date'),
    });

    if (!parsedDate.success) {
        redirect('/');
    }

    const { month, date } = parsedDate.data;

    const parsedLogId = deleteWorkLogSchema.safeParse({
        logId: formData.get('logId'),
    });

    if (!parsedLogId.success) {
        redirect(getRedirectUrl(month, date, extractValidationMessage(parsedLogId.error)));
    }

    const { logId } = parsedLogId.data;

    const authContext = await getAuthContext();
    if (!authContext) {
        redirect(
            getRedirectUrl(month, date, 'セッションが見つかりません。再読み込みしてください。'),
        );
    }

    let actionError: string | null = null;

    try {
        const response = await fetch(`${defaultApiUrl}/work-logs/${encodeURIComponent(logId)}`, {
            method: 'DELETE',
            headers: {
                Cookie: authContext.cookieHeader,
                ...(authContext.csrfToken ? { 'X-CSRF-Token': authContext.csrfToken } : {}),
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            actionError = '作業ログの削除に失敗しました。';
        }
    } catch {
        actionError = 'ネットワークエラーが発生しました。';
    }

    redirect(getRedirectUrl(month, date, actionError ?? undefined));
}

export async function updateWorkLogAction(formData: FormData) {
    const parsedDate = dateRangeSchema.safeParse({
        month: formData.get('month'),
        date: formData.get('date'),
    });

    if (!parsedDate.success) {
        redirect('/');
    }

    const { month, date } = parsedDate.data;

    const parsedFields = updateWorkLogSchema.safeParse({
        logId: formData.get('logId'),
        title: formData.get('title'),
        note: formData.get('note'),
        workTime: formData.get('workTime'),
        endTime: formData.get('endTime'),
        durationMinutes: formData.get('durationMinutes'),
    });

    if (!parsedFields.success) {
        redirect(getRedirectUrl(month, date, extractValidationMessage(parsedFields.error)));
    }

    const { logId, title, note, workTime, endTime, durationMinutes } = parsedFields.data;

    const authContext = await getAuthContext();
    if (!authContext) {
        redirect(
            getRedirectUrl(month, date, 'セッションが見つかりません。再読み込みしてください。'),
        );
    }

    let actionError: string | null = null;

    try {
        const response = await fetch(`${defaultApiUrl}/work-logs/${encodeURIComponent(logId)}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Cookie: authContext.cookieHeader,
                ...(authContext.csrfToken ? { 'X-CSRF-Token': authContext.csrfToken } : {}),
            },
            body: JSON.stringify({
                title,
                note,
                ...(workTime ? { workTime } : {}),
                ...(endTime ? { endTime } : {}),
                durationMinutes,
            }),
            cache: 'no-store',
        });

        if (!response.ok) {
            actionError = '作業ログの更新に失敗しました。';
        }
    } catch {
        actionError = 'ネットワークエラーが発生しました。';
    }

    redirect(getRedirectUrl(month, date, actionError ?? undefined));
}

export async function updateDayNoteAction(formData: FormData) {
    const parsedDate = dateRangeSchema.safeParse({
        month: formData.get('month'),
        date: formData.get('date'),
    });

    if (!parsedDate.success) {
        redirect('/');
    }

    const { month, date } = parsedDate.data;

    const note = z
        .preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string())
        .parse(formData.get('dayNote'));

    const authContext = await getAuthContext();
    if (!authContext) {
        redirect(
            getRedirectUrl(month, date, 'セッションが見つかりません。再読み込みしてください。'),
        );
    }

    let actionError: string | null = null;

    try {
        const response = await fetch(`${defaultApiUrl}/work-logs/day-note`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Cookie: authContext.cookieHeader,
                ...(authContext.csrfToken ? { 'X-CSRF-Token': authContext.csrfToken } : {}),
            },
            body: JSON.stringify({
                date,
                note,
            }),
            cache: 'no-store',
        });

        if (!response.ok) {
            actionError = '1日のメモ保存に失敗しました。';
        }
    } catch {
        actionError = 'ネットワークエラーが発生しました。';
    }

    redirect(getRedirectUrl(month, date, actionError ?? undefined));
}
