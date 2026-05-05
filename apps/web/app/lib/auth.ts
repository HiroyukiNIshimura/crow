import { cookies } from 'next/headers';

const defaultApiUrl =
    process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type CurrentUser = {
    id: string;
    email: string;
    displayName: string;
    role: 'admin' | 'member';
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
    const cookieStore = await cookies();
    const sessionCookieName = process.env.NEXT_PUBLIC_SESSION_COOKIE_NAME ?? 'crow_session';
    const sessionToken = cookieStore.get(sessionCookieName)?.value;

    if (!sessionToken) {
        return null;
    }

    try {
        const response = await fetch(`${defaultApiUrl}/auth/session`, {
            headers: {
                Cookie: `${sessionCookieName}=${encodeURIComponent(sessionToken)}`,
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            return null;
        }

        return (await response.json()) as CurrentUser;
    } catch {
        return null;
    }
}
