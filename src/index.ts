import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { config } from './utils/config.js';
import { 
  corsMiddleware, 
  errorHandler, 
  requestLogger, 
  securityHeaders,
  RateLimiter
} from './middleware/auth.js';
import { GitHubUser, UserSession } from './types/index.js';

// ルートのインポート
import authRoutes from './routes/auth.js';
import uploadRoutes from './routes/upload.js';

// Honoの型拡張
type Variables = {
  user: GitHubUser;
  session: UserSession;
};

// アプリケーション初期化
const app = new Hono<{ Variables: Variables }>();

// レート制限設定
const rateLimiter = new RateLimiter(60000, 100); // 1分間に100リクエスト

// グローバルミドルウェア
app.use('*', requestLogger);
app.use('*', errorHandler);
app.use('*', corsMiddleware);
app.use('*', securityHeaders);
app.use('*', rateLimiter.middleware);

// 静的ファイル配信
app.use('/css/*', serveStatic({ root: './public' }));
app.use('/js/*', serveStatic({ root: './public' }));
app.use('/images/*', serveStatic({ root: './public' }));
app.use('/favicon.ico', serveStatic({ path: './public/favicon.ico' }));

// メインページ
app.get('/', serveStatic({ path: './views/index.html' }));

// API ルート
app.route('/auth', authRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/upload', uploadRoutes);

// ヘルスチェック
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API情報
app.get('/api', (c) => {
  return c.json({
    name: 'GitHub Uploader API',
    version: '1.0.0',
    description: 'モバイル対応のGitHubプロジェクトアップロードサービス',
    endpoints: {
      auth: {
        'GET /auth/github': 'GitHub OAuth認証開始',
        'GET /auth/github/callback': 'GitHub OAuth コールバック',
        'POST /api/auth/logout': 'ログアウト',
        'GET /api/auth/status': '認証状態確認',
        'GET /api/auth/profile': 'ユーザープロフィール取得'
      },
      upload: {
        'POST /api/upload': 'ファイルアップロード＆リポジトリ作成',
        'GET /api/upload/status/:uploadId': 'アップロード進行状況取得',
        'GET /api/upload/repositories': 'ユーザーリポジトリ一覧'
      },
      system: {
        'GET /health': 'ヘルスチェック',
        'GET /api': 'API情報'
      }
    },
    features: [
      'GitHub OAuth認証',
      'tar.gz ファイルアップロード',
      '自動リポジトリ作成',
      'モバイル対応UI',
      'レート制限',
      'セキュリティヘッダー',
      'エラーハンドリング'
    ]
  });
});

// 404 ハンドラー
app.notFound((c) => {
  const accept = c.req.header('Accept') || '';
  
  if (accept.includes('application/json')) {
    return c.json({
      success: false,
      error: 'NOT_FOUND',
      message: 'エンドポイントが見つかりません',
      path: c.req.path
    }, 404);
  }
  
  // HTML レスポンス（SPA対応）
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>404 - ページが見つかりません | GitHub Uploader</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #f8f9fa;
          color: #212529;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .container {
          text-align: center;
          max-width: 500px;
          padding: 2rem;
        }
        .error-code {
          font-size: 6rem;
          font-weight: 700;
          color: #0366d6;
          margin-bottom: 1rem;
        }
        .error-message {
          font-size: 1.5rem;
          margin-bottom: 1rem;
        }
        .error-description {
          color: #6c757d;
          margin-bottom: 2rem;
        }
        .btn {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          background-color: #0366d6;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 500;
          transition: background-color 0.2s;
        }
        .btn:hover {
          background-color: #0256cc;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="error-code">404</div>
        <div class="error-message">ページが見つかりません</div>
        <div class="error-description">
          お探しのページは存在しないか、移動された可能性があります。
        </div>
        <a href="/" class="btn">ホームに戻る</a>
      </div>
    </body>
    </html>
  `, 404);
});

// サーバー起動
const port = config.get('port');

console.log(`🚀 GitHub Uploader starting...`);
console.log(`📱 Environment: ${config.get('nodeEnv')}`);
console.log(`🔧 Port: ${port}`);
console.log(`🔐 GitHub OAuth: ${config.get('github').clientId ? 'Configured' : 'Not configured'}`);

serve({
  fetch: app.fetch,
  port: port
}, (info) => {
  console.log(`✅ Server is running on http://localhost:${info.port}`);
  console.log(`🌐 Access the app at: http://localhost:${info.port}`);
  console.log(`📚 API documentation: http://localhost:${info.port}/api`);
  console.log(`❤️  Health check: http://localhost:${info.port}/health`);
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// 未処理の例外をキャッチ
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default app;

