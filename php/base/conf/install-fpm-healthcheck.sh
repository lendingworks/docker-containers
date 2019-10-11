#!/usr/bin/env bash

set -xe

if [[ ${PHP_TYPE:-} != 'fpm' ]]; then
  echo -e "Skipping FPM health check install, not a FPM container."
  exit 0
fi

# fcgi is required for the health check.
apk add --no-cache fcgi

FPM_HEALTHCHECK_VERSION=${FPM_HEALTHCHECK_VERSION:-0.3.0}

curl --silent --location \
  "https://raw.githubusercontent.com/renatomefi/php-fpm-healthcheck/v${FPM_HEALTHCHECK_VERSION}/php-fpm-healthcheck"
  --output /usr/local/bin/php-fpm-healthcheck

chmod +x /usr/local/bin/php-fpm-healthcheck

echo -e "Installed v${FPM_HEALTHCHECK_VERSION} of the FPM health check."
