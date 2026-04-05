#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OSS_BUCKET="${OSS_BUCKET:-}"
OSS_PREFIX="${OSS_PREFIX:-}"
OSS_DEST="oss://${OSS_BUCKET}"

if [[ -n "${OSS_PREFIX}" ]]; then
  OSS_DEST="${OSS_DEST%/}/${OSS_PREFIX#/}"
fi

if [[ -z "${OSS_BUCKET}" ]]; then
  echo "Missing OSS_BUCKET."
  echo "Example:"
  echo "  OSS_BUCKET=your-bucket OSS_PREFIX=site ${BASH_SOURCE[0]}"
  exit 1
fi

if [[ -n "${OSSUTIL_BIN:-}" ]]; then
  if ! command -v "${OSSUTIL_BIN}" >/dev/null 2>&1; then
    echo "Cannot find ossutil binary: ${OSSUTIL_BIN}"
    exit 1
  fi
  DRIVER=("${OSSUTIL_BIN}")
elif command -v ossutil >/dev/null 2>&1; then
  DRIVER=(ossutil)
elif command -v aliyun >/dev/null 2>&1; then
  DRIVER=(aliyun oss)
else
  echo "Cannot find an OSS sync tool."
  echo "Install ossutil or aliyun-cli."
  exit 1
fi

EXCLUDES=(
  ".git/*"
  ".git"
  ".DS_Store"
  "**/.DS_Store"
  ".playwright-cli/*"
  ".playwright-cli"
  "scripts/*"
  "scripts"
  "img/programs/~\$Proj. Library.xlsx"
)

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

if [[ "${DRIVER[0]}" == "aliyun" ]]; then
  STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/qzhuphoto-oss-stage.XXXXXX")"
  trap 'rm -rf "${STAGE_DIR}"' EXIT

  RSYNC_ARGS=(
    -a
    --delete
    --exclude=.git
    --exclude=.DS_Store
    --exclude=.playwright-cli
    --exclude=scripts
    --exclude='img/programs/~$Proj. Library.xlsx'
    "${ROOT_DIR}/"
    "${STAGE_DIR}/"
  )

  echo "Preparing staged deploy directory: ${STAGE_DIR}"
  rsync "${RSYNC_ARGS[@]}"

  ARGS=(
    sync
    "${STAGE_DIR}/"
    "${OSS_DEST}/"
    --update
    --delete
    --force
  )

  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "Syncing ${ROOT_DIR}/ -> ${OSS_DEST}/"
    printf 'Command:'
    printf ' %q' "${DRIVER[@]}" "${ARGS[@]}"
    printf '\n'
    exit 0
  fi

  echo "Syncing ${ROOT_DIR}/ -> ${OSS_DEST}/"
  "${DRIVER[@]}" "${ARGS[@]}"
  exit 0
fi

ARGS=(
  sync
  "${ROOT_DIR}/"
  "${OSS_DEST}/"
  --update
  --delete
  --force
)

for pattern in "${EXCLUDES[@]}"; do
  ARGS+=(--exclude "${pattern}")
done

if [[ "${DRY_RUN}" == "true" ]]; then
  ARGS+=(--dryrun)
fi

echo "Syncing ${ROOT_DIR}/ -> ${OSS_DEST}/"
"${DRIVER[@]}" "${ARGS[@]}"
