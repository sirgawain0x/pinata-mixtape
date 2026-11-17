FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.mjs ./
USER node
ENV NODE_ENV=production
CMD ["npm", "start"]
