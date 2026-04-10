# ── Stage 1: Build Rust → WASM ─────────────────────────────────────────────
FROM rust:1.82-slim AS wasm-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install wasm-pack
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

WORKDIR /build

# Cache Rust deps
COPY dice-wasm/Cargo.toml dice-wasm/Cargo.lock* ./dice-wasm/
RUN mkdir -p dice-wasm/src && \
    echo 'pub fn placeholder() {}' > dice-wasm/src/lib.rs && \
    cd dice-wasm && cargo build --release --target wasm32-unknown-unknown 2>/dev/null || true

# Full build
COPY dice-wasm/ ./dice-wasm/
RUN cd dice-wasm && \
    wasm-pack build --target bundler --out-dir ../frontend-wasm


# ── Stage 2: Build TypeScript frontend ────────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci --prefer-offline

COPY frontend/ ./
# Copy WASM output from previous stage
COPY --from=wasm-builder /build/frontend-wasm ./src/wasm/

RUN npm run build


# ── Stage 3: Serve with nginx ──────────────────────────────────────────────
FROM nginx:1.25-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
