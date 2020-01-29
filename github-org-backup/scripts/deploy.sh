#!/usr/bin/env bash

set -o nounset
set -e
set -x

docker build -t lendingworks/github-org-backup:v1 .
docker tag lendingworks/github-org-backup:v1 lendingworks/github-org-backup:latest
docker push lendingworks/github-org-backup:v1
docker push lendingworks/github-org-backup:latest
