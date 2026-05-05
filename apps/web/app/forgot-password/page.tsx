import { ForgotPasswordForm } from '../../components/auth/forgot-password-form';

export const metadata = {
    title: 'パスワード再設定 | Crow',
};

export default function ForgotPasswordPage() {
    return (
        <main className="app-shell flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-md space-y-5">
                <div className="space-y-2 text-center">
                    <h1 className="text-2xl font-bold tracking-tight">パスワードをお忘れですか？</h1>
                    <p className="text-sm text-base-content/60">
                        登録済みのメールアドレスを入力してください。
                        パスワード再設定用のリンクを送信します。
                    </p>
                </div>

                <ForgotPasswordForm />
            </div>
        </main>
    );
}
