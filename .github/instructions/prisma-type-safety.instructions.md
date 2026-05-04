---
description: "Prisma 型安全性とスキーマ設計ガイド。マイグレーション、型生成、推奨パターン、アンチパターンをカバーします。スキーマ変更・型チェック時に使用してください。"
name: "Prisma 型安全性ガイド"
applyTo: packages/database/prisma/**, apps/**/*.ts
---

# Prisma 型安全性ガイド

Crow では Prisma v6+ を使用しており、スキーマの変更から型生成まで一貫した型安全性が保証されます。このガイドはベストプラクティスと注意点をまとめています。

## 概要

### Prisma ファイル構成

```
packages/database/
├── prisma/
│   ├── schema.prisma       # 単一の source of truth
│   ├── migrations/         # マイグレーション履歴
│   └── seed.ts             # 初期データ（オプション）
└── package.json
```

### 型生成ワークフロー

```
schema.prisma の変更
    ↓
npm run db:migrate         # DB にマイグレーション適用
    ↓
npm run db:generate        # @prisma/client 型を生成
    ↓
型安全な Prisma Client が利用可能
```

**重要**: `db:generate` を忘れると、TS エラーが発生します。

## スキーマ設計の推奨パターン

### 1. Model 定義の基本構造

```prisma
// packages/database/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ========================================
// User Model
// ========================================

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  password  String   // bcrypt hash

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  workLogs  WorkLog[]
  sessions  Session[]

  @@map("users")
}

// ========================================
// Session Model
// ========================================

model Session {
  id        String   @id
  userId    String
  email     String

  expiresAt DateTime
  createdAt DateTime @default(now())

  // Relations
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([id])
  @@index([userId])
  @@map("sessions")
}

// ========================================
// WorkLog Model
// ========================================

model WorkLog {
  id        String   @id @default(cuid())
  userId    String
  date      DateTime

  title     String
  content   String?
  duration  Int      // 分単位

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date, id])
  @@index([userId])
  @@index([date])
  @@map("work_logs")
}
```

### 2. リレーション設定のポイント

```prisma
// ❌ 避けるべき: 無駄な双方向参照
model Post {
  id      Int     @id
  authorId Int
  // author への参照だけで十分の場合が多い
}

// ✅ 推奨: 必要な関係だけを定義
model Author {
  id    Int     @id
  name  String
  posts Post[]
}

model Post {
  id       Int    @id
  authorId Int
  author   Author @relation(fields: [authorId], references: [id])
}
```

### 3. デフォルト値と自動生成

```prisma
model Record {
  id        String   @id @default(cuid())     // ランダムな一意な ID
  // 代案: @default(uuid())  で UUID を使用

  createdAt DateTime @default(now())         // 作成時刻を自動設定
  updatedAt DateTime @updatedAt              // 更新時刻を自動更新

  status    String   @default("pending")     // 文字列デフォルト
  count     Int      @default(0)             // 数値デフォルト
}
```

## マイグレーション管理

### 基本的な手順

```bash
# 1. スキーマを変更
# 例: User モデルに age フィールドを追加
# model User {
#   ...
#   age Int?
# }

# 2. マイグレーションを作成・実行
npm run db:migrate

# 3. ターミナルでマイグレーション名を入力
# migration name? › add_age_to_user

# 4. 型を再生成
npm run db:generate

# 5. 完了
```

### マイグレーションファイルの構造

```
prisma/migrations/
├── migration_lock.toml
├── 20250504000000_init/
│   └── migration.sql
└── 20250504000001_add_age_to_user/
    └── migration.sql
```

各マイグレーションは独立した SQL ファイルであり、forward / backward に追跡可能です。

### ❌ 避けるべき実装

```bash
# ❌ 絶対にしない: スキーマ直接修正後、マイグレーション作成
# これは本番環境と開発環境の乖離を引き起こす

# ❌ 絶対にしない: migrations/ ディレクトリを手動削除
# マイグレーション履歴が失われます

# ❌ 絶対にしない: db:generate を忘れて型チェック実行
# TS エラーが大量発生
```

## Prisma Client の型安全な使用方法

### 1. 基本的な CRUD 操作

```typescript
import { PrismaClient } from '@crow/database';

const prisma = new PrismaClient();

// Create
const newUser = await prisma.user.create({
  data: {
    email: 'user@example.com',
    name: 'John Doe',
    password: 'hashed_password',
  },
});

// Read
const user = await prisma.user.findUnique({
  where: { email: 'user@example.com' },
});

// Update
const updated = await prisma.user.update({
  where: { id: user.id },
  data: { name: 'Jane Doe' },
});

// Delete
await prisma.user.delete({
  where: { id: user.id },
});

// List with filter
const users = await prisma.user.findMany({
  where: {
    createdAt: {
      gte: new Date('2025-01-01'),
    },
  },
  orderBy: { createdAt: 'desc' },
  take: 10,
});
```

### 2. リレーション取得（Include / Select）

```typescript
// Include: リレーション先データを全取得
const userWithWorkLogs = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    workLogs: true,  // WorkLog[] が型で確定
    sessions: true,
  },
});

// Select: 特定のフィールドだけ取得（型は narrow になる）
const userBasicInfo = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    name: true,
    workLogs: {
      select: {
        id: true,
        title: true,
        date: true,
      },
    },
  },
});
```

### 3. トランザクション

```typescript
// 複数操作をアトミックに実行
const result = await prisma.$transaction(async (tx) => {
  // tx を使用して操作（プレーンな prisma と同じ API）
  const user = await tx.user.create({
    data: { email: 'user@example.com', ... },
  });

  const session = await tx.session.create({
    data: { userId: user.id, ... },
  });

  return { user, session };
});
```

### 4. Raw クエリー（やむを得ない場合）

```typescript
// Prisma で表現できない複雑なクエリーの場合のみ
const results = await prisma.$queryRaw`
  SELECT u.id, u.email, COUNT(w.id) as work_count
  FROM users u
  LEFT JOIN work_logs w ON u.id = w.user_id
  GROUP BY u.id
`;
```

## 型推論とジェネリック

### 例: リポジトリパターン

```typescript
import { Prisma, PrismaClient } from '@crow/database';

export class UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async createUser(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({ data });
  }

  async updateUser(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }
}

// 使用例
const repo = new UserRepository(prisma);
const user = await repo.findById('user-123');

// 型は自動推論: Prisma.User | null
```

## アンチパターン

### ❌ パターン 1: any で型をバイパス

```typescript
// ❌ 絶対にしない
const user: any = await prisma.user.findUnique({...});
user.nonExistentField; // エラーに気づけない

// ✅ 正しい
const user = await prisma.user.findUnique({...});
// user.nonExistentField はコンパイルエラー
```

### ❌ パターン 2: 手動で DB 操作

```typescript
// ❌ 型チェックが効かない
const sql = `SELECT * FROM users WHERE id = '${userId}'`; // SQL インジェクションリスク
const result = await db.query(sql);

// ✅ Prisma Client を使う
const user = await prisma.user.findUnique({
  where: { id: userId }, // 自動的に escape
});
```

### ❌ パターン 3: マイグレーションなしでスキーマ変更

```typescript
// ❌ スキーマを直接編集して db:generate だけ
// ダウンロード環境やテスト環境で同期が取れない

// ✅ 常に db:migrate を使用
```

## 開発環境でのリセット・シード

### 開発環境で DB を完全リセット

```bash
# ⚠️ 開発環境のみ
npx prisma migrate reset

# これにより:
# 1. 既存の DB を削除
# 2. 全マイグレーション再適用
# 3. seed.ts を実行（存在する場合）
```

### seed.ts（オプション）

```typescript
// packages/database/prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // テストユーザーを作成
  await prisma.user.createMany({
    data: [
      {
        email: 'admin@example.com',
        name: 'Admin',
        password: 'hashed_password_1',
      },
      {
        email: 'user@example.com',
        name: 'User',
        password: 'hashed_password_2',
      },
    ],
    skipDuplicates: true,
  });

  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

## よくあるエラー

| エラー | 原因 | 解決方法 |
|-------|-----|--------|
| `Cannot find module '@crow/database'` | Prisma Client が生成されていない | `npm run db:generate` を実行 |
| `PrismaClientValidationError: Unknown field` | スキーマと生成された型が乖離 | `npm run db:generate` を実行 |
| `field does not exist on this object` | select/include で存在しないフィールド | スキーマと select を確認 |
| `Unique constraint failed` | 一意性制約に違反 | WHERE 条件と INSERT データを確認 |
| `Foreign key constraint failed` | 参照先レコードが存在しない | リレーション先データを先に create |

## チェックリスト

- [ ] スキーマ変更後、`npm run db:migrate` を実行した
- [ ] マイグレーション実行後、`npm run db:generate` を実行した
- [ ] 型推論を活用し、`any` 型を避けている
- [ ] リレーションの `onDelete: Cascade` を適切に設定
- [ ] 複雑な操作はトランザクションでカバー
- [ ] マイグレーション履歴は削除していない
