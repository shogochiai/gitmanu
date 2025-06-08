import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { UserSession, GitHubUser } from '../types/index.js';
import { config } from './config.js';

/**
 * セッション管理クラス
 */
export class SessionManager {
  private static instance: SessionManager;
  private sessions: Record<string, UserSession> = {};
  private readonly secret: string;
  private readonly maxAge: number;

  private constructor() {
    this.secret = config.get('jwt').secret;
    this.maxAge = config.get('session').maxAge;
    
    // 定期的にセッションをクリーンアップ
    setInterval(() => this.cleanupExpiredSessions(), 60000); // 1分ごと
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * 新しいセッションを作成
   */
  public createSession(user: GitHubUser): string {
    const sessionId = uuidv4();
    const now = Date.now();
    
    const session: UserSession = {
      sessionId: sessionId,
      userId: user.id.toString(),
      login: user.login,
      accessToken: user.access_token,
      expiresAt: now + this.maxAge,
      lastAccessAt: now,
      createdAt: now
    };

    this.sessions[sessionId] = session;
    
    console.log(`Session created for user ${user.login} (${sessionId})`);
    return sessionId;
  }

  /**
   * セッションを取得
   */
  public getSession(sessionId: string): UserSession | null {
    const session = this.sessions[sessionId];
    
    if (!session) {
      return null;
    }

    // セッションの有効期限をチェック
    if (Date.now() > session.expiresAt) {
      delete this.sessions[sessionId];
      console.log(`Expired session removed: ${sessionId}`);
      return null;
    }

    return session;
  }

  /**
   * セッションを削除
   */
  public destroySession(sessionId: string): boolean {
    if (this.sessions[sessionId]) {
      delete this.sessions[sessionId];
      console.log(`Session destroyed: ${sessionId}`);
      return true;
    }
    return false;
  }

  /**
   * セッションを更新（有効期限を延長）
   */
  public refreshSession(sessionId: string): boolean {
    const session = this.sessions[sessionId];
    
    if (session && Date.now() <= session.expiresAt) {
      session.expiresAt = Date.now() + this.maxAge;
      console.log(`Session refreshed: ${sessionId}`);
      return true;
    }
    
    return false;
  }

  /**
   * JWTトークンを生成
   */
  public generateJWT(sessionId: string): string {
    const payload = {
      sessionId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor((Date.now() + this.maxAge) / 1000)
    };

    return jwt.sign(payload, this.secret, { algorithm: 'HS256' });
  }

  /**
   * JWTトークンを検証
   */
  public verifyJWT(token: string): { sessionId: string } | null {
    try {
      const decoded = jwt.verify(token, this.secret) as any;
      return { sessionId: decoded.sessionId };
    } catch (error) {
      console.warn('JWT verification failed:', error);
      return null;
    }
  }

  /**
   * 期限切れセッションをクリーンアップ
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of Object.entries(this.sessions)) {
      if (now > session.expiresAt) {
        delete this.sessions[sessionId];
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  /**
   * アクティブセッション数を取得
   */
  public getActiveSessionCount(): number {
    return Object.keys(this.sessions).length;
  }

  /**
   * 特定ユーザーのセッションを取得
   */
  public getUserSessions(userId: string): UserSession[] {
    return Object.values(this.sessions).filter(session => session.userId === userId);
  }

  /**
   * 特定ユーザーのすべてのセッションを削除
   */
  public destroyUserSessions(userId: string): number {
    let destroyedCount = 0;
    
    for (const [sessionId, session] of Object.entries(this.sessions)) {
      if (session.userId === userId) {
        delete this.sessions[sessionId];
        destroyedCount++;
      }
    }

    if (destroyedCount > 0) {
      console.log(`Destroyed ${destroyedCount} sessions for user ${userId}`);
    }

    return destroyedCount;
  }

  /**
   * セッション統計情報を取得
   */
  public getSessionStats(): {
    total: number;
    active: number;
    expired: number;
    averageAge: number;
  } {
    const now = Date.now();
    const sessions = Object.values(this.sessions);
    const activeSessions = sessions.filter(s => now <= s.expiresAt);
    const expiredSessions = sessions.filter(s => now > s.expiresAt);
    
    const averageAge = activeSessions.length > 0
      ? activeSessions.reduce((sum, s) => sum + (now - s.createdAt), 0) / activeSessions.length
      : 0;

    return {
      total: sessions.length,
      active: activeSessions.length,
      expired: expiredSessions.length,
      averageAge: Math.round(averageAge / 1000) // 秒単位
    };
  }
}

// シングルトンインスタンスをエクスポート
export const sessionManager = SessionManager.getInstance();

