---
description: "Crow プロジェクトの Cookie ベースセッション認証の実装ガイド。Guard、DTO、Middleware、SessionStore の具体的なコード例を含みます。認証機能の追加・修正時に使用してください。"
name: "認証実装ガイド"
applyTo: apps/api/src/auth/**, apps/web/proxy.ts, apps/web/app/**/*.tsx
---

# 認証実装ガイド

Crow の認証システムは Cookie ベースのサーバー管理セッションを採用しています。このガイドは、NestJS Guard・DTO、Next.js Middleware の実装パターンを提供します。

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────┐
│ Browser                                                       │
│  └─ Secure HttpOnly Cookie (sessionId)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
   ┌────▼────────────┐        ┌──────▼───────────┐
   │ Next.js (BFF)   │        │ NestJS API       │
   │ - Auth Check    │        │ - Session Verify │
   │ - Route Guard   │        │ - Authorize      │
   │ - SSR Context   │        │ - Business Logic │
   └─────────────────┘        └──────────────────┘
        │                             │
        └──────────────┬──────────────┘
                       │
                ┌──────▼──────────┐
                │ PostgreSQL      │
                │  - users table  │
                │  - sessions tbl │
                └─────────────────┘
```

## NestJS 実装パターン

### 1. SessionStore Service

`apps/api/src/auth/session-store.service.ts` で session のライフサイクルを管理します。

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@crow/database';

export interface SessionData {
  userId: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class SessionStoreService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Session を作成し、sessionId を返す
   */
  async createSession(userId: string, email: string): Promise<string> {
    const sessionId = this.generateSessionId();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24時間

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId,
        email,
        expiresAt,
      },
    });

    return sessionId;
  }

  /**
   * SessionId から session データを取得
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) return null;

    // 失効チェック
    if (new Date() > session.expiresAt) {
      await this.deleteSession(sessionId);
      return null;
    }

    return {
      userId: session.userId,
      email: session.email,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Session を削除（ログアウト時）
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.prisma.session.delete({
      where: { id: sessionId },
    });
  }

  /**
   * SessionId を生成
   */
  private generateSessionId(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }
}
```

### 2. DTO（Data Transfer Object）

`apps/api/src/auth/dto/login.dto.ts`

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class LogoutDto {
  // ログアウトはボディ不要、Cookie から sessionId を取得
}
```

### 3. Auth Guard

Cookie から sessionId を抽出し、session を検証する Guard を実装します。

```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SessionStoreService } from './session-store.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private sessionStore: SessionStoreService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const sessionId = this.extractSessionId(request);

    if (!sessionId) {
      throw new UnauthorizedException('Session not found');
    }

    const session = await this.sessionStore.getSession(sessionId);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Request にユーザー情報を附設
    request.user = {
      userId: session.userId,
      email: session.email,
    };

    return true;
  }

  private extractSessionId(request: any): string | null {
    const cookies = request.cookies || {};
    return cookies['sessionId'] || null;
  }
}
```

### 4. Auth Controller

`apps/api/src/auth/auth.controller.ts`

```typescript
import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SessionGuard } from './session.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /api/auth/login
   * ログイン処理、Cookie に sessionId を設定
   */
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() loginDto: LoginDto,
    @Res() response: Response,
  ): Promise<void> {
    const sessionId = await this.authService.login(loginDto);

    // Secure Cookie に sessionId を設定
    response.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // 本番で HTTPS 強制
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24時間
      path: '/',
    });

    response.json({ success: true, message: 'Logged in successfully' });
  }

  /**
   * POST /api/auth/logout
   * ログアウト処理、Cookie を削除
   */
  @Post('logout')
  @UseGuards(SessionGuard)
  @HttpCode(200)
  async logout(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    await this.authService.logout(request.cookies.sessionId);

    // Cookie を削除
    response.clearCookie('sessionId', { path: '/' });
    response.json({ success: true, message: 'Logged out successfully' });
  }

  /**
   * GET /api/auth/me
   * 現在のユーザー情報を返す（認証が必要）
   */
  @Post('me')
  @UseGuards(SessionGuard)
  me(@Req() request: Request): any {
    return {
      userId: request.user.userId,
      email: request.user.email,
    };
  }
}
```

### 5. Auth Service

`apps/api/src/auth/auth.service.ts`

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaClient } from '@crow/database';
import { SessionStoreService } from './session-store.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaClient,
    private sessionStore: SessionStoreService,
  ) {}

  /**
   * ログイン処理
   */
  async login(loginDto: LoginDto): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // パスワード検証（bcrypt）
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Session を作成
    const sessionId = await this.sessionStore.createSession(user.id, user.email);
    return sessionId;
  }

  /**
   * ログアウト処理
   */
  async logout(sessionId: string): Promise<void> {
    await this.sessionStore.deleteSession(sessionId);
  }
}
```

### 6. Auth Module

`apps/api/src/auth/auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionStoreService } from './session-store.service';
import { PrismaClient } from '@crow/database';

@Module({
  imports: [],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionStoreService,
    {
      provide: PrismaClient,
      useValue: new PrismaClient(),
    },
  ],
  exports: [SessionStoreService], // 他のモジュールで使用可能に
})
export class AuthModule {}
```

## Next.js 実装パターン

### 1. Proxy（全体ルート保護）

`apps/web/proxy.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

// 認証不要なルート
const publicRoutes = ['/login', '/api/auth/login'];

export async function proxy(request: NextRequest) {
  const sessionId = request.cookies.get('sessionId')?.value;
  const pathname = request.nextUrl.pathname;

  // 公開ルートはそのまま通す
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Session がない場合は /login へリダイレクト
  if (!sessionId) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Session の検証（オプション: API を呼んで検証）
  // const session = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
  //   headers: { Cookie: `sessionId=${sessionId}` },
  // }).then(r => r.json()).catch(() => null);
  //
  // if (!session) {
  //   return NextResponse.redirect(new URL('/login', request.url));
  // }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### 2. Server Component でのセッション取得

`apps/web/app/layout.tsx`

```typescript
import { cookies } from 'next/headers';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('sessionId')?.value;

  // 必要に応じてサーバーで session 情報を取得
  let currentUser = null;
  if (sessionId) {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/me`,
        {
          headers: { Cookie: `sessionId=${sessionId}` },
          credentials: 'include',
        },
      );
      currentUser = await response.json();
    } catch (error) {
      console.error('Failed to fetch current user:', error);
    }
  }

  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
```

### 3. ログインフォーム

`apps/web/components/auth/login-form.tsx`

```typescript
'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          credentials: 'include', // Cookie を送信・受信
        },
      );

      if (!response.ok) {
        throw new Error('Login failed');
      }

      // ログイン成功、ホームページへリダイレクト
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-2 border rounded"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-4 py-2 border rounded"
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

## セキュリティチェックリスト

- [ ] Cookie に `HttpOnly` フラグを設定（JavaScript からアクセス不可）
- [ ] 本番環境で `Secure` フラグを有効化（HTTPS 強制）
- [ ] `SameSite=Strict` でクロスサイトリクエスト対策
- [ ] パスワードは bcrypt でハッシュ化して保存
- [ ] Session ID は暗号学的に安全な乱数生成
- [ ] Session の有効期限を設定（推奨: 24-48 時間）
- [ ] ログアウト時に Cookie と DB session を確実に削除
- [ ] 本番環境では HTTPS 必須

## トラブルシューティング

| 問題 | 原因 | 解決方法 |
|-----|-----|--------|
| ログイン後も Cookie が見えない | `HttpOnly` が正しく設定されている | 正常な動作。DevTools では見えません |
| ログイン後もリダイレクトされる | Session が検証されていない | Proxy の session 検証ロジックを確認 |
| CORS エラーが出る | Cross-origin リクエストで credentials が不足 | `credentials: 'include'` を fetch に追加 |
| Session が直後に失効する | 有効期限が短すぎる | `maxAge` の値を確認（ミリ秒） |
