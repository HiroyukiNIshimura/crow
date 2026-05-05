import Link from 'next/link';
import { redirect } from 'next/navigation';
import { InviteForm } from '../../../components/admin/invite-form';
import { getCurrentUser } from '../../lib/auth';

export default async function AdminInvitePage() {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
        redirect('/login');
    }

    if (currentUser.role !== 'admin') {
        redirect('/');
    }

    return (
        <main className="app-shell flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-lg space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">ユーザーを招待</h1>
                        <p className="mt-1 text-sm text-base-content/60">
                            招待リンクをメールで送信します。リンクは{' '}
                            {process.env.NEXT_PUBLIC_INVITATION_EXPIRE_HOURS ?? '48'}{' '}
                            時間で有効期限が切れます。
                        </p>
                    </div>
                    <Link href="/" className="btn btn-ghost btn-sm">
                        ← 戻る
                    </Link>
                </div>

                <section className="card border border-base-200 bg-base-100 shadow-sm">
                    <div className="card-body px-6 py-10 sm:px-8 sm:py-12">
                        <InviteForm />
                    </div>
                </section>
            </div>
        </main>
    );
}
