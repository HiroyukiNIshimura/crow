---
description: "Web からの API 通信を Server Action 経由に統一するための実装ルール。Client Component からの直接 fetch を禁止し、Cookie/CSRF の中継方法を定義します。"
name: "Web API Server Action ルール"
applyTo: apps/web/app/**/*.ts, apps/web/app/**/*.tsx, apps/web/components/**/*.tsx
---

# Web API Server Action ルール

## 目的

`apps/web` では、ブラウザ実行の Client Component から外部 Web API（`NEXT_PUBLIC_API_URL` 等）へ直接通信しない。

すべての API 通信は **Server Action（または Route Handler）** を入口にして実行し、
認証 Cookie / CSRF / エラーハンドリングをサーバー側に集約する。

## 必須ルール

1. Client Component に `fetch(`${process.env.NEXT_PUBLIC_API_URL}...`)` を書かない。
2. API 呼び出しは `app/**/actions.ts` などの Server Action ファイルに実装する。
3. Cookie ベース認証 API を呼ぶ場合は、API 応答の `Set-Cookie` を Next.js 側 Cookie へ中継する。
4. 状態変更 API（POST/PUT/PATCH/DELETE）で CSRF が必要な場合は、Server Action 側で Cookie とヘッダーの整合を維持する。
5. Client Component は `useActionState` + `<form action={...}>` を優先し、画面の責務（入力・表示）に限定する。

## 推奨パターン

- Server Action では次を実装する。
  - 入力バリデーション
  - API 呼び出し
  - `Set-Cookie` 中継
  - 画面向けエラーメッセージ整形
  - 成功時 `redirect(...)`
- Cookie 解析/中継処理は `app/actions/*` の共通ユーティリティに切り出す。

## 例外

- Next.js の Route Handler（`app/api/**/route.ts`）を BFF として使う場合は許可。
- 一時的なデバッグで Client 側 fetch を使う場合は、PR 前に必ず削除する。

## レビュー観点

- Client Component に API のベース URL が残っていないか
- 認証系 API 呼び出しで Cookie 中継漏れがないか
- CSRF ヘッダーを必要とする API 呼び出しで整合が取れているか
- エラーが利用者向け文言に正規化されているか
