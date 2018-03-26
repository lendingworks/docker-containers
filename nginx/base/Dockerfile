ARG NGINX_VERSION=1.13
FROM nginx:${NGINX_VERSION}-alpine

RUN apk add --no-cache --update bash \
  && rm -f /tmp/* /etc/apk/cache/*

# Custom config, add this into any sub-containers.
RUN touch /etc/nginx/conf.d/application.conf
COPY ./conf/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443
