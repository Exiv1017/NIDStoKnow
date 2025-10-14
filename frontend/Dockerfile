FROM node:20-bullseye-slim AS build

WORKDIR /app

# Copy package files and install
COPY package*.json ./
# Set npm config to be more resilient in CI/builds
RUN npm config set fetch-retries 5 \
	&& npm config set fetch-retry-maxtimeout 120000 \
	&& npm config set fetch-retry-mintimeout 20000 \
	&& npm config set prefer-online true \
	&& npm config set legacy-peer-deps true \
	&& npm --version \
	&& node --version \
	&& npm install

# Copy source and build
COPY . .
# Ensure Vite uses the ESM config (vite.config.mjs) automatically
ENV NODE_ENV=production
RUN npm run build

# --- Runtime image with Nginx reverse proxy ---
FROM nginx:alpine

# Copy built assets (includes /samples from Vite public)
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx config to serve SPA and proxy /api to backend
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]