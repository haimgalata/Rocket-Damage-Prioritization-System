# ── Stage 1: Build ────────────────────────────────────────────────────────────
# Use Node 20 Alpine to compile the Vite + TypeScript + React application.
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (cached layer — only re-runs when package files change).
COPY package.json package-lock.json ./
RUN npm install --network-timeout=100000 --no-package-lock


# Copy source and build.
# VITE_API_URL is injected at build time via --build-arg in docker-compose.yml.
# Default value keeps local `npm run dev` pointing at the FastAPI dev server directly.
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build


# ── Stage 2: Serve ────────────────────────────────────────────────────────────
# Lightweight Nginx Alpine image — serves the compiled static assets and
# proxies /api/* requests to the backend container (see nginx.conf).
FROM nginx:alpine

# Copy compiled assets from the build stage.
COPY --from=builder /app/dist /usr/share/nginx/html

# Replace the default Nginx config with our custom SPA + proxy config.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]