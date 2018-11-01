# We can't build this on alpine due to issues with muslc.
ARG DEBIAN_VERSION=9.5
FROM debian:${DEBIAN_VERSION} as builder

ARG CORVUS_VERSION=0.2.7

RUN DEBIAN_FRONTEND=noninteractive apt-get update \
  && apt-get install -y build-essential wget autoconf

RUN mkdir -p /opt && cd /opt \
  && wget "https://github.com/eleme/corvus/releases/download/v${CORVUS_VERSION}/corvus-${CORVUS_VERSION}.tar.bz2" \
  && tar xvjf "corvus-${CORVUS_VERSION}.tar.bz2" \
  && cd "corvus-${CORVUS_VERSION}" \
  && make deps \
  && make

FROM debian:${DEBIAN_VERSION} as runner

ARG CORVUS_VERSION=0.2.7

COPY --from=builder "/opt/corvus-${CORVUS_VERSION}/src/corvus" /corvus

RUN DEBIAN_FRONTEND=noninteractive apt-get update \
  && apt-get install -y wget bash procps redis-tools \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN wget -O /usr/local/bin/gomplate https://github.com/hairyhenderson/gomplate/releases/download/v1.9.1/gomplate_linux-amd64-slim \
  && chmod 755 /usr/local/bin/gomplate

COPY ./corvus.conf.template /corvus.conf.template
COPY ./entrypoint.sh /docker-entrypoint

ENTRYPOINT ["/docker-entrypoint"]
EXPOSE 6379
