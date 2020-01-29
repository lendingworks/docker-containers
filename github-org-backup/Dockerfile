FROM node:12-alpine as builder

RUN mkdir -p /app
WORKDIR /app

COPY ./src /app

RUN yarn install --non-interactive --pure-lockfile && yarn run build

FROM node:12-alpine as runner

ENV NPM_CONFIG_LOGLEVEL info
ENV LOGLEVEL info
ENV NODE_ENV production

RUN apk add --update --no-cache ca-certificates tzdata \
    && rm -f /tmp/* /etc/apk/cache/*

ENV TZ Europe/London

RUN addgroup -S app && adduser -S -g app app
RUN mkdir -p /app /home/app && chown -R app:app /app
WORKDIR /app
ENV HOME /home/app
USER app

COPY --from=builder /app/dist/index.js /app/index.js

CMD ["node", "/app/index.js"]
