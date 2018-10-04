#!/usr/bin/env bash

set -e

: ${CORVUS_LOG_LEVEL='info'}
: ${CORVUS_BIND_PORT='6379'}
: ${CORVUS_NODES='localhost:8000,localhost:8001,localhost:8002'}
: ${CORVUS_THREADS='4'}

gomplate -f /corvus.conf.template -o /corvus.conf

exec /corvus "/corvus.conf"
