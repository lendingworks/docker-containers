ARG ALPINE_VERSION=3.8
FROM alpine:${ALPINE_VERSION}

ARG AWSCLI_VERSION=1.16.57

RUN apk add --update --no-cache \
    bash \
    curl \
    python \
    py-pip \
  && pip install --upgrade awscli==${AWSCLI_VERSION} \
  && apk -v --purge del py-pip \
  && rm -f /tmp/* /etc/apk/cache/*

ENTRYPOINT [ "aws" ]