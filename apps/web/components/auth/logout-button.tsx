'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** document.cookie から指定名の Cookie 値を取得する */
function getCookieValue(name: string): string | undefined {
    const prefix = `${name}=`;
    for (const part of document.cookie.split(';')) {
        const trimmed = part.trim();
        if (trimmed.startsWith(prefix)) {
            return trimmed.slice(prefix.length);
        }
    }
    return undefined;
}

export function LogoutButton() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleLogout() {
        setLoading(true);
        setError(null);

        const csrfCookieName = process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME ?? 'csrf_token';
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

        try {
            const csrfToken = getCookieValue(csrfCookieName);
            const res = await fetch(`${apiUrl}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
                },
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                setError((body as { message?: string }).message ?? 'ログアウトに失敗しました。');
                return;
            }

            router.push('/login');
            router.refresh();
        } catch {
            setError('ネットワークエラーが発生しました。');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleLogout}
                disabled={loading}
                aria-busy={loading}
            >
                {loading ? (
                    <span className="loading loading-spinner loading-xs" aria-hidden="true" />
                ) : null}
                ログアウト
            </button>
            {error ? (
                <p role="alert" className="mt-1 text-xs text-error">
                    {error}
                </p>
            ) : null}
        </div>
    );
}
