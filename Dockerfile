FROM node:24-alpine
COPY package.json package.json
COPY pnpm-lock.yaml pnpm-lock.yaml
RUN corepack enable && pnpm install

# install bksp certificate
RUN mkdir -p /usr/share/ca-certificates/bksp
RUN curl -fSsl https://ca.bksp.in/root/bksp-root.crt | tee /usr/share/ca-certificates/bksp/B4CKSP4CE_Root_CA.crt
RUN echo "bksp/B4CKSP4CE_Root_CA.crt" | tee -a /etc/ca-certificates.conf
RUN update-ca-certificates

COPY . .
CMD ["pnpm", "start"]