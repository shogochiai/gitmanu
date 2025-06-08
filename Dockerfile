# GitHub Uploader - Production Dockerfile
FROM node:20-alpine AS builder

# 作業ディレクトリを設定
WORKDIR /app

# パッケージファイルをコピー
COPY package*.json ./
COPY tsconfig.json ./

# 依存関係をインストール
RUN npm ci --only=production

# ソースコードをコピー
COPY src/ ./src/
COPY public/ ./public/
COPY views/ ./views/

# TypeScriptをビルド
RUN npm run build

# 本番用イメージ
FROM node:20-alpine AS production

# セキュリティ: 非rootユーザーを作成
RUN addgroup -g 1001 -S nodejs && \
    adduser -S github-uploader -u 1001

# 必要なパッケージをインストール
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# 作業ディレクトリを設定
WORKDIR /app

# 依存関係をコピー
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# ビルド済みファイルをコピー
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/views ./views

# 一時ディレクトリを作成
RUN mkdir -p temp uploads && \
    chown -R github-uploader:nodejs /app

# 非rootユーザーに切り替え
USER github-uploader

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# ポートを公開
EXPOSE 3000

# アプリケーションを起動
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

