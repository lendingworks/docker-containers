FROM php:7.2-fpm-alpine3.7
MAINTAINER Chin Godawita <chinthaka.godawita@lendingworks.co.uk>

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
    libpng \
    libmemcached \
    bash \
    sed \
    mysql-client \
    postgresql-client \
    curl \
  && docker-php-ext-install -j$(nproc) \
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
  && pecl install igbinary memcached redis \
  && docker-php-ext-enable igbinary memcached redis \
  && rm -rf /tmp/pear \
  && apk del --no-cache build-deps

