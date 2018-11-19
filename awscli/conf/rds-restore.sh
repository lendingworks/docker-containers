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

if [[ "$#" -lt 9 ]]; then
  echo "Usage: rds-restore <source-instance-identifier> <new-instance-identifier> <instance-class> <storage-type> <region> <security-group> <subnet-group> <parameter-group> <restore-time> [storage-iops]"
  exit 1
fi

source_instance_identifier="${1}"
target_instance_identifier="${2}"
instance_class="${3}"
storage_type="${4}"
region="${5}"
security_group="${6}"
subnet_group="${7}"
parameter_group="${8}"
restore_time="${9}"
storage_iops="${10:-1000}"

function get-timestamp {
  date +"%H:%M:%S"
}

function wait-for-status {
  instance=$1
  region=$2
  target_status=$3
  status=unknown
  while [[ "${status}" != "${target_status}" ]]; do
    timestamp=$(get-timestamp)
    status=$(aws rds describe-db-instances \
        --region "${region}" \
        --db-instance-identifier "${instance}" \
        --output json \
        | jq -r '.DBInstances | .[] | .DBInstanceStatus')
    echo -e "\t\t[${timestamp}] Waiting, instance status is '${status}'..."
    sleep 5
  done
}

# Delete the existing instance if it exists.
rds-delete "${target_instance_identifier}" "${region}"

echo "Creating new database: ${target_instance_identifier}"
aws rds restore-db-instance-to-point-in-time \
  --region="${region}" \
  --source-db-instance-identifier="${source_instance_identifier}" \
  --target-db-instance-identifier="${target_instance_identifier}" \
  --db-instance-class="${instance_class}" \
  --restore-time="${restore_time}" \
  --no-multi-az \
  --no-auto-minor-version-upgrade \
  --db-subnet-group-name="${subnet_group}" \
  --storage-type="${storage_type}" \
  --iops="${storage_iops}"

echo "Waiting for new DB instance to be available"

wait-for-status "${target_instance_identifier}" "${region}" "available"

echo "New instance is available"

echo "Updating security and parameter groups, then disabling backup retention"

aws rds modify-db-instance \
  --db-instance-identifier="${target_instance_identifier}" \
  --region="${region}" \
  --vpc-security-group-ids "${security_group}" \
  --db-parameter-group-name "${parameter_group}" \
  --backup-retention-period 0 \
  --apply-immediately

echo "Waiting for new DB instance to be available"

# Modification doesn't happen immediately, sleep for a bit.
sleep 60

wait-for-status "${target_instance_identifier}" "${region}" "available"

echo "New instance '${target_instance_identifier}' is now available"
echo "Clone process is complete"
