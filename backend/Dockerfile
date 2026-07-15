FROM node:20-slim

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000

CMD ["node", "src/server.js"]