#!/usr/bin/env bash

set -e
set -x

exec /usr/bin/newrelic-daemon -c /etc/newrelic/newrelic.cfg \
  --address="${NEWRELIC_DAEMON_ADDRESS}" \
  --watchdog-foreground
