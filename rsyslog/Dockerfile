ARG ALPINE_VERSION=3.7
FROM alpine:${ALPINE_VERSION}

ARG RSYSLOG_VERSION

RUN apk add --no-cache --update rsyslog=${RSYSLOG_VERSION} bash \
  && rm -f /tmp/* /etc/apk/cache/*

COPY ./conf/ /etc/

VOLUME /var/run/rsyslog/dev

EXPOSE 514/tcp 514/udp

ENTRYPOINT ["rsyslogd", "-n", "-f", "/etc/rsyslogd.conf"]
