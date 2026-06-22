FROM node:20-alpine

RUN apk add --no-cache bash curl git

WORKDIR /gressus/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend .
COPY docker/frontend/start.sh /start.sh
RUN sed -i 's/\r$//' /start.sh && chmod +x /start.sh

EXPOSE 5173

CMD ["/start.sh"]
