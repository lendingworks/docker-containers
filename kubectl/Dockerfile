ARG ALPINE_VERSION=3.10
FROM alpine:${ALPINE_VERSION}

ARG KUBECTL_VERSION=1.16.12

RUN apk add --update --no-cache \
  bash \
  curl \
  python3 \
  && pip3 install --upgrade kubernetes \
  && rm -f /tmp/* /etc/apk/cache/*

RUN curl --silent --location \
  "https://storage.googleapis.com/kubernetes-release/release/v${KUBECTL_VERSION}/bin/linux/amd64/kubectl" \
  --output /usr/local/bin/kubectl \
  && chmod +x /usr/local/bin/kubectl

ENTRYPOINT [ "kubectl" ]
