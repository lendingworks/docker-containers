# Build Pyrseas.
FROM python:3.7 as pyrseas-builder

ARG DEBIAN_FRONTEND=noninteractive
ARG PYRSEAS_VERSION=0.9.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential gcc \
  && python -m venv /opt/venv

ENV PATH="/opt/venv/bin:$PATH"
RUN pip install pyrseas==${PYRSEAS_VERSION}

# Build DBDiff (this is an alpine image).
FROM composer:1 as dbdiff-builder

ARG DBDIFF_VERSION=08270201d370ae1ab22ccbc9bdcdf42af328a44f

RUN apk add --update --no-cache unzip wget \
  && mkdir -p /opt && cd /opt \
  && wget https://github.com/DBDiff/DBDiff/archive/${DBDIFF_VERSION}.zip \
  && unzip ${DBDIFF_VERSION}.zip \
  && mv DBDiff-${DBDIFF_VERSION} dbdiff \
  && cd dbdiff \
  && composer install -o --no-dev

# Final run stage.
FROM python:3.7

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    wget bash apt-transport-https lsb-release ca-certificates postgresql-client default-mysql-client \
  && wget -O /etc/apt/trusted.gpg.d/php.gpg https://packages.sury.org/php/apt.gpg \
  && echo "deb https://packages.sury.org/php/ $(lsb_release -sc) main" > /etc/apt/sources.list.d/php.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends php7.3-cli php7.3-mysql \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* \
  && mkdir -p /opt

COPY --from=pyrseas-builder /opt/venv /opt/venv
COPY --from=dbdiff-builder /opt/dbdiff /opt/dbdiff

ENV PATH="/opt/venv/bin:$PATH"
RUN ln -sfv /opt/dbdiff/dbdiff /usr/local/bin/dbdiff

COPY ./entrypoint.sh /docker-entrypoint

ENTRYPOINT [ "/docker-entrypoint" ]
