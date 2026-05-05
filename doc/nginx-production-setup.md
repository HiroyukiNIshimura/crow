# Nginx 本番設定（Debian / 物理サーバー）

このドキュメントは、物理サーバー上の Nginx をフロントプロキシとして使い、KVM 上の Crow サーバー（Docker）へ中継する手順です。

- フロント（Nginx）: Debian 物理サーバー
- アプリ（Crow）: KVM インスタンス
  - Web: `http://<crow-kvm-ip>:3000`
  - API: `http://<crow-kvm-ip>:3001`

## 1. Crow サーバー側（KVM）

`docker-compose.prod.yml` / `scripts/deploy-crow.sh` で起動しておきます。

本番 `.env` の代表例:

- `FRONTEND_ORIGIN=https://crow.example.com`
- `NEXT_PUBLIC_API_URL=https://crow.example.com/api`
- `API_URL_INTERNAL=http://api:3001`
- `SESSION_SECRET=<十分に長いランダム文字列>`

> `NEXT_PUBLIC_API_URL` はブラウザ公開値なので、内部ホスト名ではなく外部 URL を使ってください。

## 2. Debian (Nginx) 側の設定配置

1. 設定ファイルを配置
   - リポジトリの `deploy/nginx/crow.conf` を
     `/etc/nginx/sites-available/crow.conf` へ配置
2. 設定内の値を置換
   - `server_name crow.example.com;`
   - `upstream` の `10.0.0.21`（Crow KVM の IP）
3. 有効化
   - `/etc/nginx/sites-enabled/crow.conf` へ symlink
4. 構文確認してリロード
   - `nginx -t`
   - `systemctl reload nginx`

## 3. TLS 証明書（Let's Encrypt）

- `certbot --nginx -d crow.example.com` を実行
- `deploy/nginx/crow.conf` の証明書パスが自動更新されるか確認

必要なら HSTS ヘッダ（`Strict-Transport-Security`）を有効化してください。

## 4. ネットワーク/セキュリティ注意点

- 物理サーバー → Crow KVM の 3000/3001 通信を許可
- 外部インターネットから Crow KVM の 3000/3001 へ直接アクセスできないよう、FW で制限
- API は Nginx 経由利用を前提（`/api/*`）

## 5. 動作確認

- `https://crow.example.com/` が Web へ到達する
- `https://crow.example.com/api/health` が API の health を返す
- ログイン/ログアウトが成功し、Cookie セッションが維持される
