import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AdminTabNav } from '../../../components/admin/admin-tab-nav';
import { InviteForm } from '../../../components/admin/invite-form';
import { getAdminUsers, updateUserActiveAction } from '../../actions/admin-actions';
import { getCurrentUser } from '../../lib/auth';

type AdminInvitePageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(value: string | string[] | undefined) {
    if (typeof value === 'string') {
        return value;
    }

    if (Array.isArray(value) && value.length > 0) {
        return value[0];
    }

    return null;
}

export default async function AdminInvitePage({ searchParams }: AdminInvitePageProps) {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
        redirect('/login');
    }

    if (currentUser.role !== 'admin') {
        redirect('/');
    }

    const rawSearchParams = (await searchParams) ?? {};
    const currentTab = getSingleParam(rawSearchParams.tab) ?? 'invite';
    const errorMessage = getSingleParam(rawSearchParams.error);
    const successMessage = getSingleParam(rawSearchParams.success);

    const users = currentTab === 'users' ? await getAdminUsers() : [];

    return (
        <main className="app-shell flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-4xl space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold tracking-tight">管理者メニュー</h1>
                    <Link href="/" className="btn btn-ghost btn-sm">
                        ← 戻る
                    </Link>
                </div>

                {successMessage ? (
                    <div
                        className="alert alert-success py-3 text-sm"
                        role="status"
                        aria-live="polite"
                    >
                        <span>{successMessage}</span>
                    </div>
                ) : null}

                {errorMessage ? (
                    <div className="alert alert-error py-3 text-sm" role="alert" aria-live="polite">
                        <span>{errorMessage}</span>
                    </div>
                ) : null}

                <div className="card border border-base-200 bg-base-100 shadow-sm">
                    <div className="px-6 pt-6 sm:px-8">
                        <Suspense>
                            <AdminTabNav />
                        </Suspense>
                    </div>

                    {currentTab === 'invite' ? (
                        <div className="px-6 py-8 sm:px-8 sm:py-10">
                            <div className="mb-6">
                                <h2 className="text-lg font-semibold tracking-tight">
                                    招待リンクを送信
                                </h2>
                                <p className="mt-1 text-sm text-base-content/60">
                                    招待リンクをメールで送信します。リンクは{' '}
                                    {process.env.NEXT_PUBLIC_INVITATION_EXPIRE_HOURS ?? '48'}{' '}
                                    時間で有効期限が切れます。
                                </p>
                            </div>
                            <InviteForm />
                        </div>
                    ) : (
                        <div className="px-6 py-6 sm:px-8">
                            <div className="mb-4">
                                <h2 className="text-lg font-semibold tracking-tight">
                                    登録ユーザー一覧
                                </h2>
                                <p className="mt-1 text-sm text-base-content/60">
                                    無効化すると、現在のログインセッションも即時失効します。
                                </p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="table table-zebra">
                                    <thead>
                                        <tr>
                                            <th>表示名</th>
                                            <th>メール</th>
                                            <th>ロール</th>
                                            <th>状態</th>
                                            <th className="text-right">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((user) => {
                                            const isSelf = user.id === currentUser.id;
                                            const nextIsActive = user.isActive ? 'false' : 'true';

                                            return (
                                                <tr key={user.id}>
                                                    <td>
                                                        <span
                                                            className={
                                                                user.isActive ? '' : 'opacity-40'
                                                            }
                                                        >
                                                            {user.displayName}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span
                                                            className={
                                                                user.isActive ? '' : 'opacity-40'
                                                            }
                                                        >
                                                            {user.email}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="badge badge-outline">
                                                            {user.role === 'admin'
                                                                ? '管理者'
                                                                : 'メンバー'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span
                                                            className={`badge ${
                                                                user.isActive
                                                                    ? 'badge-success badge-outline'
                                                                    : 'badge-error badge-outline'
                                                            }`}
                                                        >
                                                            {user.isActive ? '有効' : '無効'}
                                                        </span>
                                                    </td>
                                                    <td className="text-right">
                                                        <form action={updateUserActiveAction}>
                                                            <input
                                                                type="hidden"
                                                                name="userId"
                                                                value={user.id}
                                                            />
                                                            <input
                                                                type="hidden"
                                                                name="nextIsActive"
                                                                value={nextIsActive}
                                                            />
                                                            <button
                                                                type="submit"
                                                                className={`btn btn-sm ${
                                                                    user.isActive
                                                                        ? 'btn-outline btn-error'
                                                                        : 'btn-outline btn-success'
                                                                }`}
                                                                disabled={isSelf}
                                                                title={
                                                                    isSelf
                                                                        ? '自分自身は無効化できません'
                                                                        : undefined
                                                                }
                                                            >
                                                                {user.isActive
                                                                    ? '無効化'
                                                                    : '有効化'}
                                                            </button>
                                                        </form>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
