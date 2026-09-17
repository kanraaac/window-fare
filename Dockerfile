FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY public ./public
ENV NODE_ENV=production
ENV PORT=18080
EXPOSE 18080
CMD ["node", "server.js"]
