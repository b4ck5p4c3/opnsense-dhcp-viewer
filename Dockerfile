FROM node:24-alpine
COPY package.json package.json
COPY pnpm-lock.yaml pnpm-lock.yaml
RUN corepack enable && pnpm install

# install bksp certificate
RUN apk update && apk add curl && curl -fSsl https://ca.bksp.in/root/bksp-root.crt -o /etc/ssl/certs/B4CKSP4CE_Root_CA.crt

COPY . .
CMD ["pnpm", "start"]