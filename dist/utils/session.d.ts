import { UserSession, GitHubUser } from '../types/index.js';
/**
 * セッション管理クラス
 */
export declare class SessionManager {
    private static instance;
    private sessions;
    private readonly secret;
    private readonly maxAge;
    private constructor();
    static getInstance(): SessionManager;
    /**
     * 新しいセッションを作成
     */
    createSession(user: GitHubUser): string;
    /**
     * セッションを取得
     */
    getSession(sessionId: string): UserSession | null;
    /**
     * セッションを削除
     */
    destroySession(sessionId: string): boolean;
    /**
     * セッションを更新（有効期限を延長）
     */
    refreshSession(sessionId: string): boolean;
    /**
     * JWTトークンを生成
     */
    generateJWT(sessionId: string): string;
    /**
     * JWTトークンを検証
     */
    verifyJWT(token: string): {
        sessionId: string;
    } | null;
    /**
     * 期限切れセッションをクリーンアップ
     */
    private cleanupExpiredSessions;
    /**
     * アクティブセッション数を取得
     */
    getActiveSessionCount(): number;
    /**
     * 特定ユーザーのセッションを取得
     */
    getUserSessions(userId: string): UserSession[];
    /**
     * 特定ユーザーのすべてのセッションを削除
     */
    destroyUserSessions(userId: string): number;
    /**
     * セッション統計情報を取得
     */
    getSessionStats(): {
        total: number;
        active: number;
        expired: number;
        averageAge: number;
    };
}
export declare const sessionManager: SessionManager;
//# sourceMappingURL=session.d.ts.map