import { Context, Next } from 'hono';
import { sessionManager } from '../utils/session.js';
import { GitHubUser } from '../types/index.js';

// Re-export sessionManager for routes that need it
export { sessionManager };

/**
 * 認証ミドルウェア
 */
export const authMiddleware = async (c: Context, next: Next) => {
  try {
    // Cookieからセッショントークンを取得
    const sessionToken = c.req.header('Authorization')?.replace('Bearer ', '') ||
                        getCookieValue(c.req.header('Cookie') || '', 'session_token');

    if (!sessionToken) {
      c.set('user', null);
      c.set('session', null);
      await next();
      return;
    }

    // JWTトークンを検証
    const jwtPayload = sessionManager.verifyJWT(sessionToken);
    if (!jwtPayload) {
      c.set('user', null);
      c.set('session', null);
      await next();
      return;
    }

    // セッションを取得
    const session = sessionManager.getSession(jwtPayload.sessionId);
    if (!session) {
      c.set('user', null);
      c.set('session', null);
      await next();
      return;
    }

    // セッションを更新（有効期限延長）
    sessionManager.refreshSession(jwtPayload.sessionId);

    // ユーザー情報をコンテキストに設定
    const user: GitHubUser = {
      id: parseInt(session.userId),
      login: session.login,
      name: session.login, // 必要に応じて別途取得
      email: '', // 必要に応じて別途取得
      avatar_url: '', // 必要に応じて別途取得
      access_token: session.accessToken
    };

    c.set('user', user);
    c.set('session', session);

    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    c.set('user', null);
    c.set('session', null);
    await next();
  }
};

/**
 * 認証必須ミドルウェア
 */
export const requireAuth = async (c: Context, next: Next): Promise<Response | void> => {
  const user = c.get('user');
  
  if (!user) {
    return c.json({
      success: false,
      error: 'UNAUTHORIZED',
      message: '認証が必要です'
    }, 401);
  }
  
  await next();
};

/**
 * CORS ミドルウェア
 */
export const corsMiddleware = async (c: Context, next: Next): Promise<Response | void> => {
  // プリフライトリクエストの処理
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': c.req.header('Origin') || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  await next();

  // レスポンスヘッダーを設定
  c.header('Access-Control-Allow-Origin', c.req.header('Origin') || '*');
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
};

/**
 * エラーハンドリングミドルウェア
 */
export const errorHandler = async (c: Context, next: Next): Promise<Response | void> => {
  try {
    await next();
  } catch (error: any) {
    console.error('Request error:', error);

    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';

    return c.json({
      success: false,
      error: error.code || 'INTERNAL_ERROR',
      message: message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    }, statusCode);
  }
};

/**
 * リクエストログミドルウェア
 */
export const requestLogger = async (c: Context, next: Next) => {
  const start = Date.now();
  const method = c.req.method;
  const url = c.req.url;
  const userAgent = c.req.header('User-Agent') || 'Unknown';
  const ip = c.req.header('X-Forwarded-For') || 
             c.req.header('X-Real-IP') || 
             'Unknown';

  console.log(`[${new Date().toISOString()}] ${method} ${url} - ${ip} - ${userAgent}`);

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;
  
  console.log(`[${new Date().toISOString()}] ${method} ${url} - ${status} - ${duration}ms`);
};

/**
 * レート制限ミドルウェア
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // 定期的にクリーンアップ
    setInterval(() => this.cleanup(), this.windowMs);
  }

  middleware = async (c: Context, next: Next): Promise<Response | void> => {
    const ip = c.req.header('X-Forwarded-For') || 
               c.req.header('X-Real-IP') || 
               'unknown';

    const now = Date.now();
    const windowStart = now - this.windowMs;

    // 現在のリクエスト履歴を取得
    let requests = this.requests.get(ip) || [];
    
    // 古いリクエストを除去
    requests = requests.filter(time => time > windowStart);

    // レート制限チェック
    if (requests.length >= this.maxRequests) {
      return c.json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'リクエスト数が制限を超えました。しばらく待ってから再試行してください。',
        retryAfter: Math.ceil(this.windowMs / 1000)
      }, 429);
    }

    // 新しいリクエストを記録
    requests.push(now);
    this.requests.set(ip, requests);

    await next();
  };

  private cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [ip, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => time > windowStart);
      
      if (validRequests.length === 0) {
        this.requests.delete(ip);
      } else {
        this.requests.set(ip, validRequests);
      }
    }
  }
}

/**
 * セキュリティヘッダーミドルウェア
 */
export const securityHeaders = async (c: Context, next: Next) => {
  await next();

  // セキュリティヘッダーを設定
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // HTTPS環境でのみSecure Cookieを有効化
  if (c.req.header('X-Forwarded-Proto') === 'https' || c.req.url.startsWith('https://')) {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
};

/**
 * ファイルアップロード制限ミドルウェア
 */
export const uploadLimiter = (maxSize: number = 100 * 1024 * 1024) => {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const contentLength = c.req.header('Content-Length');
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      return c.json({
        success: false,
        error: 'FILE_TOO_LARGE',
        message: `ファイルサイズが制限を超えています。最大${Math.round(maxSize / 1024 / 1024)}MBまでです。`,
        maxSize: maxSize
      }, 413);
    }

    await next();
  };
};

/**
 * Cookie値を取得するヘルパー関数
 */
function getCookieValue(cookieString: string, name: string): string | null {
  const cookies = cookieString.split(';').map(cookie => cookie.trim());
  
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.split('=');
    if (cookieName === name) {
      return decodeURIComponent(cookieValue);
    }
  }
  
  return null;
}

/**
 * Cookieを設定するヘルパー関数
 */
export function setCookie(
  c: Context,
  name: string,
  value: string,
  options: {
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
    path?: string;
    domain?: string;
  } = {}
): void {
  const {
    maxAge = 86400, // 24時間
    httpOnly = true,
    secure = c.req.url.startsWith('https://'),
    sameSite = 'Lax',
    path = '/',
    domain
  } = options;

  let cookieString = `${name}=${encodeURIComponent(value)}`;
  
  if (maxAge) cookieString += `; Max-Age=${maxAge}`;
  if (httpOnly) cookieString += '; HttpOnly';
  if (secure) cookieString += '; Secure';
  if (sameSite) cookieString += `; SameSite=${sameSite}`;
  if (path) cookieString += `; Path=${path}`;
  if (domain) cookieString += `; Domain=${domain}`;

  c.header('Set-Cookie', cookieString);
}

/**
 * Cookieを削除するヘルパー関数
 */
export function deleteCookie(c: Context, name: string, path: string = '/'): void {
  setCookie(c, name, '', { maxAge: 0, path });
}

