ARG ALPINE_VERSION=3.9
FROM alpine:${ALPINE_VERSION}

RUN apk add --update --no-cache bash socat curl \
  && rm -f /tmp/* /etc/apk/cache/*

ENV NEWRELIC_VERSION="9.7.0.258"
RUN mkdir -p /opt && cd /opt \
  && export NEWRELIC_RELEASE="newrelic-php5-${NEWRELIC_VERSION}-linux-musl" \
  && wget "http://download.newrelic.com/php_agent/archive/${NEWRELIC_VERSION}/${NEWRELIC_RELEASE}.tar.gz" \
  && gzip -dc ${NEWRELIC_RELEASE}.tar.gz | tar xf - \
  && cp "${NEWRELIC_RELEASE}/daemon/newrelic-daemon.x64" /usr/bin/newrelic-daemon \
  && rm -rf "${NEWRELIC_RELEASE}"*

COPY ./conf/newrelic.cfg /etc/newrelic/
COPY ./conf/run.sh /newrelic-run

# The port that the NewRelic daemon launches on, this is configured in
# conf/newrelic.cfg too.
ENV NEWRELIC_AGENT_PORT=3018
# The port that we expose the daemon port on, this is what other containers
# should connect to.
ENV NEWRELIC_CONTAINER_PORT=3019

ENV IS_KUBERNETES=0

EXPOSE 3019
CMD ["/newrelic-run"]
