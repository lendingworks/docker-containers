ARG ALPINE_VERSION=3.8
FROM alpine:${ALPINE_VERSION}

RUN apk add --update --no-cache bash util-linux \
  && rm -f /tmp/* /etc/apk/cache/*

ENV SECRET_FILE="unknown"

COPY ./syncer.sh /syncer

RUN mkdir -p /sync/src && mkdir -p /sync/dest

VOLUME [ "/sync/dest" ]

CMD ["/syncer"]
