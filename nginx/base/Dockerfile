ARG NGINX_VERSION=1.13
FROM nginx:${NGINX_VERSION}-alpine

# This has to come after the FROM.
# ARG APPLICATION

RUN apk add --no-cache --update bash \
  && rm -f /tmp/* /etc/apk/cache/*

# Add SSL certificates for the app (these are signed by our own CA).
# COPY ./conf/${APPLICATION}/ssl/ssl.crt /etc/nginx/ssl/ssl.crt
# COPY ./conf/${APPLICATION}/ssl/ssl.key /etc/nginx/ssl/ssl.key

# Custom config.
RUN touch /etc/nginx/conf.d/application.conf
COPY ./conf/nginx.conf /etc/nginx/nginx.conf
# COPY ./conf/${APPLICATION}/application.conf /etc/nginx/conf.d/application.conf

EXPOSE 80 443
