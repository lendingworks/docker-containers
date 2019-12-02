# One of 'cli' or 'fpm' (as per https://hub.docker.com/_/php/).
ARG PHP_TYPE
ARG PHP_VERSION=7.2
FROM php:${PHP_VERSION}-${PHP_TYPE}-alpine

# Increment this to trigger a full rebuild.
ENV CONTAINER_VERSION '1.0.0'

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
  && pecl install igbinary memcached redis \
  && docker-php-ext-enable igbinary memcached redis \
  && rm -rf /tmp/pear \
  && apk del --no-cache build-deps

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
ENV NEWRELIC_VERSION="8.7.0.242"
RUN mkdir -p /opt && cd /opt \
  && export NEWRELIC_RELEASE="newrelic-php5-${NEWRELIC_VERSION}-linux-musl" \
  && wget "http://download.newrelic.com/php_agent/archive/${NEWRELIC_VERSION}/${NEWRELIC_RELEASE}.tar.gz" \
  && gzip -dc ${NEWRELIC_RELEASE}.tar.gz | tar xf - \
  && cd "${NEWRELIC_RELEASE}" \
  && NR_INSTALL_SILENT=true NR_INSTALL_USE_CP_NOT_LN=true ./newrelic-install install \
  && cd .. \
  && rm -rf "${NEWRELIC_RELEASE}"*

# Disabled till NewRelic fix the memory leak in agent version 9.
# RUN mkdir -p /opt && cd /opt \
#   && export NEWRELIC_VERSION=$(curl -sS https://download.newrelic.com/php_agent/release/ | sed -n 's/.*>\(.*linux-musl\).tar.gz<.*/\1/p') \
#   && wget "http://download.newrelic.com/php_agent/release/${NEWRELIC_VERSION}.tar.gz" \
#   && gzip -dc ${NEWRELIC_VERSION}.tar.gz | tar xf - \
#   && cd "${NEWRELIC_VERSION}" \
#   && NR_INSTALL_SILENT=true NR_INSTALL_USE_CP_NOT_LN=true ./newrelic-install install \
#   && cd .. \
#   && rm -rf "${NEWRELIC_VERSION}"*

# Disabled by default.
ENV NEWRELIC_ENABLED=0

COPY ./conf/fpm-zz-docker.conf /usr/local/etc/php-fpm.d/zz-docker.conf
EXPOSE 9090

COPY ./conf/php.ini /usr/local/etc/php/

RUN mkdir -p /data/www
WORKDIR /data/www
