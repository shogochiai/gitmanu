import { Context, Next } from 'hono';
import { sessionManager } from '../utils/session.js';
export { sessionManager };
/**
 * 認証ミドルウェア
 */
export declare const authMiddleware: (c: Context, next: Next) => Promise<void>;
/**
 * 認証必須ミドルウェア
 */
export declare const requireAuth: (c: Context, next: Next) => Promise<Response | void>;
/**
 * CORS ミドルウェア
 */
export declare const corsMiddleware: (c: Context, next: Next) => Promise<Response | void>;
/**
 * エラーハンドリングミドルウェア
 */
export declare const errorHandler: (c: Context, next: Next) => Promise<Response | void>;
/**
 * リクエストログミドルウェア
 */
export declare const requestLogger: (c: Context, next: Next) => Promise<void>;
/**
 * レート制限ミドルウェア
 */
export declare class RateLimiter {
    private requests;
    private readonly windowMs;
    private readonly maxRequests;
    constructor(windowMs?: number, maxRequests?: number);
    middleware: (c: Context, next: Next) => Promise<Response | void>;
    private cleanup;
}
/**
 * セキュリティヘッダーミドルウェア
 */
export declare const securityHeaders: (c: Context, next: Next) => Promise<void>;
/**
 * ファイルアップロード制限ミドルウェア
 */
export declare const uploadLimiter: (maxSize?: number) => (c: Context, next: Next) => Promise<Response | void>;
/**
 * Cookieを設定するヘルパー関数
 */
export declare function setCookie(c: Context, name: string, value: string, options?: {
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
    path?: string;
    domain?: string;
}): void;
/**
 * Cookieを削除するヘルパー関数
 */
export declare function deleteCookie(c: Context, name: string, path?: string): void;
//# sourceMappingURL=auth.d.ts.map