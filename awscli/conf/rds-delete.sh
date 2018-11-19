#!/usr/bin/env bash

set -o nounset

# Exit entire script on interrupt.
trap 'exit 130' INT

if ! type "aws" &> /dev/null; then
  echo "'aws' was not found, please install it before continuing."
  exit 1
fi

if ! type "jq" &> /dev/null; then
  echo "'jq' was not found, please install it before continuing."
  exit 1
fi

if [[ "$#" -lt 2 ]]; then
  echo "Usage: rds-delete [instance-identifier] [region]"
  exit 1
fi

instance_identifier="${1}"
region="${2}"

function get-timestamp {
  date +"%H:%M:%S"
}

function wait-until-deleted {
  instance="${1}"
  region="${2}"
  count="1"
  while [[ "${count}" != "" ]]; do
    timestamp=$(get-timestamp)
    count=$(aws rds describe-db-instances \
      --region="${region}" \
      --db-instance-identifier "${instance}" 2>/dev/null \
      --output json \
      | jq -r '.DBInstances | length')
    echo -e "\t\t[${timestamp}] Waiting..."
    sleep 5
  done
}

# Delete the existing instance.
echo "Deleting database (if exists): ${instance_identifier}"
aws rds delete-db-instance \
  --db-instance-identifier="${instance_identifier}" \
  --region="${region}" \
  --skip-final-snapshot > /dev/null 2>&1

echo "Waiting for deletion..."
wait-until-deleted "${instance_identifier}" "${region}"
echo "Instance deleted (if it existed)"
