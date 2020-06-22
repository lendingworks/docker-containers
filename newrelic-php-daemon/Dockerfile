ARG ALPINE_VERSION=3.11
FROM alpine:${ALPINE_VERSION}

RUN apk add --update --no-cache bash curl \
  && rm -f /tmp/* /etc/apk/cache/*

ENV NEWRELIC_VERSION="9.11.0.267"
RUN mkdir -p /opt && cd /opt \
  && export NEWRELIC_RELEASE="newrelic-php5-${NEWRELIC_VERSION}-linux-musl" \
  && wget "http://download.newrelic.com/php_agent/archive/${NEWRELIC_VERSION}/${NEWRELIC_RELEASE}.tar.gz" \
  && gzip -dc ${NEWRELIC_RELEASE}.tar.gz | tar xf - \
  && cp "${NEWRELIC_RELEASE}/daemon/newrelic-daemon.x64" /usr/bin/newrelic-daemon \
  && rm -rf "${NEWRELIC_RELEASE}"*

COPY ./conf/newrelic.cfg /etc/newrelic/
COPY ./conf/run.sh /newrelic-run

# The address & port that the NewRelic daemon will bind to.
ENV NEWRELIC_DAEMON_ADDRESS="0.0.0.0:3019"

ENV IS_KUBERNETES=0

# This should match the port above.
EXPOSE 3019

CMD ["/newrelic-run"]
