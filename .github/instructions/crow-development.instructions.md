---
description: "Crow プロジェクト全体の開発ガイド。Monorepo 構成、NestJS・Next.js・Prisma の統合、Cookie ベースの認証実装、Biome コーディング規約を対象にします。API・Web・Database パッケージの開発時に使用してください。"
name: "Crow 開発指南"
applyTo: apps/**, packages/**, *.ts, *.tsx
---

# Crow 開発指南

Crow は、社内向けカレンダーベースの作業記録管理アプリです。このファイルは、API・Web・Database の各層での開発規約と実装ガイドを定義します。

## プロジェクト構成

### Monorepo 構成

```
crow (root)
├── apps/web          # Next.js 16 + React 19 + TypeScript
├── apps/api          # NestJS v11 + Fastify
├── packages/database # Prisma スキーマ・マイグレーション共有
├── biome.json        # 全体の Formatter / Linter 規約
├── tsconfig.base.json # TS 基本設定
└── package.json      # npm workspaces 定義
```

- **npm workspaces** を使用：`apps/*`, `packages/*` がワークスペース
- 各ワークスペースは独立した `package.json` を持つ
- パッケージ参照は **`file:` プロトコル**を使用：`"@crow/database": "file:../../packages/database"`
  - npm は `workspace:*` プロトコルを解決できないため使用禁止（`EUNSUPPORTEDPROTOCOL` エラーが発生する）

### 主要スタック

| 層 | 技術 | 役割 |
|-----|------|------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, daisyUI | ログイン UI、ページレンダリング、セッション管理 |
| API | NestJS v11, Fastify, `@fastify/rate-limit` | RESTful API、認可チェック、ビジネスロジック |
| Database | PostgreSQL 18 | データ永続化 |
| ORM | Prisma v7（adapter-first） | スキーマ管理、型安全データベース操作 |

> **Prisma v7 注意**: `PrismaClient` の初期化には `@prisma/adapter-pg`（`pg` パッケージ）が必須です。adapter なしでは DB 接続できません（後述）。

## 認証方針

### 推奨パターン

**Cookie ベースのサーバー管理セッション認証** を採用しています。

- ブラウザから **Secure HttpOnly Cookie** で `sessionId` を送信
- サーバー側で session table に対して検証
- **JWT / localStorage は非推奨**（複雑さ・セキュリティリスク）
- 強制ログアウト、セッション失効が単純に実装できる

### 実装パターン

#### Pattern A: Next.js が BFF（推奨）

```
Browser --[Secure Cookie]--> Next.js --[認証確認]--> NestJS API
                            (Session 検証)          (信頼済みコンテキスト受取)
```

- Next.js が session を検証、ユーザー認可判定
- NestJS は Next.js を信頼できる内部クライアントとして扱う
- 最も UI 中心の構成

#### Pattern B: ブラウザが直接 API に送信

```
Browser --[Secure Cookie]--> NestJS API
                            (Session 検証)
```

- Same-site 環境で実装経路を短くしたい場合
- 制約が少なく、より迅速な実装が可能

### 実装時の注意

- `HttpOnly` Cookie を必ず使用（JavaScript からのアクセス禁止）
- `Secure` フラグを本番で有効化（HTTPS 強制）
- `SameSite=Strict` でクロスサイトリクエスト対策

## 開発ワークフロー

### 環境構築

#### 1. 依存パッケージをインストール

```bash
npm install
```

#### 2. PostgreSQL を Docker で起動（必須）

```bash
npm run docker:up
```

- PostgreSQL 18 が `localhost:5432` で起動
- 自動的に `crow` データベースが作成される
- `.env` の `DATABASE_URL` と一致

ログを確認する場合：

```bash
npm run docker:logs
```

停止する場合：

```bash
npm run docker:down
```

#### 3. Prisma クライアント生成

```bash
npm run db:generate
```

- `packages/database/prisma/schema.prisma` から型を生成
- **変更後は毎回実行する**（型安全性が保証される）

#### 4. データベーススキーマをマイグレーション

```bash
npm run db:migrate
```

- 初回実行時は全マイグレーション適用
- 以降、スキーマ変更時に実行

#### 5. 環境変数設定（必要に応じて）

- `.env` ファイルは root に配置済み
- デフォルト値で動作する
- カスタマイズが必要な場合は編集

### 開発サーバー起動

```bash
npm run dev
```

- **concurrently** で Next.js と NestJS を同時起動
- `.env` が shell sourcing で読み込まれる（root の dev-api / dev-web スクリプト参照）

### ビルド・検証

| コマンド | 用途 |
|---------|------|
| `npm run build` | すべてのワークスペースをビルド |
| `npm run build -w @crow/web` | Web のみビルド |
| `npm run build -w @crow/api` | API のみビルド |
| `npm run typecheck` | TypeScript 型チェック |
| `npm run lint` | Biome リント（規約チェック） |
| `npm run lint:fix` | 自動修正 |
| `npm run format` | コード整形 |
| `npm run db:generate` | Prisma 型生成 |

## コーディング規約（Biome）

### 全体ルール

**Biome v2.4.14** で統一的にフォーマット・リントを実施。

```json
"formatter": {
    "indentWidth": 4,           // 4 スペスインデント
    "lineWidth": 100,           // 100 文字でラップ
    "lineEnding": "lf"          // Unix 改行
}
```

#### JavaScript / TypeScript

- `quoteStyle: "single"` - シングルクォート推奨
- `trailingCommas: "all"` - 末尾カンマ推奨
- `semicolons: "always"` - セミコロン必須
- `noUnusedVariables` - エラー（未使用変数禁止）
- `noUnusedImports` - エラー（未使用インポート禁止）
- `noVar` - エラー（const/let のみ）
- `useConst` - エラー（再代入不可は const）

#### API (apps/api) 特有ルール

```
- noUnusedFunctionParameters: off
  → NestJS の Dependency Injection で引数が自動注入される場合を許容
- useImportType: off
  → Decorator や reflect-metadata との相性を考慮
```

#### Web (apps/web) 特有ルール

```
- useExhaustiveDependencies: warn
  → React hooks の依存性配列チェック
```

### 使用方法

```bash
# 修正提案を表示
npm run lint

# 自動修正を適用
npm run lint:fix

# 包括的チェック（format + lint）
npm run check:fix
```

## パッケージ別ガイドライン

### @crow/web (Next.js)

#### ディレクトリ構造

```
apps/web/
├── app/                   # App Router
│   ├── actions/           # Server Actions
│   │   ├── cookie-relay.ts        # Cookie/CSRF ヘッダ中継ヘルパー
│   │   ├── login-actions.ts       # ログイン Action
│   │   ├── logout-action.ts       # ログアウト Action
│   │   └── work-log-actions.ts    # 作業記録 CRUD Actions
│   ├── login/             # ログインページ
│   └── page.tsx           # トップ（カレンダー）ページ
├── components/            # React コンポーネント
│   ├── auth/              # 認証関連
│   └── theme/             # テーマ切替
└── proxy.ts               # Middleware（セッション検証・リダイレクト）
```

#### セッション・ルート保護

- `proxy.ts`（Next.js Middleware）で未認証ユーザーを `/login` へリダイレクト
- `GET /auth/session` に sessionToken Cookie を送信し API で検証
- Server Actions 経由のリクエストは Middleware をスキップ（`next-action` ヘッダで判定）
- Server Components を積極的に使用（セッション検証に有利）

#### 入力検証

- **Server Actions 内の入力検証は `zod` を使用する**（`apps/web` の依存に含まれる）
- `FormData` から取り出した値を `z.preprocess` → `z.string()` でバリデーション
- `z.object({...}).safeParse(...)` でエラーを型安全にハンドリングし、フォームへ返却
- API 側の DTO（`class-validator`）と二重でバリデーションするが、フロント側の検証が第一防衛線

#### 環境変数

| 変数名 | 用途 | デフォルト |
|--------|------|----------|
| `NEXT_PUBLIC_API_URL` | ブラウザ→API の Base URL | `http://localhost:3001` |
| `API_URL_INTERNAL` | サーバーサイド→API の Base URL（コンテナ内部通信用） | `NEXT_PUBLIC_API_URL` を使用 |
| `NEXT_PUBLIC_SESSION_COOKIE_NAME` | セッション Cookie 名 | `crow_session` |
| `WEB_PORT` | Next.js 起動ポート | `3000` |

- サーバーサイドのシークレットは root `.env` に配置

### @crow/api (NestJS)

#### モジュール設計

```
src/
├── app.module.ts              # Root Module
├── app.controller.ts          # Root Controller
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts        # ログイン・ログアウト・レート制限
│   ├── session-store.service.ts
│   ├── prisma.service.ts      # PrismaClient ラッパー（adapter-pg 使用）
│   ├── session.guard.ts       # SessionGuard（Cookie 検証）
│   ├── csrf.guard.ts          # CsrfGuard（変更系エンドポイント用）
│   ├── current-user.decorator.ts  # @CurrentUser() デコレータ
│   └── dto/                   # Data Transfer Objects
└── work-logs/
    ├── work-logs.module.ts
    ├── work-logs.controller.ts
    ├── work-logs.service.ts
    └── dto/
        ├── create-work-log.dto.ts
        ├── update-work-log.dto.ts
        ├── update-day-note.dto.ts
        ├── month-query.dto.ts
        └── day-query.dto.ts
```

#### Decorator 使用

- NestJS の `@Module()`, `@Controller()`, `@Get()`, `@Post()` など
- 依存性注入は constructor に記述
- 型安全性のため DTO を定義

#### Session 管理・認証エンドポイント

- `SessionStoreService` で session lifecycle を管理
- `POST /auth/login` でセッション生成、Cookie に設定
- `POST /auth/logout` でセッション削除
- `GET /auth/session` でセッション検証（proxy.ts から利用）
- 全保護エンドポイントに `@UseGuards(SessionGuard)` を付与
- 変更系エンドポイント（POST/PATCH/DELETE）には `@UseGuards(CsrfGuard)` も付与

#### Work-logs エンドポイント

| メソッド | パス | Guard | 説明 |
|--------|------|-------|------|
| GET | `/work-logs/month` | Session | 月次作業記録一覧 |
| GET | `/work-logs/day` | Session | 日別作業記録一覧 |
| POST | `/work-logs` | Session + CSRF | 作業記録作成 |
| PATCH | `/work-logs/:id` | Session + CSRF | 作業記録更新 |
| PATCH | `/work-logs/day-note` | Session + CSRF | 日別メモ更新 |
| DELETE | `/work-logs/:id` | Session + CSRF | 作業記録削除 |

#### 環境変数

| 変数名 | 用途 | デフォルト |
|--------|------|----------|
| `DATABASE_URL` | PostgreSQL 接続文字列 | 必須 |
| `SESSION_SECRET` | Cookie 署名用シークレット | 開発用デフォルト値（本番は必ず変更） |
| `FRONTEND_ORIGIN` | CORS 許可オリジン | `http://localhost:3000` |
| `API_PORT` | API 起動ポート | `3001` |
| `RATE_LIMIT_MAX` | レート制限（リクエスト数） | 本番: 120、開発: 1000 |
| `RATE_LIMIT_WINDOW` | レート制限の時間窓 | `1 minute` |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | ログイン試行のレート制限窓（秒） | `60` |

### @crow/database (Prisma)

#### スキーマ管理

- **単一の source of truth**: `packages/database/prisma/schema.prisma`
- PostgreSQL datasource の接続設定
- マイグレーションファイルを `prisma/migrations/` に保持

#### 型生成・マイグレーション

```bash
# クライアント型を生成
npm run db:generate

# マイグレーション実施・スキーマ変更
npm run db:migrate
```

#### データモデル

| モデル | 説明 |
|--------|------|
| `User` | ユーザー（`UserRole`: admin/member、`AuthProvider`: local/oidc） |
| `Session` | セッション（`sessionTokenHash`・`expiresAt`・`revokedAt`） |
| `AuthAuditLog` | 認証イベント監査ログ |
| `WorkLog` | 作業記録（`workDate`・`recordedAt`・`durationMinutes`） |
| `DailyNote` | 日別メモ（userId + workDate でユニーク） |

#### 使用方法

**Prisma v7 は adapter-first**。`PrismaClient` を直接 `new` せず、`@prisma/adapter-pg` 経由で初期化する：

```typescript
// apps/api/src/auth/prisma.service.ts の例
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@crow/database';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
    constructor() {
        const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
        super({ adapter });
    }

    async onModuleInit() {
        await this.$connect();
    }
}
```

## よくある作業

### 新しいフィーチャーの追加

1. **Prisma スキーマを更新**

   ```bash
   npm run db:migrate
   ```

2. **型を再生成**

   ```bash
   npm run db:generate
   ```

3. **API エンドポイントを実装** (`@crow/api`)

4. **Web UI を実装** (`@crow/web`)

5. **格式チェック・修正**

   ```bash
   npm run lint:fix
   npm run format
   ```

### バグ修正・リファクタリング

- 型チェック + リント を自動化

  ```bash
  npm run typecheck && npm run lint:fix
  ```

- PR 前に確認

  ```bash
  npm run check:fix
  ```

## トラブルシューティング

| 問題 | 解決方法 |
|-----|--------|
| PostgreSQL に接続できない | `npm run docker:up` で Docker コンテナを起動してください |
| ポート 5432 が既に使用中 | `docker ps` で既存コンテナ確認、`npm run docker:down` で停止 |
| Prisma 型エラー（`PrismaClient` が見つからない） | `npm run db:generate` を実行 |
| マイグレーションエラー | `npm run docker:logs` でエラーログを確認、DB が起動しているか確認 |
| `EUNSUPPORTEDPROTOCOL` エラー | `package.json` の依存を `workspace:*` から `file:../../packages/database` に変更する |
| `PrismaClient` で DB 接続エラー | `@prisma/adapter-pg` を使用した初期化になっているか確認（Prisma v7 は adapter 必須） |
| TypeScript エラー（型の不整合） | `npm run typecheck` を実行、エラーを確認 |
| Biome の自動修正が失敗 | `npm run lint` で詳細を確認、手動修正が必要な場合もある |
| dev コマンドが起動しない | `.env` ファイルが root に存在するか、Docker が起動しているか確認 |
| CORS エラー | `FRONTEND_ORIGIN` に Next.js の URL が正しく設定されているか確認 |

## 参考資料

- [Crow 認証方針](../../doc/authentication-strategy.md)
- [NestJS 公式ドキュメント](https://docs.nestjs.com/)
- [Next.js 公式ドキュメント](https://nextjs.org/docs)
- [Prisma 公式ドキュメント](https://www.prisma.io/docs/)
- [Biome ドキュメント](https://biomejs.dev/)
