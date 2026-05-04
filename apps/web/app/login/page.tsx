import { LoginForm } from '../../components/auth/login-form';

export default function LoginPage() {
  return (
    <main className="app-shell flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-5">
        <div className="space-y-2 text-center">
          <div className="badge badge-primary badge-outline">Crow</div>
          <h1 className="text-3xl font-bold tracking-tight">ログイン</h1>
          <p className="text-sm text-base-content/60">
            作業記録を、安全に・すばやく始めましょう。
          </p>
          <p className="text-xs text-base-content/50">
            パスワード再設定は現在準備中です。問題がある場合は管理者にお問い合わせください。
          </p>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}