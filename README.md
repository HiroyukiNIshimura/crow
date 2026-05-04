# Crow

1日の作業をカレンダーベースで記録する Web アプリの初期スタブです。

## 現在の構成

- `apps/web`: Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + daisyUI
- `apps/api`: NestJS 11 + Fastify
- `packages/database`: Prisma schema（PostgreSQL 18 前提）

## 認証方針

認証方式の判断は `doc/authentication-strategy.md` に従います。

- Cookie ベースのサーバー管理セッション
- 初期方針は same-site 構成
- PostgreSQL に users / sessions / auth_audit_logs / work_logs を保持

## 含まれているもの

- モノレポの npm workspaces 構成
- NestJS + Fastify の API スタブ
- Next.js のモバイルファーストなログイン画面
- Prisma の初期データモデル
- 開発用のデモログイン

> 現時点のログインは **スタブ実装** です。セッションはサーバー管理ですが、開発しやすさのため API プロセス内メモリに保持しています。将来的には `packages/database` の Prisma schema を使って PostgreSQL-backed sessions に置き換える前提です。

## ローカル起動

1. PostgreSQL を起動
2. 依存関係をインストール
3. Prisma Client を生成
4. Web / API を起動

```bash
npm install
npm run db:generate
npm run dev
```

## 開発用ログイン情報

- email: `admin@example.com`
- password: `password123!`

必要に応じてルートの `.env` で変更できます。