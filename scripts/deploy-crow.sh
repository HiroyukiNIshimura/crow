#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"
DO_PULL=true
NO_CACHE=false
RUN_MIGRATION=true

CONTAINER_UID="${CONTAINER_UID:-$(id -u)}"
CONTAINER_GID="${CONTAINER_GID:-$(id -g)}"

usage() {
    cat <<'USAGE'
Crow 本番デプロイスクリプト

使い方:
  ./scripts/deploy-crow.sh [options]

options:
  --env-file <path>          読み込む env ファイル (default: .env)
  --project-dir <path>       Crow プロジェクトのルート (default: script から自動判定)
  --container-user <uid:gid> コンテナ実行ユーザーを直接指定
  --container-uid <uid>      コンテナ実行 UID
  --container-gid <gid>      コンテナ実行 GID
  --no-pull                  起動前の pull をスキップ
  --no-cache                 build 時に --no-cache を付与
  --skip-migrate             Prisma migrate deploy をスキップ
  -h, --help                 ヘルプ表示

例:
  ./scripts/deploy-crow.sh --env-file .env --container-user 1001:1001
USAGE
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --env-file)
            ENV_FILE="$2"
            shift 2
            ;;
        --project-dir)
            PROJECT_DIR="$2"
            shift 2
            ;;
        --container-user)
            IFS=':' read -r CONTAINER_UID CONTAINER_GID <<<"$2"
            shift 2
            ;;
        --container-uid)
            CONTAINER_UID="$2"
            shift 2
            ;;
        --container-gid)
            CONTAINER_GID="$2"
            shift 2
            ;;
        --no-pull)
            DO_PULL=false
            shift
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --skip-migrate)
            RUN_MIGRATION=false
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage
            exit 1
            ;;
    esac
done

if [[ ! -f "${PROJECT_DIR}/${COMPOSE_FILE}" ]]; then
    echo "compose ファイルが見つかりません: ${PROJECT_DIR}/${COMPOSE_FILE}" >&2
    exit 1
fi

if [[ ! -f "${PROJECT_DIR}/${ENV_FILE}" ]]; then
    echo "env ファイルが見つかりません: ${PROJECT_DIR}/${ENV_FILE}" >&2
    exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
    echo "docker コマンドが見つかりません。Docker をインストールしてください。" >&2
    exit 1
fi

cd "$PROJECT_DIR"

export CONTAINER_UID
export CONTAINER_GID
export CROW_ENV_FILE="$ENV_FILE"

compose_cmd=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

if [[ "$DO_PULL" == true ]]; then
    echo "[1/5] イメージを更新します..."
    "${compose_cmd[@]}" pull postgres || true
fi

build_args=(build)
if [[ "$NO_CACHE" == true ]]; then
    build_args+=(--no-cache)
fi

echo "[2/5] アプリケーションイメージをビルドします..."
"${compose_cmd[@]}" "${build_args[@]}" api web

echo "[3/5] PostgreSQL を起動します..."
"${compose_cmd[@]}" up -d postgres

if [[ "$RUN_MIGRATION" == true ]]; then
    echo "[4/5] Prisma migrate deploy を実行します..."
    "${compose_cmd[@]}" run --rm api npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
else
    echo "[4/5] migrate はスキップしました (--skip-migrate)"
fi

echo "[5/5] API / Web を起動します..."
"${compose_cmd[@]}" up -d api web

"${compose_cmd[@]}" ps

echo
echo "デプロイ完了: CONTAINER_UID=${CONTAINER_UID}, CONTAINER_GID=${CONTAINER_GID}"
