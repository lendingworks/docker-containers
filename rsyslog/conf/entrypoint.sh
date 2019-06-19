#!/usr/bin/env bash

set -e
set -o nounset

# If a remote log location is specified, write it out to a config file as
# rsyslogd doesn't support environment variables.
REMOTE_SERVER=${REMOTE_LOG_SERVER:-}

if [[ ! -z "${REMOTE_SERVER}" ]]; then
  echo -e "Setting up remote log streaming to '${REMOTE_SERVER}'"
  cat > /etc/rsyslog.d/remote.conf << EOF
# Syntax:
# <level> @<IP>:<port>
# send all level 6 logs to the log-server over TCP
local6.* @@${REMOTE_SERVER}:514
EOF
else
  # In case it's been preserved from a previous run.
  rm -f /etc/rsyslog.d/remote.conf
fi

exec rsyslogd -n -f /etc/rsyslogd.conf
