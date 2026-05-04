import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login'];

export function proxy(request: NextRequest) {
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
    const hasSession = Boolean(request.cookies.get(cookieName)?.value);
    const isPublicPath = PUBLIC_PATHS.some(
        (path) => pathname === path || pathname.startsWith(`${path}/`),
    );

    // 未ログインで保護ページにアクセスした場合のみ /login へ遷移
    if (!hasSession && !isPublicPath) {
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }

    // すでにログイン済みなら /login への再訪を防ぎ、アプリトップへ戻す
    if (hasSession && pathname === '/login') {
        const appUrl = new URL('/', request.url);
        return NextResponse.redirect(appUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api).*)'],
};