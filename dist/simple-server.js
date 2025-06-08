"use strict";
const { Hono } = require('hono');
const { serve } = require('@hono/node-server');
const { serveStatic } = require('@hono/node-server/serve-static');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
// 簡単なJavaScript版のGitHub Uploader
const app = new Hono();
// 静的ファイル配信
app.use('/static/*', serveStatic({ root: './public' }));
// ヘルスチェック
app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'GitHub Uploader',
        version: '1.0.0'
    });
});
// メインページ
app.get('/', async (c) => {
    try {
        const html = await fs.readFile(path.join(__dirname, '../views/index.html'), 'utf-8');
        return c.html(html);
    }
    catch (error) {
        return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>GitHub Uploader</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; text-align: center; }
          .container { max-width: 600px; margin: 0 auto; }
          .btn { background: #0066cc; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; }
          .btn:hover { background: #0052a3; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📱 GitHub Uploader</h1>
          <p>モバイル対応のGitHubプロジェクトアップロードサービス</p>
          <p>現在開発中です...</p>
          <button class="btn" onclick="window.location.href='/auth/github'">GitHubでログイン</button>
        </div>
      </body>
      </html>
    `);
    }
});
// GitHub OAuth（簡易版）
app.get('/auth/github', (c) => {
    const clientId = process.env.GITHUB_CLIENT_ID || 'demo';
    const redirectUri = encodeURIComponent(process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/auth/github/callback');
    const state = Math.random().toString(36).substring(7);
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo&state=${state}`;
    return c.redirect(githubUrl);
});
// OAuth コールバック
app.get('/auth/github/callback', (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    if (!code) {
        return c.html(`
      <h1>認証エラー</h1>
      <p>GitHub認証に失敗しました。</p>
      <a href="/">戻る</a>
    `);
    }
    return c.html(`
    <h1>認証成功</h1>
    <p>GitHub認証が完了しました。</p>
    <p>Code: ${code}</p>
    <p>State: ${state}</p>
    <a href="/">ホームに戻る</a>
  `);
});
// API情報
app.get('/api', (c) => {
    return c.json({
        name: 'GitHub Uploader API',
        version: '1.0.0',
        description: 'モバイル対応のGitHubプロジェクトアップロードサービス',
        endpoints: {
            health: 'GET /health',
            auth: 'GET /auth/github',
            callback: 'GET /auth/github/callback',
            upload: 'POST /api/upload (開発中)',
            repositories: 'GET /api/repositories (開発中)'
        },
        status: 'development'
    });
});
// 404ハンドラー
app.notFound((c) => {
    return c.html(`
    <h1>404 - ページが見つかりません</h1>
    <p><a href="/">ホームに戻る</a></p>
  `);
});
// エラーハンドラー
app.onError((err, c) => {
    console.error('Error:', err);
    return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});
// サーバー起動
const port = parseInt(process.env.PORT || '3000');
console.log(`🚀 GitHub Uploader starting on port ${port}`);
console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔗 GitHub Client ID: ${process.env.GITHUB_CLIENT_ID ? 'configured' : 'not configured'}`);
serve({
    fetch: app.fetch,
    port: port
});
console.log(`✅ Server running at http://localhost:${port}`);
//# sourceMappingURL=simple-server.js.map