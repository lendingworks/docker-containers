#!/usr/bin/env bash

set -e

# Inspired by https://github.com/hipages/docker-newrelic-php-daemon/blob/master/build/docker-entrypoint
socat TCP-LISTEN:${NEWRELIC_CONTAINER_PORT},reuseaddr,fork,su=nobody TCP:127.0.0.1:${NEWRELIC_AGENT_PORT} &

/usr/bin/newrelic-daemon -c /etc/newrelic/newrelic.cfg -f &
CHILD_PID="$!"

if [[ "${IS_KUBERNETES}" == "1" ]]; then
  (while true; do if [[ -f /opt/signals/SIGTERM ]]; then kill $CHILD_PID; fi; sleep 1; done) &
fi

wait $CHILD_PID
EXIT_STATUS=$?

if [[ "${IS_KUBERNETES}" == "1" && -f /opt/signals/SIGTERM ]]; then
  exit ${EXIT_STATUS}
elif [[ "${IS_KUBERNETES}" == "0" ]]; then
  exit ${EXIT_STATUS}
fi
