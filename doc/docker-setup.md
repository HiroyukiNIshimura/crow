# Docker セットアップガイド

Crow プロジェクトの PostgreSQL を Docker コンテナで管理します。

## クイックスタート

### 1. Docker コンテナ起動

```bash
npm run docker:up
```

以下が実行されます：
- PostgreSQL 18 (Alpine) イメージをダウンロード
- `crow_postgres` コンテナを起動
- `crow` データベースを自動作成
- `localhost:5432` でリッスン

### 2. Prisma セットアップ

```bash
npm run db:generate
npm run db:migrate
```

### 3. 開発サーバー起動

```bash
npm run dev
```

## よく使うコマンド

| コマンド | 説明 |
|---------|------|
| `npm run docker:up` | PostgreSQL コンテナを起動 |
| `npm run docker:down` | PostgreSQL コンテナを停止・削除 |
| `npm run docker:logs` | PostgreSQL ログをリアルタイム表示 |

## 接続情報

```
Host: localhost
Port: 5432
User: postgres
Password: postgres
Database: crow
```

**.env 已設定**

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crow
```

## Docker イメージ詳細

### postgres:18-alpine

- **イメージ**: PostgreSQL 18 (Alpine Linux)
- **コンテナ名**: crow_postgres
- **ボリューム**: `postgres_data` （データ永続化）
- **ネットワーク**: crow_network （内部通信用）

### ヘルスチェック

```yaml
healthcheck:
  test: pg_isready -U postgres
  interval: 10s
  timeout: 5s
  retries: 5
```

コンテナが正常に起動しているか自動確認されます。

## トラブルシューティング

### ポート 5432 が既に使用中

既存のコンテナを停止：

```bash
npm run docker:down
docker ps  # 確認
```

または別のポートを使用する場合、`docker-compose.yml` の `ports` を編集：

```yaml
ports:
  - '5433:5432'  # ホストの 5433 にマップ
```

その後 `.env` の `DATABASE_URL` も更新します。

### コンテナが起動しない

ログ確認：

```bash
docker logs crow_postgres
```

### DB に接続できない

```bash
# コンテナ内で psql 実行
docker exec -it crow_postgres psql -U postgres -d crow

# 接続確認
SELECT 1;
\q
```

### ボリュームをクリア（データベース初期化）

```bash
npm run docker:down
docker volume rm crow_postgres_data  # ボリューム削除
npm run docker:up  # 再起動
```

## 本番環境への展開

本番環境では：

1. **RDS（Amazon Relational Database Service）** など、マネージドサービスの使用を推奨
2. または Kubernetes 環境に `docker-compose.yml` を `Helm Chart` 化
3. **バックアップ戦略**の設定（`pg_dump` スクリプト等）

## 参考資料

- [PostgreSQL 公式ドキュメント](https://www.postgresql.org/docs/)
- [Docker 公式ドキュメント](https://docs.docker.com/)
- [Docker Compose リファレンス](https://docs.docker.com/compose/compose-file/)
