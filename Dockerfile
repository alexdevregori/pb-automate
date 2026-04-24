# --- Stage 1: build frontend ---
FROM node:18-slim AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# --- Stage 2: backend runtime ---
FROM node:18-slim
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/src/ ./src/

# Copy built frontend into backend's public/ for express.static
COPY --from=frontend /frontend/dist ./public

ENV PORT=8080
EXPOSE 8080

CMD ["node", "src/index.js"]
