FROM fluent/fluentd:v1.3.1

# from the fluentd docker hub example documentation: https://hub.docker.com/r/fluent/fluentd/

RUN apk add --update --virtual .build-deps sudo build-base ruby-dev \
 && sudo gem install fluent-plugin-elasticsearch \
 && sudo gem sources --clear-all \
 && apk del .build-deps \
 && rm -rf /var/cache/apk/* /home/fluent/.gem/ruby/2.5.0/cache/*.gem
