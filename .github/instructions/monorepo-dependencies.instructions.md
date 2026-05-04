---
description: "Monorepo ワークスペース間の依存性管理ガイド。パッケージ参照方法、バージョン管理、circular dependency 対策、Workspace protocol を含みます。"
name: "Monorepo 依存性管理ガイド"
applyTo: apps/**/*.ts, apps/**/*.tsx, packages/**/*.ts, package.json
---

# Monorepo 依存性管理ガイド

Crow は npm workspaces を使用した monorepo 構成です。このガイドは、パッケージ間の安全な依存性管理とベストプラクティスを提供します。

## ワークスペース構成

### Package Definition

```json
// root package.json
{
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

| パッケージ | 名前 | 用途 |
|-----------|------|------|
| apps/web | @crow/web | Next.js フロントエンド |
| apps/api | @crow/api | NestJS バックエンド API |
| packages/database | @crow/database | Prisma スキーマ・型定義 |

### 各パッケージの package.json

```json
// apps/api/package.json
{
  "name": "@crow/api",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "@crow/database": "workspace:*"  // ← ワークスペースプロトコル
  }
}

// apps/web/package.json
{
  "name": "@crow/web",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "@crow/database": "workspace:*"
  }
}

// packages/database/package.json
{
  "name": "@crow/database",
  "version": "0.1.0",
  "private": true,
  "main": "index.js",
  "dependencies": {
    "@prisma/client": "^6.19.0"
  }
}
```

## ワークスペース参照方法

### 1. Workspace Protocol（推奨）

`workspace:*` は npm workspaces 専用の特別なプロトコルです。

```json
{
  "dependencies": {
    "@crow/database": "workspace:*"   // 任意バージョン
  }
}
```

| プロトコル | 意味 | 使用例 |
|-----------|------|--------|
| `workspace:*` | 任意バージョン（推奨） | `@crow/database: workspace:*` |
| `workspace:^` | 互換バージョン | `@crow/api: workspace:^0.1.0` |
| `workspace:~` | パッチバージョン | `@crow/web: workspace:~0.1.0` |

### 2. インポート方法

```typescript
// apps/api/src/main.ts
// ✅ ワークスペース参照のインポート
import { PrismaClient } from '@crow/database';

// ❌ 相対パスは避ける（参照が複雑になる）
// import { PrismaClient } from '../../../packages/database/index';

const prisma = new PrismaClient();
```

## 依存性グラフと循環参照対策

### 推奨される依存性方向

```
@crow/database (コアスキーマ・型定義)
    ↑
    ├─── @crow/api (NestJS)
    └─── @crow/web (Next.js)

@crow/api ↔︎ @crow/web ⚠️ 避ける
```

### ❌ 循環参照の例

```typescript
// ❌ 悪い: @crow/api が @crow/web に依存
// apps/api/package.json
{
  "dependencies": {
    "@crow/web": "workspace:*"  // API が Web に依存
  }
}

// ❌ 悪い: @crow/web が @crow/api に依存
// apps/web/package.json
{
  "dependencies": {
    "@crow/api": "workspace:*"  // Web が API に依存
  }
}

// 結果: 循環参照 → ビルド失敗、型エラー
```

### ✅ 解決策: 共有パッケージを作成

循環参照が発生する場合、共有パッケージを中間層として作成します。

```
packages/shared/
├── types.ts        # 共有型定義
├── constants.ts    # 定数
└── utils.ts        # ユーティリティ

@crow/api と @crow/web は両者とも @crow/shared に依存
@crow/api と @crow/web は互いに依存しない
```

```typescript
// packages/shared/types.ts
export interface AuthContext {
  userId: string;
  email: string;
}

export type LoginRequest = {
  email: string;
  password: string;
};

// apps/api/src/auth/auth.controller.ts
import { AuthContext } from '@crow/shared';

// apps/web/components/auth/login-form.tsx
import { LoginRequest } from '@crow/shared';
```

## ビルド・型チェックの依存性管理

### スクリプト実行順序

```bash
# root package.json
{
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present"
  }
}
```

npm は自動的に依存性順序に従ってビルドを実行します：

```
1. @crow/database をビルド
   ↓
2. @crow/api と @crow/web をビルド（並列）
   ↓
3. ビルド完了
```

### 特定パッケージのみビルド

```bash
# API のみ
npm run build -w @crow/api

# Web のみ
npm run build -w @crow/web

# Database のみ（通常は不要）
npm run build -w @crow/database
```

## 初期セットアップ

### 1. 依存性をインストール

```bash
npm install
```

このコマンドで以下が実行されます：
- root の依存性をインストール
- 各ワークスペースの `node_modules/` を作成（シンボリックリンク）
- ワークスペース参照が自動的に解決

### 2. Prisma 型を生成

```bash
npm run db:generate
```

他パッケージから `@crow/database` をインポート可能になります。

### 3. 各層でビルド確認

```bash
npm run build
```

### 4. TypeScript 型チェック

```bash
npm run typecheck
```

## ワークスペース間の型安全性

### 例: Database → API → Web

```typescript
// packages/database/index.ts
export { PrismaClient } from '@prisma/client';
export type { User, Session, WorkLog } from '@prisma/client';

// apps/api/src/user/user.service.ts
import { PrismaClient, User } from '@crow/database';

export class UserService {
  constructor(private prisma: PrismaClient) {}

  async getUser(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }
}

// apps/web/app/dashboard/page.tsx
import { User } from '@crow/database';  // 型のみインポート

export default async function Dashboard() {
  // ユーザー情報を取得（Server Component）
  const user: User | null = await fetch('/api/user').then(r => r.json());

  return (
    <div>
      {user && <p>Welcome, {user.name}</p>}
    </div>
  );
}
```

## バージョン管理

### Package Version Strategy

```json
// root package.json
{
  "version": "0.1.0"  // 全パッケージの基準バージョン
}
```

- 通常、全パッケージを同じバージョンで管理（monorepo convention）
- リリース時は `npm version <major|minor|patch>` で root を更新

### 依存性パッケージのバージョン固定

```json
// apps/api/package.json
{
  "dependencies": {
    "@nestjs/common": "^11.0.0",       // 通常の npm パッケージ
    "@crow/database": "workspace:*"    // ワークスペース（バージョン不問）
  }
}
```

## よくあるエラーと解決方法

| エラー | 原因 | 解決方法 |
|-------|-----|--------|
| `Cannot find module '@crow/database'` | ワークスペース参照が解決されていない | `npm install` を再実行 |
| Circular dependency detected | パッケージ間の循環参照 | 依存性グラフを確認、shared パッケージを検討 |
| Module not found: `@crow/database/index` | export 未定義 | `packages/database/index.ts` を確認 |
| TypeScript type error | 型が最新でない | `npm run db:generate` を実行 |
| Build fails in dependency order | 上流パッケージのビルド失敗 | 上流パッケージをビルド・デバッグ |

## デバッグ・確認方法

### ワークスペース構成を確認

```bash
npm list --depth=0

# 出力例:
# crow@0.1.0
# ├── @crow/api@0.1.0 -> /path/to/crow/apps/api
# ├── @crow/database@0.1.0 -> /path/to/crow/packages/database
# └── @crow/web@0.1.0 -> /path/to/crow/apps/web
```

### 特定パッケージの依存性確認

```bash
npm list -w @crow/api

# API が何に依存しているか確認
```

### Node Modules の構造確認

```bash
ls -la node_modules/@crow/

# 出力: シンボリックリンク確認
# api -> ../apps/api
# database -> ../packages/database
# web -> ../apps/web
```

## チェックリスト

- [ ] すべてのパッケージ間参照が `workspace:*` を使用
- [ ] Circular dependency がない（依存性グラフが DAG）
- [ ] `npm install` で全ワークスペースが正しく解決
- [ ] `npm run build` で依存性順序が正しく実行
- [ ] 型インポートは `@crow/<package>` で可能
- [ ] ワークスペース参照に相対パスを使用していない
- [ ] リリース時は同じバージョンで管理
