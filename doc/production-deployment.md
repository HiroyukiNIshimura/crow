# Crow 本番環境デプロイ手順（Debian + KVM + Docker）

この手順は以下の構成を前提にしています。

- 物理サーバー（Debian）: Nginx（リバースプロキシ）
- KVM インスタンス: Crow（Docker）
  - PostgreSQL
  - API（NestJS）
  - Web（Next.js）

Nginx 側の詳細設定は `doc/nginx-production-setup.md` を参照してください。

---

## 1. 事前準備

### 1-1. 必要ソフトウェア

Crow サーバー（KVM）に以下が入っていること。

- Docker Engine
- Docker Compose v2（`docker compose`）
- Git

### 1-2. ソース配置

任意のディレクトリに Crow リポジトリを配置します。

例: `/opt/crow`

### 1-3. 環境変数ファイル（`.env`）作成

`/opt/crow/.env` を作成し、少なくとも以下を設定します。

- `SESSION_SECRET=<十分に長いランダム文字列>`
- `POSTGRES_USER=<DBユーザー>`
- `POSTGRES_PASSWORD=<DBパスワード>`
- `POSTGRES_DB=<DB名>`
- `DATABASE_URL=postgresql://<DBユーザー>:<DBパスワード>@localhost:5432/<DB名>`
- `DATABASE_URL_DOCKER=postgresql://<DBユーザー>:<DBパスワード>@postgres:5432/<DB名>`
- `FRONTEND_ORIGIN=https://<あなたのドメイン>`
- `NEXT_PUBLIC_API_URL=https://<あなたのドメイン>/api`
- `API_URL_INTERNAL=http://api:3001`
- `WEB_PORT=3000`
- `API_PORT=3001`

> `NEXT_PUBLIC_API_URL` はブラウザに公開される値なので、内部ホスト名ではなく公開 URL を設定してください。

---

## 2. 初回デプロイ

リポジトリルートで実行します。

1. デプロイスクリプトに実行権限を付与
2. コンテナ実行ユーザー（UID/GID）を指定してデプロイ

基本実行例:

- `./scripts/deploy-crow.sh --env-file .env --container-user 1000:1000`

このスクリプトは内部で以下を行います。

1. （任意）ベースイメージ取得
2. API / Web のビルド
3. PostgreSQL 起動
4. `prisma migrate deploy` 実行
5. API / Web 起動

### 2-1. デプロイオプション

- `--no-pull` : pull をスキップ
- `--no-cache` : build 時に no-cache
- `--skip-migrate` : DB マイグレーションをスキップ
- `--container-user <uid:gid>` : 実行ユーザーを一括指定
- `--container-uid <uid>` / `--container-gid <gid>` : 個別指定

---

## 3. 更新デプロイ（通常運用）

1. 最新コード取得
2. デプロイスクリプト再実行

更新時の推奨実行例:

- `./scripts/deploy-crow.sh --env-file .env --container-user 1000:1000`

マイグレーション不要な軽微更新時のみ `--skip-migrate` を検討してください。

---

## 4. ヘルスチェックと動作確認

### 4-1. コンテナ状態

- `docker compose --env-file .env -f docker-compose.prod.yml ps`

`postgres`, `api`, `web` が `Up` であることを確認します。

### 4-2. API ヘルス

- `http://<crow-kvm-ip>:3001/health`（内部確認）
- `https://<あなたのドメイン>/api/health`（Nginx 経由）

### 4-3. Web 動作

- `https://<あなたのドメイン>/` へアクセス
- ログイン/ログアウト
- 作業ログの作成・表示

---

## 5. ロールバック手順（簡易）

1. 直前の安定コミットへ checkout
2. 同じ `.env` で再デプロイ

注意:

- DB マイグレーションが入ったリリースを戻す場合は、アプリのみ戻しても整合しない可能性があります。
- 破壊的変更を含むリリース前は、必ず DB バックアップを取得してください。

---

## 6. バックアップ推奨

最低限、日次で PostgreSQL のダンプを取得してください。

- 論理バックアップ: `pg_dump`
- 保管先: 別ホスト or オブジェクトストレージ
- 保持: 世代管理（例: 7日 + 週次 + 月次）

---

## 7. トラブルシューティング

### 7-1. デプロイスクリプト失敗時

- `.env` パスが正しいか
- `docker compose` が使えるか
- `docker-compose.prod.yml` が存在するか

### 7-2. API に接続できない

- `FRONTEND_ORIGIN` と `NEXT_PUBLIC_API_URL` の不整合
- Nginx の `/api/` の `proxy_pass` 設定
- Crow KVM の `3001` 到達性（物理サーバーから）

### 7-3. ログ確認

- `docker compose --env-file .env -f docker-compose.prod.yml logs -f api`
- `docker compose --env-file .env -f docker-compose.prod.yml logs -f web`
- `docker compose --env-file .env -f docker-compose.prod.yml logs -f postgres`

---

## 8. 関連ドキュメント

- `doc/nginx-production-setup.md`（Nginx 設定）
- `deploy/nginx/crow.conf`（Nginx site 設定テンプレート）
- `scripts/deploy-crow.sh`（本番デプロイスクリプト）
- `docker-compose.prod.yml`（本番 compose）
