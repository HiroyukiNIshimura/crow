import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LogoutButton } from '../components/auth/logout-button';

export default async function HomePage() {
  const cookieStore = await cookies();
  const cookieName = process.env.NEXT_PUBLIC_SESSION_COOKIE_NAME ?? 'crow_session';
  const session = cookieStore.get(cookieName);

  if (!session) {
    redirect('/login');
  }

  const today = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date());

  return (
    <main className="app-shell px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col gap-4">
        <header className="flex items-center justify-between">
          <span className="text-lg font-semibold">Crow</span>
          <LogoutButton />
        </header>

        <section className="card border border-base-200 bg-base-100 shadow-xl">
          <div className="card-body gap-3">
            <div>
              <p className="text-sm text-base-content/60">今日の記録</p>
              <h1 className="text-2xl font-bold">{today}</h1>
            </div>
            <div className="rounded-2xl bg-primary/10 p-4 text-sm leading-6 text-base-content/80">
              カレンダー UI 本体は次フェーズで追加予定です。今はログイン後の着地点として、
              「今日の作業を書く」体験の入口だけを用意しています。
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" className="btn btn-primary">作業を追加</button>
              <button type="button" className="btn btn-outline">月表示を見る</button>
            </div>
          </div>
        </section>

        <section className="card border border-base-200 bg-base-100 shadow-lg">
          <div className="card-body gap-4">
            <h2 className="card-title text-lg">初期スタブに含めたもの</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-base-content/70">
              <li>モバイルファーストな UI ベース</li>
              <li>NestJS + Fastify の認証 API スタブ</li>
              <li>PostgreSQL を前提にした Prisma schema</li>
              <li>Cookie ベースのサーバー管理セッション方針に沿った構成</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}