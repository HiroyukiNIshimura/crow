'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const defaultApiUrl =
    process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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
    const month = String(formData.get('month') ?? '');
    const date = String(formData.get('date') ?? '');
    const title = String(formData.get('title') ?? '').trim();
    const note = String(formData.get('note') ?? '').trim();
    const workTime = String(formData.get('workTime') ?? '').trim();
    const durationText = String(formData.get('durationMinutes') ?? '').trim();
    const durationMinutes = durationText ? Number(durationText) : undefined;

    if (!/^\d{4}-\d{2}$/.test(month) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        redirect('/');
    }

    if (!title) {
        redirect(getRedirectUrl(month, date, 'タイトルは必須です。'));
    }

    if (typeof durationMinutes === 'number' && !Number.isInteger(durationMinutes)) {
        redirect(getRedirectUrl(month, date, '作業時間は分単位で入力してください。'));
    }

    if (workTime && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(workTime)) {
        redirect(getRedirectUrl(month, date, '作業時刻は HH:mm 形式で入力してください。'));
    }

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
    const month = String(formData.get('month') ?? '');
    const date = String(formData.get('date') ?? '');
    const logId = String(formData.get('logId') ?? '');

    if (!/^\d{4}-\d{2}$/.test(month) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        redirect('/');
    }

    if (!logId) {
        redirect(getRedirectUrl(month, date, '削除対象が不正です。'));
    }

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
    const month = String(formData.get('month') ?? '');
    const date = String(formData.get('date') ?? '');
    const logId = String(formData.get('logId') ?? '');
    const title = String(formData.get('title') ?? '').trim();
    const note = String(formData.get('note') ?? '').trim();
    const workTime = String(formData.get('workTime') ?? '').trim();
    const durationText = String(formData.get('durationMinutes') ?? '').trim();
    const durationMinutes = durationText ? Number(durationText) : undefined;

    if (!/^[0-9]{4}-[0-9]{2}$/.test(month) || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
        redirect('/');
    }

    if (!logId) {
        redirect(getRedirectUrl(month, date, '更新対象が不正です。'));
    }

    if (!title) {
        redirect(getRedirectUrl(month, date, 'タイトルは必須です。'));
    }

    if (typeof durationMinutes === 'number' && !Number.isInteger(durationMinutes)) {
        redirect(getRedirectUrl(month, date, '作業時間は分単位で入力してください。'));
    }

    if (workTime && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(workTime)) {
        redirect(getRedirectUrl(month, date, '作業時刻は HH:mm 形式で入力してください。'));
    }

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
    const month = String(formData.get('month') ?? '');
    const date = String(formData.get('date') ?? '');
    const note = String(formData.get('dayNote') ?? '').trim();

    if (!/^[0-9]{4}-[0-9]{2}$/.test(month) || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
        redirect('/');
    }

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
