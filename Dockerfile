FROM node:16
WORKDIR /app
COPY --chown=node:node . /app
RUN npm install --silent -g pnpm && groupmod -g 1003 node && chown node:node /app
USER node
RUN pnpm i --silent && pnpx tsc --project tsconfig.build.json
HEALTHCHECK --interval=15s --timeout=5s CMD curl -f http://localhost:8080/api/v1/status || exit 1
ENV NODE_PATH=js/
CMD ["node", "js/main.js"]
