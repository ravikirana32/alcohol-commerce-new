FROM node:22-alpine
WORKDIR /workspace
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/
RUN npm install
COPY apps/web ./apps/web
COPY apps/api ./apps/api
EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace", "@acp/web"]
