'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const defaultApiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('password123!');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${defaultApiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? 'ログインに失敗しました。');
      }

      router.replace('/');
      router.refresh();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : '不明なエラーが発生しました。';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="card border border-base-200 bg-base-100 shadow-2xl">
      <div className="card-body gap-5 p-5 sm:p-7">
        <div className="rounded-2xl bg-base-200/70 p-4 text-sm text-base-content/70">
          <p className="font-medium text-base-content">開発用デモアカウント</p>
          <p className="mt-1">email: admin@example.com</p>
          <p>password: password123!</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="form-control w-full gap-2">
            <span className="label-text text-sm font-medium">メールアドレス</span>
            <input
              className="input input-bordered w-full"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
            <div className="alert alert-error py-3 text-sm">
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