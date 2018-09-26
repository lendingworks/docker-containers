#!/usr/bin/env bash

set -e

# Inspired by https://github.com/hipages/docker-newrelic-php-daemon/blob/master/build/docker-entrypoint
socat TCP-LISTEN:${NEWRELIC_CONTAINER_PORT},reuseaddr,fork,su=nobody TCP:127.0.0.1:${NEWRELIC_AGENT_PORT} &

exec /usr/bin/newrelic-daemon -c /etc/newrelic/newrelic.cfg -f
