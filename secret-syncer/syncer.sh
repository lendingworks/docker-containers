#!/usr/bin/env bash
# Inspired by gcr.io/google-containers/startup-script.

set -o errexit
set -o pipefail
set -o nounset

# Exit on interrupt.
trap 'exit 130' INT

SYNC_SRC="/sync/src"
SYNC_DEST="/sync/dest"

# Sync interval in seconds.
SYNC_INTERVAL="${SYNC_INTERVAL:-30}"

# The number of errors before we exit.
ERROR_THRESHOLD="${ERROR_THRESHOLD:-3}"

ERROR_COUNT=0

if [[ "${SECRET_FILE}" == "unknown" ]]; then
  echo -e "Please define the SECRET_FILE environment variable."
  exit 1
fi

SRC_FILE="${SYNC_SRC}/${SECRET_FILE}"
DEST_FILE="${SYNC_DEST}/${SECRET_FILE}"

while :; do
  err=0

  if [[ -f "${SRC_FILE}" ]]; then
  # echo "" > /dev/null 2>&1
    cmp -s "${SRC_FILE}" "${DEST_FILE}" \
      || echo -e "Files changed, syncing..." && cp "${SRC_FILE}" "${DEST_FILE}"
    err=0 || err=$?
  else
    echo -e "File '${SRC_FILE}' not found, trying again in ${SYNC_INTERVAL} secs."
    err=1
  fi

  if [[ ${err} != 0 ]]; then
    ERROR_COUNT=$((ERROR_COUNT + 1))
  fi

  if [[ "${ERROR_COUNT}" == "${ERROR_THRESHOLD}" ]]; then
    echo -e "Error threshold of '${ERROR_THRESHOLD}' has been reached, exiting!"
    exit 1
  fi

  sleep "${SYNC_INTERVAL}"
done
