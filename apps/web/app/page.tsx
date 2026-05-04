import { cookies } from 'next/headers';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { LogoutButton } from '../components/auth/logout-button';
import { ThemeToggle } from '../components/theme/theme-toggle';

type CalendarDay = {
    id: string;
    date: number;
    isMuted?: boolean;
    isToday?: boolean;
    isSelected?: boolean;
    hours?: string;
    logCount?: number;
    memo?: boolean;
};

const weekdays = ['月', '火', '水', '木', '金', '土', '日'];

const calendarDays: CalendarDay[] = [
    { id: '2026-04-27', date: 27, isMuted: true },
    { id: '2026-04-28', date: 28, isMuted: true },
    { id: '2026-04-29', date: 29, isMuted: true },
    { id: '2026-04-30', date: 30, isMuted: true },
    { id: '2026-05-01', date: 1, hours: '6.0h', logCount: 3, memo: true },
    { id: '2026-05-02', date: 2 },
    { id: '2026-05-03', date: 3 },
    {
        id: '2026-05-04',
        date: 4,
        isToday: true,
        isSelected: true,
        hours: '7.5h',
        logCount: 4,
        memo: true,
    },
    { id: '2026-05-05', date: 5, hours: '5.0h', logCount: 2 },
    { id: '2026-05-06', date: 6, hours: '7.0h', logCount: 3, memo: true },
    { id: '2026-05-07', date: 7, hours: '6.5h', logCount: 3 },
    { id: '2026-05-08', date: 8, hours: '4.0h', logCount: 1 },
    { id: '2026-05-09', date: 9 },
    { id: '2026-05-10', date: 10 },
    { id: '2026-05-11', date: 11, hours: '7.0h', logCount: 3 },
    { id: '2026-05-12', date: 12, hours: '6.0h', logCount: 2, memo: true },
    { id: '2026-05-13', date: 13 },
    { id: '2026-05-14', date: 14 },
    { id: '2026-05-15', date: 15 },
    { id: '2026-05-16', date: 16 },
    { id: '2026-05-17', date: 17 },
    { id: '2026-05-18', date: 18 },
    { id: '2026-05-19', date: 19 },
    { id: '2026-05-20', date: 20 },
    { id: '2026-05-21', date: 21 },
    { id: '2026-05-22', date: 22 },
    { id: '2026-05-23', date: 23 },
    { id: '2026-05-24', date: 24 },
    { id: '2026-05-25', date: 25 },
    { id: '2026-05-26', date: 26 },
    { id: '2026-05-27', date: 27 },
    { id: '2026-05-28', date: 28 },
    { id: '2026-05-29', date: 29 },
    { id: '2026-05-30', date: 30 },
    { id: '2026-05-31', date: 31 },
];

const dayLogs = [
    {
        time: '09:30 - 11:00',
        title: '認証まわりの仕様確認',
        note: 'セッション Cookie の扱いと API 側の責務を確認。実装前にメモを残す。',
        category: '設計',
    },
    {
        time: '11:15 - 12:00',
        title: 'ログイン後トップの情報設計',
        note: '月カレンダーを主軸に、右側で日別記録を編集する方針に整理。',
        category: 'UI',
    },
    {
        time: '13:00 - 15:30',
        title: 'ワイヤーフレーム作成',
        note: '記録済み日、合計時間、メモ有無が一目で分かる表示を検討。',
        category: '実装',
    },
    {
        time: '16:00 - 17:30',
        title: '月次報告用の要約観点を整理',
        note: '次フェーズで集計・出力につなげられるようカテゴリと補足メモを分離。',
        category: '整理',
    },
];

export default async function HomePage() {
    const cookieStore = await cookies();
    const cookieName = process.env.NEXT_PUBLIC_SESSION_COOKIE_NAME ?? 'crow_session';
    const session = cookieStore.get(cookieName);

    if (!session) {
        redirect('/login');
    }

    return (
        <main className="app-shell px-4 py-4 text-base-content sm:px-6 lg:px-8">
            <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col gap-5">
                <header className="flex flex-col gap-4 border-b border-base-300/80 bg-base-100/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="rounded-full overflow-hidden w-14 h-14">
                                <Image
                                    src="/images/logo.webp"
                                    alt="Crow"
                                    width={56}
                                    height={56}
                                    className="scale-125"
                                />
                            </div>
                            <span className="badge badge-primary badge-outline">作業記録</span>
                        </div>
                        <p className="mt-1 text-sm text-base-content/60">
                            日々の作業ログを残し、月次の振り返りに使うためのログブックです。
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" className="btn btn-ghost btn-sm">
                            今日へ
                        </button>
                        <button type="button" className="btn btn-primary btn-sm">
                            記録を追加
                        </button>
                        <ThemeToggle />
                        <LogoutButton />
                    </div>
                </header>

                <section className="grid flex-1 items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_440px]">
                    <div className="rounded-lg border border-base-300 bg-base-100 shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-base-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs font-medium text-base-content/60">月表示</p>
                                <h1 className="text-xl font-semibold tracking-tight">2026年5月</h1>
                            </div>
                            <div className="join">
                                <button
                                    type="button"
                                    className="btn join-item btn-sm btn-outline"
                                    aria-label="前月"
                                >
                                    ←
                                </button>
                                <button type="button" className="btn join-item btn-sm btn-outline">
                                    今月
                                </button>
                                <button
                                    type="button"
                                    className="btn join-item btn-sm btn-outline"
                                    aria-label="翌月"
                                >
                                    →
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 border-b border-base-200 p-3 sm:grid-cols-4">
                            <div>
                                <p className="text-xs text-base-content/50">記録済み</p>
                                <p className="text-lg font-semibold">8日</p>
                            </div>
                            <div>
                                <p className="text-xs text-base-content/50">今月合計</p>
                                <p className="text-lg font-semibold">49.0h</p>
                            </div>
                            <div>
                                <p className="text-xs text-base-content/50">主なカテゴリ</p>
                                <p className="text-sm font-medium">設計 / UI / 実装</p>
                            </div>
                            <div>
                                <p className="text-xs text-base-content/50">メモあり</p>
                                <p className="text-lg font-semibold">4件</p>
                            </div>
                        </div>

                        <div className="p-2.5 sm:p-3">
                            <div className="grid grid-cols-7 border-b border-base-200 pb-2 text-center text-xs font-medium text-base-content/50">
                                {weekdays.map((weekday) => (
                                    <div key={weekday}>{weekday}</div>
                                ))}
                            </div>

                            <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-1.5">
                                {calendarDays.map((day) => {
                                    const hasRecord = day.hours || day.logCount || day.memo;

                                    return (
                                        <button
                                            type="button"
                                            key={day.id}
                                            className={[
                                                'relative aspect-square min-h-0 rounded-md border p-1 text-left transition hover:border-primary/60 hover:bg-primary/5 sm:aspect-auto sm:min-h-16 sm:p-1.5',
                                                day.isSelected
                                                    ? 'border-primary bg-primary/10 shadow-sm'
                                                    : 'border-base-200 bg-base-100',
                                                day.isMuted
                                                    ? 'text-base-content/30'
                                                    : 'text-base-content',
                                            ].join(' ')}
                                            aria-pressed={day.isSelected ? 'true' : 'false'}
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
                                                {day.memo ? (
                                                    <span className="h-2 w-2 rounded-full bg-accent sm:h-auto sm:w-auto sm:px-1.5 sm:py-0.5 sm:text-[10px] sm:font-medium sm:text-accent-content">
                                                        <span className="hidden sm:inline">
                                                            メモ
                                                        </span>
                                                    </span>
                                                ) : hasRecord ? (
                                                    <span className="h-2 w-2 rounded-full bg-primary/70 sm:hidden">
                                                        <span className="sr-only">記録あり</span>
                                                    </span>
                                                ) : null}
                                            </div>

                                            {hasRecord ? (
                                                <div className="mt-1 hidden space-y-0.5 sm:block">
                                                    {day.hours ? (
                                                        <p className="text-xs font-semibold text-base-content">
                                                            {day.hours}
                                                        </p>
                                                    ) : null}
                                                    {day.logCount ? (
                                                        <p className="text-[11px] text-base-content/60">
                                                            {day.logCount}件
                                                        </p>
                                                    ) : null}
                                                </div>
                                            ) : (
                                                <p className="mt-3 hidden text-[11px] text-base-content/35 sm:block">
                                                    未記録
                                                </p>
                                            )}
                                        </button>
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
                                        5月4日 月曜日
                                    </h2>
                                </div>
                                <span className="badge badge-primary">7.5h</span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-base-content/65">
                                右ペインで選択日の記録を確認し、時間帯ごとの作業内容と補足メモを残します。
                            </p>
                        </div>

                        <div className="space-y-4 p-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-base-content/70">
                                    作業ログ
                                </h3>
                                <button type="button" className="btn btn-outline btn-xs">
                                    追加
                                </button>
                            </div>

                            <div className="space-y-3">
                                {dayLogs.map((log) => (
                                    <article
                                        key={log.time}
                                        className="rounded-md border border-base-200 p-3"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-medium text-base-content/50">
                                                    {log.time}
                                                </p>
                                                <h4 className="mt-1 font-semibold leading-snug">
                                                    {log.title}
                                                </h4>
                                            </div>
                                            <span className="badge badge-ghost shrink-0">
                                                {log.category}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-sm leading-6 text-base-content/65">
                                            {log.note}
                                        </p>
                                    </article>
                                ))}
                            </div>

                            <div className="rounded-md border border-dashed border-base-300 p-3">
                                <label className="form-control gap-2">
                                    <span className="text-sm font-semibold text-base-content/70">
                                        1日のメモ
                                    </span>
                                    <textarea
                                        className="textarea textarea-bordered min-h-28 resize-none"
                                        defaultValue="UI はタスク管理ではなく作業日誌として見せる。月末に読み返しやすい粒度で、時間帯と補足メモを分けて入力できるとよい。"
                                    />
                                </label>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button type="button" className="btn btn-primary">
                                    保存
                                </button>
                                <button type="button" className="btn btn-ghost">
                                    下書きに戻す
                                </button>
                            </div>
                        </div>
                    </aside>
                </section>
            </div>
        </main>
    );
}
