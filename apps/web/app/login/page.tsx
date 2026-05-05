import Link from 'next/link';
import Image from 'next/image';
import { LoginForm } from '../../components/auth/login-form';

type Props = {
    searchParams: Promise<{ invited?: string; reset?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
    const { invited, reset } = await searchParams;

    return (
        <main className="app-shell flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-md space-y-5">
                <div className="space-y-2 text-center">
                    <div className="flex justify-center">
                        <div className="w-28 h-28">
                            <Image
                                src="/images/logo.webp"
                                alt="Crow"
                                width={112}
                                height={112}
                                priority
                                unoptimized
                            />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">ログイン</h1>
                    <p className="text-sm text-base-content/60">
                        作業記録を、安全に・すばやく始めましょう。
                    </p>
                    <p className="text-xs text-base-content/50">
                        <Link href="/forgot-password" className="link link-primary">
                            パスワードをお忘れですか？
                        </Link>
                    </p>
                </div>

                {invited === '1' ? (
                    <div className="alert alert-success py-3 text-sm" role="status">
                        <span>アカウントを作成しました。メールアドレスとパスワードでログインしてください。</span>
                    </div>
                ) : null}

                {reset === '1' ? (
                    <div className="alert alert-success py-3 text-sm" role="status">
                        <span>パスワードを変更しました。新しいパスワードでログインしてください。</span>
                    </div>
                ) : null}

                <LoginForm />
            </div>
        </main>
    );
}
