#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
    if command -v bash >/dev/null 2>&1; then
        exec bash "$0" "$@"
    fi

    echo "このスクリプトの実行には bash が必要です。" >&2
    exit 1
fi

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"
USE_DOWN=false
REMOVE_VOLUMES=false
DRY_RUN=false

usage() {
    cat <<'USAGE'
Crow 本番停止スクリプト

使い方:
  ./scripts/stop-crow.sh [options]

options:
  --env-file <path>     読み込む env ファイル (default: .env)
  --project-dir <path>  Crow プロジェクトのルート (default: script から自動判定)
  --down                stop ではなく down を実行
  --volumes             --down と併用して volume も削除
  --dry-run             実行コマンドを表示して終了
  -h, --help            ヘルプ表示

例:
  ./scripts/stop-crow.sh
  ./scripts/stop-crow.sh --down
  ./scripts/stop-crow.sh --down --volumes
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
        --down)
            USE_DOWN=true
            shift
            ;;
        --volumes)
            REMOVE_VOLUMES=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
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

if [[ "$REMOVE_VOLUMES" == true && "$USE_DOWN" != true ]]; then
    echo "--volumes は --down と一緒に指定してください。" >&2
    exit 1
fi

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

compose_cmd=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

if [[ "$USE_DOWN" == true ]]; then
    stop_args=(down --remove-orphans)
    if [[ "$REMOVE_VOLUMES" == true ]]; then
        stop_args+=(--volumes)
    fi
else
    stop_args=(stop web api postgres)
fi

echo "実行ディレクトリ: $PROJECT_DIR"
echo "compose: $COMPOSE_FILE"
echo "env: $ENV_FILE"

if [[ "$DRY_RUN" == true ]]; then
    echo "[dry-run] ${compose_cmd[*]} ${stop_args[*]}"
    exit 0
fi

if [[ "$USE_DOWN" == true ]]; then
    echo "[1/1] コンテナを停止・破棄します..."
else
    echo "[1/1] コンテナを停止します..."
fi

"${compose_cmd[@]}" "${stop_args[@]}"

"${compose_cmd[@]}" ps

echo
echo "停止処理が完了しました。"
