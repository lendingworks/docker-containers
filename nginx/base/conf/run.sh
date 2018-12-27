#!/usr/bin/env bash

# Inspired by https://www.driftrock.com/engineering-blog/2017/10/6/kubernetes-zero-downtime-rolling-updates

# Convert Kubernetes' SIGTERM to SIGQUIT for nginx so it does a graceful shutdown.
# SIGQUIT = 15
trap "echo SIGTERM trapped. Signalling nginx with SIGQUIT.; kill -s QUIT \$(cat /var/run/nginx.pid)" 15

# Start nginx in the background so we can track it.
nginx "$@" &

CHILD_PID=$!
echo "Nginx started with PID $CHILD_PID"

# Continously watch for child exit - we can't simply use `wait` here since a
# SIGQUIT will terminate the `wait` even if nginx is running.
while kill -s 0 $CHILD_PID; do wait $CHILD_PID; done

echo "Nginx process $CHILD_PID exited. Now exiting..."
