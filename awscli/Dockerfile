ARG ALPINE_VERSION=3.9
FROM alpine:${ALPINE_VERSION}

ARG AWSCLI_VERSION=1.18.104

RUN apk add --update --no-cache \
    bash \
    curl \
    python3 \
    jq \
    pv \
    tzdata \
    mysql-client=10.3.25-r0 \
    postgresql-client=11.10-r0 \
  && pip3 install --upgrade awscli==${AWSCLI_VERSION} boto3 \
  && rm -f /tmp/* /etc/apk/cache/*

COPY ./conf/rds-delete.sh /usr/local/bin/rds-delete
COPY ./conf/rds-restore.sh /usr/local/bin/rds-restore
COPY ./conf/rds-restore-aurora.sh /usr/local/bin/rds-restore-aurora
COPY ./conf/rds-delete-aurora.sh /usr/local/bin/rds-delete-aurora
COPY ./conf/rds-endpoint-aurora.sh /usr/local/bin/rds-endpoint-aurora
COPY ./conf/aurora /usr/local/aws-aurora

ENTRYPOINT [ "aws" ]
