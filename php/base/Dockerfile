# One of 'cli' or 'fpm' (as per https://hub.docker.com/_/php/).
ARG PHP_TYPE
ARG PHP_VERSION=7.2
FROM php:${PHP_VERSION}-${PHP_TYPE}-alpine

# Increment this to trigger a full rebuild.
ENV CONTAINER_VERSION '1.0.0'

# Fix `iconv` issues with Alpine.
# This needs to run before we do any other installs.
# See https://github.com/docker-library/php/issues/240
RUN apk add --no-cache --update gnu-libiconv
ENV LD_PRELOAD /usr/lib/preloadable_libiconv.so php

RUN apk add --no-cache --update --virtual build-deps \
    autoconf \
    g++ \
    make \
    zlib-dev \
    freetype \
    libjpeg-turbo \
    freetype-dev \
    libpng-dev \
    libjpeg-turbo-dev \
    libxml2-dev \
    curl-dev \
    postgresql-dev \
    libmemcached-dev \
    cyrus-sasl-dev \
    zlib-dev \
    linux-headers \
  && apk add --no-cache \
    socat \
    libpng \
    libmemcached \
    bash \
    sed \
    mysql-client \
    postgresql-client \
    curl \
    wget \
    sudo \
    doas \
    tzdata \
  && docker-php-ext-install -j$(nproc) \
    exif \
    mbstring \
    zip \
    bcmath \
    gd \
    curl \
    json \
    pdo \
    pdo_mysql \
    pdo_pgsql \
    opcache \
    soap \
    xml \
    pcntl \
    iconv \
  && pecl install igbinary memcached redis grpc \
  && docker-php-ext-enable igbinary memcached redis grpc \
  && rm -rf /tmp/pear \
  && apk del --no-cache build-deps

# Allow root to execute things as www-data, via `doas`.
RUN echo -e "permit nopass keepenv root as www-data" >> /etc/doas.conf

# Install drush.
RUN curl -s -L https://github.com/drush-ops/drush/releases | egrep -o '/drush-ops/drush/releases/download/[v.0-8]*/drush.phar' | head -n1 | wget --base=http://github.com/ -i - -O /usr/local/bin/drush
RUN chmod +x /usr/local/bin/drush

# Install composer & prestissimo for parallel installs.
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer \
  && mkdir /.composer \
  && composer global require hirak/prestissimo

# FPM health check.
COPY ./conf/install-fpm-healthcheck.sh /usr/local/bin/install-fpm-healthcheck
ENV FPM_HEALTHCHECK_VERSION="0.4.0"
ARG PHP_TYPE
RUN /usr/local/bin/install-fpm-healthcheck ${PHP_TYPE} ${FPM_HEALTHCHECK_VERSION}

# NewRelic setup.
ENV NEWRELIC_VERSION="9.11.0.267"
RUN mkdir -p /opt && cd /opt \
  && export NEWRELIC_RELEASE="newrelic-php5-${NEWRELIC_VERSION}-linux-musl" \
  && wget "http://download.newrelic.com/php_agent/archive/${NEWRELIC_VERSION}/${NEWRELIC_RELEASE}.tar.gz" \
  && gzip -dc ${NEWRELIC_RELEASE}.tar.gz | tar xf - \
  && cd "${NEWRELIC_RELEASE}" \
  && NR_INSTALL_SILENT=true NR_INSTALL_USE_CP_NOT_LN=true ./newrelic-install install \
  && cd .. \
  && rm -rf "${NEWRELIC_RELEASE}"*

# Disabled by default.
ENV NEWRELIC_ENABLED=0

COPY ./conf/fpm-zz-docker.conf /usr/local/etc/php-fpm.d/zz-docker.conf
EXPOSE 9090

COPY ./conf/php.ini /usr/local/etc/php/

RUN mkdir -p /data/www
WORKDIR /data/www
