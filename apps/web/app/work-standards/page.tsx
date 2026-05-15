import Link from 'next/link';
import { redirect } from 'next/navigation';
import { WorkStandardForm } from '../../components/work-standards/work-standard-form';
import { getWorkStandard } from '../actions/work-standards-actions';
import { getCurrentUser } from '../lib/auth';

export const metadata = {
    title: '稼働基準時間 | Crow',
};

type Props = {
    searchParams: Promise<{ year?: string; month?: string }>;
};

export default async function WorkStandardsPage({ searchParams }: Props) {
    const user = await getCurrentUser();
    if (!user) {
        redirect('/login');
    }

    const params = await searchParams;
    const now = new Date();
    const year = params.year ? Number(params.year) : now.getFullYear();
    const month = params.month ? Number(params.month) : now.getMonth() + 1;

    const standard = await getWorkStandard(year, month);

    const prevDate = new Date(year, month - 2, 1);
    const nextDate = new Date(year, month, 1);

    return (
        <main className="app-shell px-4 py-8">
            <div className="mx-auto w-full max-w-md space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold tracking-tight">稼働基準時間</h1>
                    <Link href="/" className="btn btn-ghost btn-sm">
                        ← 戻る
                    </Link>
                </div>

                {/* 月ナビゲーション */}
                <div className="flex items-center justify-between">
                    <Link
                        href={`/work-standards?year=${prevDate.getFullYear()}&month=${prevDate.getMonth() + 1}`}
                        className="btn btn-ghost btn-sm"
                    >
                        ← 前月
                    </Link>
                    <span className="text-lg font-semibold">
                        {year}年{month}月
                    </span>
                    <Link
                        href={`/work-standards?year=${nextDate.getFullYear()}&month=${nextDate.getMonth() + 1}`}
                        className="btn btn-ghost btn-sm"
                    >
                        次月 →
                    </Link>
                </div>

                {/* 現在の設定サマリー */}
                {standard ? (
                    <div className="alert alert-info py-3 text-sm">
                        <span>
                            現在の設定：{standard.workDaysInMonth} 日 × {standard.hoursPerDay} 時間
                            = <strong>月間基準 {standard.totalHours} 時間</strong>
                        </span>
                    </div>
                ) : (
                    <div className="alert alert-warning py-3 text-sm">
                        <span>
                            {year}年{month}月の稼働基準時間が未設定です。
                        </span>
                    </div>
                )}

                {/* 設定フォーム */}
                <section className="card border border-base-200 bg-base-100 shadow">
                    <div className="card-body gap-5 p-5 sm:p-7">
                        <h2 className="card-title text-base">基準時間を設定</h2>
                        <WorkStandardForm year={year} month={month} current={standard} />
                    </div>
                </section>
            </div>
        </main>
    );
}
