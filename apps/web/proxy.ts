import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login'];

async function verifySession(cookieName: string, token: string) {
    const apiUrl = process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
        return false;
    }

    try {
        const response = await fetch(`${apiUrl}/auth/session`, {
            method: 'GET',
            headers: {
                Cookie: `${cookieName}=${encodeURIComponent(token)}`,
            },
            cache: 'no-store',
        });

        return response.ok;
    } catch {
        return false;
    }
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 静的アセットは認証判定を通さずにそのまま返す
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname.startsWith('/images')
    ) {
        return NextResponse.next();
    }

    const cookieName = process.env.NEXT_PUBLIC_SESSION_COOKIE_NAME ?? 'crow_session';
    const sessionToken = request.cookies.get(cookieName)?.value;
    const hasSession = Boolean(sessionToken);
    const isPublicPath = PUBLIC_PATHS.some(
        (path) => pathname === path || pathname.startsWith(`${path}/`),
    );

    const hasValidSession =
        hasSession && sessionToken ? await verifySession(cookieName, sessionToken) : false;

    // 未ログインで保護ページにアクセスした場合のみ /login へ遷移
    if ((!hasSession || !hasValidSession) && !isPublicPath) {
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }

    // すでにログイン済みなら /login への再訪を防ぎ、アプリトップへ戻す
    if (hasValidSession && pathname === '/login') {
        const appUrl = new URL('/', request.url);
        return NextResponse.redirect(appUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api).*)'],
};
