#!/usr/bin/env bash

set -xe

if [[ "$#" -ne 2 ]]; then
  echo -e "Usage: install-fpm-healthcheck PHP_TYPE VERSION"
  echo -e "  PHP_TYPE must be one of 'fpm' or 'cli'"
  echo -e "  VERSION is a git release tag from github.com/renatomefi/php-fpm-healthcheck"
  exit 1
fi

PHP_TYPE=${1:-}
FPM_HEALTHCHECK_VERSION=${2:-}

if [[ ${PHP_TYPE:-} != 'fpm' ]]; then
  echo -e "Skipping FPM health check install, not a FPM container."
  exit 0
fi

# fcgi is required for the health check.
apk add --no-cache fcgi

curl --silent --location \
  "https://raw.githubusercontent.com/renatomefi/php-fpm-healthcheck/v${FPM_HEALTHCHECK_VERSION}/php-fpm-healthcheck" \
  --output /usr/local/bin/php-fpm-healthcheck

chmod +x /usr/local/bin/php-fpm-healthcheck

echo -e "Installed v${FPM_HEALTHCHECK_VERSION} of the FPM health check."
