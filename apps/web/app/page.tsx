import { cookies } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogoutButton } from '../components/auth/logout-button';
import { ThemeToggle } from '../components/theme/theme-toggle';
import {
    createWorkLogAction,
    deleteWorkLogAction,
    getDayLogs,
    getMonthLogs,
    updateDayNoteAction,
    updateWorkLogAction,
} from './actions/work-log-actions';

type HomePageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type CalendarCell = {
    date: number;
    dateText: string;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    summary?: {
        logCount: number;
        totalDurationMinutes: number;
        hasMemo: boolean;
    };
};

const weekdays = ['月', '火', '水', '木', '金', '土', '日'];

function getSingleParam(value: string | string[] | undefined) {
    if (typeof value === 'string') {
        return value;
    }

    if (Array.isArray(value) && value.length > 0) {
        return value[0];
    }

    return null;
}

function getTodayDateText() {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Tokyo',
    }).format(new Date());
}

function parseMonthParam(monthText: string | null, fallbackDateText: string) {
    const fallback = fallbackDateText.slice(0, 7);
    const safeMonthText = monthText && /^\d{4}-\d{2}$/.test(monthText) ? monthText : fallback;
    const [year, month] = safeMonthText.split('-').map(Number);

    return { month, monthText: safeMonthText, year };
}

function ensureSelectedDate(year: number, month: number, dateText: string | null) {
    if (!dateText || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
        return `${year}-${String(month).padStart(2, '0')}-01`;
    }

    if (dateText.slice(0, 7) !== `${year}-${String(month).padStart(2, '0')}`) {
        return `${year}-${String(month).padStart(2, '0')}-01`;
    }

    return dateText;
}

function createDateText(year: number, month: number, day: number) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function toHoursLabel(totalDurationMinutes: number) {
    return `${(totalDurationMinutes / 60).toFixed(1)}h`;
}

function formatSelectedDateLabel(dateText: string) {
    const date = new Date(`${dateText}T00:00:00+09:00`);
    const formatter = new Intl.DateTimeFormat('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        weekday: 'long',
        timeZone: 'Asia/Tokyo',
    });

    const parts = formatter.formatToParts(date);
    const month = parts.find((part) => part.type === 'month')?.value ?? '';
    const day = parts.find((part) => part.type === 'day')?.value ?? '';
    const weekday = parts.find((part) => part.type === 'weekday')?.value ?? '';

    return `${month}月${day}日 ${weekday}`;
}

function toClockLabel(dateText: string) {
    return new Intl.DateTimeFormat('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Tokyo',
    }).format(new Date(dateText));
}

function toTimeInputValue(dateText: string | null) {
    if (!dateText) {
        return '';
    }

    return new Intl.DateTimeFormat('sv-SE', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Tokyo',
    }).format(new Date(dateText));
}

function buildCalendarCells(
    year: number,
    month: number,
    selectedDate: string,
    todayDate: string,
    daySummaryMap: Map<
        string,
        {
            logCount: number;
            totalDurationMinutes: number;
            hasMemo: boolean;
        }
    >,
): CalendarCell[] {
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    const startOffset = (firstDay.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const daysInPrevMonth = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();

    const cells: CalendarCell[] = [];

    for (let i = 0; i < startOffset; i += 1) {
        const day = daysInPrevMonth - startOffset + i + 1;
        const prevMonthDate = new Date(Date.UTC(year, month - 2, day));
        const dateText = createDateText(
            prevMonthDate.getUTCFullYear(),
            prevMonthDate.getUTCMonth() + 1,
            prevMonthDate.getUTCDate(),
        );

        cells.push({
            date: day,
            dateText,
            isCurrentMonth: false,
            isToday: dateText === todayDate,
            isSelected: dateText === selectedDate,
            summary: daySummaryMap.get(dateText),
        });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const dateText = createDateText(year, month, day);

        cells.push({
            date: day,
            dateText,
            isCurrentMonth: true,
            isToday: dateText === todayDate,
            isSelected: dateText === selectedDate,
            summary: daySummaryMap.get(dateText),
        });
    }

    let nextDay = 1;
    while (cells.length % 7 !== 0) {
        const nextMonthDate = new Date(Date.UTC(year, month, nextDay));
        const dateText = createDateText(
            nextMonthDate.getUTCFullYear(),
            nextMonthDate.getUTCMonth() + 1,
            nextMonthDate.getUTCDate(),
        );

        cells.push({
            date: nextDay,
            dateText,
            isCurrentMonth: false,
            isToday: dateText === todayDate,
            isSelected: dateText === selectedDate,
            summary: daySummaryMap.get(dateText),
        });
        nextDay += 1;
    }

    return cells;
}

export default async function HomePage({ searchParams }: HomePageProps) {
    const cookieStore = await cookies();
    const cookieName = process.env.NEXT_PUBLIC_SESSION_COOKIE_NAME ?? 'crow_session';
    const session = cookieStore.get(cookieName);

    if (!session) {
        redirect('/login');
    }

    const rawSearchParams = (await searchParams) ?? {};
    const todayDate = getTodayDateText();

    const monthParam = getSingleParam(rawSearchParams.month);
    const dateParam = getSingleParam(rawSearchParams.date);
    const errorParam = getSingleParam(rawSearchParams.error);

    if (!monthParam && !dateParam && !errorParam) {
        redirect(`/?month=${todayDate.slice(0, 7)}&date=${todayDate}`);
    }

    const { year, month, monthText } = parseMonthParam(monthParam, todayDate);
    const selectedDate = ensureSelectedDate(year, month, dateParam);

    const monthData = await getMonthLogs(year, month);
    const dayData = await getDayLogs(selectedDate);

    const monthSummary = monthData?.summary ?? {
        recordedDays: 0,
        totalDurationMinutes: 0,
        memoDays: 0,
        totalLogs: 0,
    };

    const daySummaryMap = new Map(
        (monthData?.days ?? []).map((day) => [
            day.date,
            {
                hasMemo: day.hasMemo,
                logCount: day.logCount,
                totalDurationMinutes: day.totalDurationMinutes,
            },
        ]),
    );

    const calendarCells = buildCalendarCells(year, month, selectedDate, todayDate, daySummaryMap);

    const currentMonthDate = new Date(Date.UTC(year, month - 1, 1));
    const previousMonthDate = new Date(Date.UTC(year, month - 2, 1));
    const nextMonthDate = new Date(Date.UTC(year, month, 1));

    const previousMonthText = `${previousMonthDate.getUTCFullYear()}-${String(
        previousMonthDate.getUTCMonth() + 1,
    ).padStart(2, '0')}`;
    const nextMonthText = `${nextMonthDate.getUTCFullYear()}-${String(
        nextMonthDate.getUTCMonth() + 1,
    ).padStart(2, '0')}`;

    const selectedDayHours = toHoursLabel(dayData?.totalDurationMinutes ?? 0);
    const selectedDateLabel = formatSelectedDateLabel(selectedDate);

    return (
        <main className="app-shell px-4 py-4 text-base-content sm:px-6 lg:px-8">
            <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col gap-5">
                <header className="flex flex-col gap-4 border-b border-base-300/80 bg-base-100/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-20 h-20 shrink-0">
                            <Image
                                src="/images/logo.webp"
                                alt="Crow"
                                width={80}
                                height={80}
                                unoptimized
                            />
                        </div>
                        <div>
                            <span className="badge badge-primary badge-outline">作業記録</span>
                            <p className="mt-1 text-sm text-base-content/60">
                                日々の作業ログを残し、月次の振り返りに使うためのログブックです。
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href={`/?month=${todayDate.slice(0, 7)}&date=${todayDate}`} className="btn btn-ghost btn-sm">
                            今日へ
                        </Link>
                        <ThemeToggle />
                        <LogoutButton />
                    </div>
                </header>

                {errorParam ? (
                    <div className="alert alert-error" role="alert">
                        <span>{errorParam}</span>
                    </div>
                ) : null}

                <section className="grid flex-1 items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_440px]">
                    <div className="rounded-lg border border-base-300 bg-base-100 shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-base-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs font-medium text-base-content/60">月表示</p>
                                <h1 className="text-xl font-semibold tracking-tight">
                                    {currentMonthDate.getUTCFullYear()}年
                                    {currentMonthDate.getUTCMonth() + 1}月
                                </h1>
                            </div>
                            <div className="join">
                                <Link
                                    href={`/?month=${previousMonthText}&date=${previousMonthText}-01`}
                                    className="btn join-item btn-sm btn-outline"
                                    aria-label="前月"
                                >
                                    ←
                                </Link>
                                <Link
                                    href={`/?month=${todayDate.slice(0, 7)}&date=${todayDate}`}
                                    className="btn join-item btn-sm btn-outline"
                                >
                                    今月
                                </Link>
                                <Link
                                    href={`/?month=${nextMonthText}&date=${nextMonthText}-01`}
                                    className="btn join-item btn-sm btn-outline"
                                    aria-label="翌月"
                                >
                                    →
                                </Link>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 border-b border-base-200 p-3 sm:grid-cols-4">
                            <div>
                                <p className="text-xs text-base-content/50">記録済み</p>
                                <p className="text-lg font-semibold">{monthSummary.recordedDays}日</p>
                            </div>
                            <div>
                                <p className="text-xs text-base-content/50">今月合計</p>
                                <p className="text-lg font-semibold">
                                    {toHoursLabel(monthSummary.totalDurationMinutes)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-base-content/50">作業ログ件数</p>
                                <p className="text-sm font-medium">{monthSummary.totalLogs}件</p>
                            </div>
                            <div>
                                <p className="text-xs text-base-content/50">メモあり日</p>
                                <p className="text-lg font-semibold">{monthSummary.memoDays}日</p>
                            </div>
                        </div>

                        <div className="p-2.5 sm:p-3">
                            <div className="grid grid-cols-7 border-b border-base-200 pb-2 text-center text-xs font-medium text-base-content/50">
                                {weekdays.map((weekday) => (
                                    <div key={weekday}>{weekday}</div>
                                ))}
                            </div>

                            <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-1.5">
                                {calendarCells.map((day) => {
                                    const hasRecord = Boolean(day.summary);

                                    return (
                                        <Link
                                            href={`/?month=${day.dateText.slice(0, 7)}&date=${day.dateText}`}
                                            key={day.dateText}
                                            className={[
                                                'relative aspect-square min-h-0 rounded-md border p-1 text-left transition hover:border-primary/60 hover:bg-primary/5 sm:aspect-auto sm:min-h-16 sm:p-1.5',
                                                day.isSelected
                                                    ? 'border-primary bg-primary/10 shadow-sm'
                                                    : 'border-base-200 bg-base-100',
                                                day.isCurrentMonth
                                                    ? 'text-base-content'
                                                    : 'text-base-content/30',
                                            ].join(' ')}
                                            aria-current={day.isSelected ? 'date' : undefined}
                                        >
                                            <div className="flex items-start justify-between gap-1">
                                                <span
                                                    className={[
                                                        'flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold sm:h-6 sm:w-6',
                                                        day.isToday
                                                            ? 'bg-primary text-primary-content'
                                                            : '',
                                                    ].join(' ')}
                                                >
                                                    {day.date}
                                                </span>
                                                {day.summary?.hasMemo ? (
                                                    <span className="h-2 w-2 rounded-full bg-accent sm:h-auto sm:w-auto sm:px-1.5 sm:py-0.5 sm:text-[10px] sm:font-medium sm:text-accent-content">
                                                        <span className="hidden sm:inline">メモ</span>
                                                    </span>
                                                ) : hasRecord ? (
                                                    <span className="h-2 w-2 rounded-full bg-primary/70 sm:hidden">
                                                        <span className="sr-only">記録あり</span>
                                                    </span>
                                                ) : null}
                                            </div>

                                            {hasRecord ? (
                                                <div className="mt-1 hidden space-y-0.5 sm:block">
                                                    <p className="text-xs font-semibold text-base-content">
                                                        {toHoursLabel(
                                                            day.summary?.totalDurationMinutes ?? 0,
                                                        )}
                                                    </p>
                                                    <p className="text-[11px] text-base-content/60">
                                                        {day.summary?.logCount ?? 0}件
                                                    </p>
                                                </div>
                                            ) : (
                                                <p className="mt-3 hidden text-[11px] text-base-content/35 sm:block">
                                                    未記録
                                                </p>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <aside className="rounded-lg border border-base-300 bg-base-100 shadow-sm">
                        <div className="border-b border-base-200 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium text-base-content/60">
                                        選択中の日付
                                    </p>
                                    <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                                        {selectedDateLabel}
                                    </h2>
                                </div>
                                <span className="badge badge-primary">{selectedDayHours}</span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-base-content/65">
                                右ペインで選択日の記録を編集し、1日の要約メモを保存できます。
                            </p>
                        </div>

                        <div className="space-y-4 p-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-base-content/70">
                                    作業ログ
                                </h3>
                                <span className="badge badge-ghost">{dayData?.logs.length ?? 0}件</span>
                            </div>

                            <form action={createWorkLogAction} className="rounded-md border border-base-200 p-3">
                                <input type="hidden" name="month" value={monthText} />
                                <input type="hidden" name="date" value={selectedDate} />

                                <p className="mb-2 text-sm font-semibold text-base-content/75">
                                    記録を追加
                                </p>
                                <div className="grid gap-2">
                                    <input
                                        className="input input-bordered input-sm w-full"
                                        type="text"
                                        name="title"
                                        placeholder="作業タイトル"
                                        required
                                    />
                                    <input
                                        className="input input-bordered input-sm w-full"
                                        type="number"
                                        name="durationMinutes"
                                        placeholder="作業時間（分）"
                                        min={0}
                                        max={1440}
                                        step={1}
                                    />
                                    <input
                                        className="input input-bordered input-sm w-full"
                                        type="time"
                                        name="workTime"
                                    />
                                    <textarea
                                        className="textarea textarea-bordered textarea-sm min-h-20 resize-none"
                                        name="note"
                                        placeholder="補足メモ（任意）"
                                    />
                                    <button type="submit" className="btn btn-primary btn-sm justify-self-end">
                                        追加
                                    </button>
                                </div>
                            </form>

                            <div className="space-y-3">
                                {(dayData?.logs.length ?? 0) === 0 ? (
                                    <article className="rounded-md border border-dashed border-base-300 p-3 text-sm text-base-content/60">
                                        まだ記録がありません。
                                    </article>
                                ) : (
                                    dayData?.logs.map((log) => (
                                        <article key={log.id} className="rounded-md border border-base-200 p-3">
                                            <div className="mb-2 flex items-start justify-between gap-3">
                                                <div className="text-xs font-medium text-base-content/50">
                                                    {toClockLabel(log.recordedAt ?? log.createdAt)} 記録
                                                </div>
                                                <span className="badge badge-ghost shrink-0">
                                                    {log.durationMinutes
                                                        ? toHoursLabel(log.durationMinutes)
                                                        : '時間未設定'}
                                                </span>
                                            </div>

                                            <form action={updateWorkLogAction} className="space-y-2">
                                                <input type="hidden" name="month" value={monthText} />
                                                <input type="hidden" name="date" value={selectedDate} />
                                                <input type="hidden" name="logId" value={log.id} />

                                                <input
                                                    className="input input-bordered input-sm w-full"
                                                    type="text"
                                                    name="title"
                                                    defaultValue={log.title}
                                                    required
                                                />
                                                <input
                                                    className="input input-bordered input-sm w-full"
                                                    type="number"
                                                    name="durationMinutes"
                                                    defaultValue={log.durationMinutes ?? ''}
                                                    placeholder="作業時間（分）"
                                                    min={0}
                                                    max={1440}
                                                    step={1}
                                                />
                                                <input
                                                    className="input input-bordered input-sm w-full"
                                                    type="time"
                                                    name="workTime"
                                                    defaultValue={toTimeInputValue(log.recordedAt)}
                                                />
                                                <textarea
                                                    className="textarea textarea-bordered textarea-sm min-h-20 resize-none"
                                                    name="note"
                                                    defaultValue={log.note ?? ''}
                                                    placeholder="補足メモ（任意）"
                                                />

                                                <div className="flex items-center justify-between">
                                                    <button type="submit" className="btn btn-outline btn-xs">
                                                        更新
                                                    </button>

                                                    <button
                                                        type="submit"
                                                        formAction={deleteWorkLogAction}
                                                        className="btn btn-ghost btn-xs text-error"
                                                    >
                                                        削除
                                                    </button>
                                                </div>
                                            </form>

                                        </article>
                                    ))
                                )}
                            </div>

                            <form action={updateDayNoteAction} className="rounded-md border border-dashed border-base-300 p-3">
                                <input type="hidden" name="month" value={monthText} />
                                <input type="hidden" name="date" value={selectedDate} />

                                <div className="flex flex-col gap-2">
                                    <span className="text-sm font-semibold text-base-content/70">
                                        1日のメモ
                                    </span>
                                    <textarea
                                        className="textarea textarea-bordered min-h-28 resize-none w-full"
                                        name="dayNote"
                                        defaultValue={dayData?.dayNote ?? ''}
                                        placeholder="この日の全体メモを入力"
                                    />
                                </div>

                                <div className="flex justify-end mt-3">
                                    <button type="submit" className="btn btn-primary btn-sm">
                                        1日のメモを保存
                                    </button>
                                </div>
                            </form>

                        </div>
                    </aside>
                </section>
            </div>
        </main>
    );
}
