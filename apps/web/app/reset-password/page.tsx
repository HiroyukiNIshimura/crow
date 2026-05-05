import { redirect } from 'next/navigation';
import { ResetPasswordForm } from '../../components/auth/reset-password-form';

export const metadata = {
    title: 'パスワード変更 | Crow',
};

type Props = {
    searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
    const { token } = await searchParams;

    if (!token) {
        redirect('/forgot-password');
    }

    return (
        <main className="app-shell flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-md space-y-5">
                <div className="space-y-2 text-center">
                    <h1 className="text-2xl font-bold tracking-tight">新しいパスワードを設定</h1>
                    <p className="text-sm text-base-content/60">
                        8文字以上の新しいパスワードを入力してください。
                    </p>
                </div>

                <ResetPasswordForm token={token} />
            </div>
        </main>
    );
}
