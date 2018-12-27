ARG NGINX_VERSION=1.15
FROM nginx:${NGINX_VERSION}-alpine

# Increment this to trigger a full rebuild.
ENV CONTAINER_VERSION '1.0.0'

RUN apk add --no-cache --update sudo tzdata bash \
  && rm -f /tmp/* /etc/apk/cache/*

COPY ./conf/run.sh /usr/local/bin/nginx-run-wrapper

# Custom config, add this into any sub-containers.
RUN touch /etc/nginx/conf.d/application.conf
COPY ./conf/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443

CMD ["/usr/local/bin/nginx-run-wrapper", "-g", "daemon off;"]
