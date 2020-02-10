#!/usr/bin/env bash

set -o nounset
set -e
set -x

VERSION="8.1911.0-r1"
SHORT_VERSION="8"

echo -e "Building and pushing rsyslog v${VERSION}..."

docker build --build-arg=RSYSLOG_VERSION="${VERSION}" \
  -t "lendingworks/rsyslog:${VERSION}" .
docker tag "lendingworks/rsyslog:${VERSION}" lendingworks/rsyslog:latest
docker tag "lendingworks/rsyslog:${VERSION}" \
  "lendingworks/rsyslog:${SHORT_VERSION}"
docker push "lendingworks/rsyslog:${SHORT_VERSION}"
docker push lendingworks/rsyslog:latest
docker push "lendingworks/rsyslog:${VERSION}"
