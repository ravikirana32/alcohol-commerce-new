FROM node:22-alpine
WORKDIR /workspace
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/
RUN npm install
COPY apps/api ./apps/api
COPY apps/web ./apps/web
EXPOSE 8080
CMD ["npm", "run", "dev", "--workspace", "@acp/api"]
