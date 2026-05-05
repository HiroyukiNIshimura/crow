import { redirect } from 'next/navigation';
import { ChangePasswordForm } from '../../components/auth/change-password-form';
import { getCurrentUser } from '../lib/auth';

export const metadata = {
    title: 'パスワード変更 | Crow',
};

export default async function ChangePasswordPage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect('/login');
    }

    return (
        <main className="app-shell flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-md space-y-5">
                <div className="space-y-2 text-center">
                    <h1 className="text-2xl font-bold tracking-tight">パスワード変更</h1>
                    <p className="text-sm text-base-content/60">
                        現在のパスワードを確認した上で新しいパスワードを設定します。
                    </p>
                </div>

                <ChangePasswordForm />
            </div>
        </main>
    );
}
