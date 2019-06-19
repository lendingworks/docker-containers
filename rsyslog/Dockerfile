ARG ALPINE_VERSION=3.9
FROM alpine:${ALPINE_VERSION}

ARG RSYSLOG_VERSION=8.40.0-r3

RUN apk add --no-cache --update rsyslog=${RSYSLOG_VERSION} bash \
  && rm -f /tmp/* /etc/apk/cache/*

# Define this to override the remote logs location.
ENV REMOTE_LOG_SERVER "logs.lendingworks.prod"

COPY ./conf/ /etc/
RUN mv /etc/entrypoint.sh /usr/bin/rsyslog-run

VOLUME /var/run/rsyslog/dev

EXPOSE 514/tcp 514/udp

ENTRYPOINT ["/usr/bin/rsyslog-run"]
