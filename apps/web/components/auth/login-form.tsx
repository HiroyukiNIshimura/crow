'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const defaultApiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const showDemoCredentials = process.env.NODE_ENV !== 'production';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      setError('メールアドレスとパスワードを入力してください。');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`${defaultApiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        if (response.status === 401) {
          throw new Error(payload?.message ?? 'メールアドレスまたはパスワードが正しくありません。');
        }

        if (response.status >= 500) {
          throw new Error('サーバーでエラーが発生しました。時間をおいて再度お試しください。');
        }

        throw new Error(payload?.message ?? 'ログインに失敗しました。入力内容をご確認ください。');
      }

      router.replace('/');
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof TypeError
          ? 'ネットワークに接続できませんでした。接続状況を確認してください。'
          : submitError instanceof Error
            ? submitError.message
            : '不明なエラーが発生しました。';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="card border border-base-200 bg-base-100 shadow-2xl">
      <div className="card-body gap-5 p-5 sm:p-7">
        {showDemoCredentials ? (
          <div className="rounded-2xl bg-base-200/70 p-4 text-sm text-base-content/70">
            <p className="font-medium text-base-content">開発用デモアカウント</p>
            <p className="mt-1">email: admin@example.com</p>
            <p>password: password123!</p>
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="form-control w-full gap-2">
            <span className="label-text text-sm font-medium">メールアドレス</span>
            <input
              className="input input-bordered w-full"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={(event) => setEmail(event.target.value.trim())}
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="form-control w-full gap-2">
            <span className="label-text text-sm font-medium">パスワード</span>
            <input
              className="input input-bordered w-full"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
          </label>

          {error ? (
            <div className="alert alert-error py-3 text-sm" role="status" aria-live="polite">
              <span>{error}</span>
            </div>
          ) : null}

          <button className="btn btn-primary btn-block" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>
      </div>
    </section>
  );
}