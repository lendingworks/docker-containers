ARG ALPINE_VERSION=3.9
FROM alpine:${ALPINE_VERSION}

RUN apk add --update --no-cache bash socat curl \
  && rm -f /tmp/* /etc/apk/cache/*

RUN mkdir -p /opt && cd /opt \
  && export NEWRELIC_VERSION=$(curl -sS https://download.newrelic.com/php_agent/release/ | sed -n 's/.*>\(.*linux-musl\).tar.gz<.*/\1/p') \
  && wget "http://download.newrelic.com/php_agent/release/${NEWRELIC_VERSION}.tar.gz" \
  && gzip -dc ${NEWRELIC_VERSION}.tar.gz | tar xf - \
  && cp "${NEWRELIC_VERSION}/daemon/newrelic-daemon.x64" /usr/bin/newrelic-daemon \
  && rm -rf "${NEWRELIC_VERSION}"*

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
