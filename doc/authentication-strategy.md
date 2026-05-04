# Crow 認証方針

## このドキュメントの目的

このドキュメントは、Crow Web アプリケーションにおける推奨認証方式を定義するものです。
実装エージェントおよび開発者が、認証方式を都度再検討せず、一貫した設計判断を行えるようにすることを目的とします。

## プロジェクト前提

- プロダクト種別: 1日の作業を記録するカレンダーベースの Web アプリケーション
- 主な利用者: 社内メンバーおよび小規模な個人チーム
- 想定規模: 100 名未満
- クライアント: ブラウザベースの Web アプリケーション
- バックエンド API: NestJS v11 + Fastify
- フロントエンド: Next.js 16 + React 19 + TypeScript + Tailwind CSS v4 + daisyUI
- データベース: PostgreSQL 18

## 判断の要約

### 推奨する認証モデル

**Secure な Cookie を使ったサーバー管理セッション認証**を採用する。

### 推奨するログイン方式

このプロジェクトでは、以下の優先順位で採用を検討する。

1. **会社の ID 基盤を利用した OIDC / OAuth2 ログイン**
   - Google Workspace や Microsoft 365 / Entra ID を利用している場合に最優先とする
2. **email + password + サーバーセッション**
   - 外部 ID 連携をすぐに導入できない場合の現実的な代替案とする

### 明確に非推奨とする方式

将来的に外部公開 API やモバイルクライアント対応が明確に必要になるまでは、`localStorage` に access token / refresh token を保存するような**フロントエンド管理型 JWT 認証**は採用しない。

## この方針が最適な理由

このアプリケーションは、少人数利用を前提としたブラウザ中心の社内システムです。
そのため、トークンの可搬性よりも、運用の単純さ・ログアウト制御のしやすさ・実装事故の少なさを優先する。

### Cookie ベースのセッション認証を採用する利点

- ブラウザ中心のプロダクトで正しく実装しやすい
- `HttpOnly` Cookie により、ブラウザ JavaScript から認証情報を直接読まれにくい
- 強制ログアウトやセッション失効の扱いが単純
- SSR やサーバーサイドでの認可判定と相性がよい
- JWT の回転・失効・更新管理に比べて長期的な複雑さが低い

### JWT ファーストを採用しない理由

JWT は複数クライアントや外部利用を前提とした構成では有効ですが、本プロジェクトの初期要件に対しては不要な複雑さを持ち込みやすい。

- refresh token のライフサイクル管理が必要になる
- token rotation / revocation の設計が必要になる
- 保管方法を誤ると漏えいリスクが高くなる
- ログアウトや権限変更時の挙動が複雑化しやすい

## 推奨アーキテクチャ

### [1] 役割分担

各コンポーネントの責務は次のとおりとする。

- **Next.js**
  - ログイン UI の提供
  - アプリ画面の route protection
  - セッションを考慮した SSR / Server Components
  - 必要に応じた BFF 的な窓口
- **NestJS**
  - 作業記録、カレンダーデータ、ユーザー管理などの業務 API
  - すべての保護対象操作に対する認可チェック
  - セッション検証または信頼された内部呼び出しの受け口
- **PostgreSQL**
  - users
  - sessions
  - audit logs
  - work log records

### [2] 推奨する実行パターン

ブラウザアクセスに対しては**Cookie ベースのセッション認証**を使い、認証状態はサーバー側で管理する。

実装パターンとしては次の 2 つを許容する。

#### Pattern A: Next.js がブラウザセッションを扱い、NestJS をサーバー間で呼ぶ

Next.js を BFF として扱う場合に推奨する。

- Browser は Secure Cookie を Next.js に送る
- Next.js が session を検証する
- Next.js がサーバー側から NestJS を呼ぶ
- NestJS は Next.js から渡される信頼済みユーザー文脈、または署名済み内部資格情報を検証する

UI 中心のプロダクトとしては最も整理しやすい構成である。

#### Pattern B: Browser が Cookie を直接 NestJS API に送る

フロントエンドとバックエンドを same-site で運用でき、より短い実装経路を優先したい場合に採用してよい。

- Browser は Secure Cookie を API に直接送る
- NestJS が session を検証する
- Next.js は主に UI の描画を担当する

初期構築は単純だが、cross-origin と Cookie 設定は慎重に扱う必要がある。

### このプロジェクトでの推奨選択

同一サイト配下で運用でき、最短で立ち上げたい場合は**Pattern B**から始める。
その後、BFF 制御を強めたい、サーバーサイド合成を増やしたい、バックエンド分離を進めたいといった要件が出たら **Pattern A** へ移行する。

## セッション設計要件

### Cookie 要件

認証用 session cookie には必ず次を設定する。

- `HttpOnly: true`
- 本番環境では `Secure: true`
- デフォルトは `SameSite: Lax`
- 可能な限り狭い `Path` と `Domain`

### Session token 要件

- Session ID は暗号学的に十分ランダムであること
- ブラウザ可読な保存領域へ機微な業務 claims を直接入れないこと
- ログイン時および権限変更時に session を再生成すること
- ログアウト時に session を無効化すること
- 有効期限と idle timeout を持たせること

### 保存先の推奨

この規模であれば、session 保存先はまず **PostgreSQL** を採用する。

PostgreSQL で十分な理由:

- 利用者数が少ない
- インフラ構成を単純に保てる
- 運用負荷が低い
- 初期段階では追加のキャッシュ基盤が不要

将来的にトラフィック傾向や水平分散の都合で必要になった場合のみ、Redis を session store として導入する。

## ログイン方式の指針

### Option 1: 会社の ID 基盤を使う OIDC / OAuth2

組織側に既存の ID 基盤がある場合は、これを優先して採用する。

推奨候補:

- Google Workspace
- Microsoft Entra ID
- Keycloak（self-hosted）
- Auth0 / Cognito（マネージド ID 基盤を使いたい場合）

#### 利点

- パスワードをアプリ側で直接管理せずに済む
- MFA を導入しやすい
- 社内向けのアカウントライフサイクルと整合を取りやすい
- 既存の会社アカウントポリシーに乗せやすい

#### 向いているケース

- 利用者が会社アカウントを持っている
- アプリ専用の別認証情報を増やしたくない

### Option 2: email + password

外部 ID 連携がすぐに使えない場合のみ採用する。

必須要件:

- パスワードハッシュには **Argon2id** を使う
- 最低限の password policy を設ける
- password reset flow を提供する
- ログイン試行に対する rate limit を設ける
- 認証イベントを記録する

### 将来拡張: passkeys

passkeys / WebAuthn は、パスワードレスログインの必要性が高まった段階で追加検討する。
有効な拡張候補ではあるが、初期リリースの前提条件にはしない。

## 認可モデル

authentication と authorization は分けて扱う。

### 最小ロール構成

初期版では次の 2 ロールから始める。

- `admin`
- `member`

### 最低限のルール

- ユーザーは、明示的に権限付与されない限り自分の work logs のみ読取・更新できる
- `admin` はメンバー管理、認証監査、運用回復系の操作を行える
- すべての書き込み系 endpoint は、session の妥当性に加えて ownership または role を検証する

## セキュリティ要件

初期実装で最低限必要な対策は次のとおりとする。

- Cookie 認証での state-changing request に対する CSRF 対策
- ログイン試行の rate limiting
- password を採用する場合の安全な hashing
- session expiration と revocation
- login / logout / failed login / password reset / role change の audit logging
- ローカル以外の環境では HTTPS を必須とする
- origin / CORS 設定の明示的な検証

## エージェント実装ルール

今後この領域を実装するエージェントは、次のルールに従うこと。

### Must do

- Cookie ベースのサーバー管理 session auth を実装する
- 可能な限り same-site なデプロイ構成を優先する
- secrets は environment variables で管理する
- 保護対象のすべての backend operation で authentication / authorization を検証する
- authentication events に対する audit logging を実装する
- 100 名未満の利用規模を前提に、過剰な抽象化より単純さを優先する

### Must not do

- auth tokens を `localStorage` に保存しない
- session secrets を client に露出させない
- 要件変更がない限り、複雑な OAuth resource server を作らない
- 初期版でマイクロサービス向けの大掛かりな token 基盤を持ち込まない

## 推奨実装ステップ

### Phase 1: 初回の実用版

1. user table を作成する
2. PostgreSQL に session table を作成する
3. login / logout / session validation を実装する
4. app routes と API routes を保護する
5. `admin` / `member` roles を追加する
6. audit log table と event recording を追加する
7. Secure Cookie 設定を行う
8. CSRF 対策と login rate limiting を追加する

### Phase 2: 運用強化

1. session idle timeout を追加する
2. repeated failures に対する account lockout または progressive delay を追加する
3. password reset または IdP 主導の account recovery を整備する
4. admin 向け session 管理ビューを追加する
5. 必要に応じて device / session history を追加する

### Phase 3: 将来拡張

1. Phase 1 で未対応なら OIDC SSO integration を追加する
2. passkey support を追加する
3. スケールや構成変更が必要になった場合のみ Redis-backed sessions を導入する
4. 必要に応じて Next.js を使った BFF architecture へ進める

## 想定データモデル

### users

想定カラム:

- `id`
- `email`
- `display_name`
- `role`
- `password_hash`（SSO-only の場合は nullable）
- `provider`
- `provider_user_id`
- `is_active`
- `created_at`
- `updated_at`

### sessions

想定カラム:

- `id`
- `user_id`
- `session_token_hash` または opaque session identifier 参照
- `created_at`
- `expires_at`
- `last_seen_at`
- `ip_address`
- `user_agent`
- `revoked_at`

### auth_audit_logs

想定カラム:

- `id`
- `user_id`（unknown / failed auth attempts の場合は nullable）
- `event_type`
- `email_or_identifier`
- `ip_address`
- `user_agent`
- `metadata`
- `created_at`

## ライブラリ選定方針

具体的なパッケージは実装時に決定してよいが、次の原則を守ること。

- backend 側の auth validation と authorization は NestJS が担う
- Fastify 互換の middleware / plugins を使う
- Next.js では auth をブラウザの token 管理ではなく、サーバー責務として扱う
- users と初期 session persistence の source of truth は PostgreSQL とする

## 最終推奨

Crow の初期方針としては、次を標準選択とする。

- **Auth model**: server-managed session authentication
- **Transport**: Secure な `HttpOnly` Cookie
- **Initial storage**: PostgreSQL-backed sessions
- **Primary login option**: 会社の OIDC があればそれを使い、なければ email + password
- **Initial authorization**: `admin` / `member` のシンプルな role model

この構成は、100 名未満の社内・小規模チーム向けプロダクトにおいて、セキュリティ・運用単純性・実装速度のバランスが最もよい。
