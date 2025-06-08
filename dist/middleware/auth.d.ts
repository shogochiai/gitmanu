import { Context, Next } from 'hono';
/**
 * 認証ミドルウェア
 */
export declare const authMiddleware: (c: Context, next: Next) => Promise<void>;
/**
 * 認証必須ミドルウェア
 */
export declare const requireAuth: (c: Context, next: Next) => Promise<(Response & import("hono").TypedResponse<{
    success: false;
    error: string;
    message: string;
}, 401, "json">) | undefined>;
/**
 * CORS ミドルウェア
 */
export declare const corsMiddleware: (c: Context, next: Next) => Promise<Response | undefined>;
/**
 * エラーハンドリングミドルウェア
 */
export declare const errorHandler: (c: Context, next: Next) => Promise<(Response & import("hono").TypedResponse<{
    stack?: any;
    success: false;
    error: any;
    message: any;
}, any, "json">) | undefined>;
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
    middleware: (c: Context, next: Next) => Promise<(Response & import("hono").TypedResponse<{
        success: false;
        error: string;
        message: string;
        retryAfter: number;
    }, 429, "json">) | undefined>;
    private cleanup;
}
/**
 * セキュリティヘッダーミドルウェア
 */
export declare const securityHeaders: (c: Context, next: Next) => Promise<void>;
/**
 * ファイルアップロード制限ミドルウェア
 */
export declare const uploadLimiter: (maxSize?: number) => (c: Context, next: Next) => Promise<(Response & import("hono").TypedResponse<{
    success: false;
    error: string;
    message: string;
    maxSize: number;
}, 413, "json">) | undefined>;
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