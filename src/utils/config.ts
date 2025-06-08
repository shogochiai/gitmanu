import { AppConfig } from '../types/index.js';

/**
 * アプリケーション設定を管理するクラス
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): AppConfig {
    // 環境変数から設定を読み込み
    const requiredEnvVars = [
      'GITHUB_CLIENT_ID',
      'GITHUB_CLIENT_SECRET',
      'SESSION_SECRET'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Required environment variable ${envVar} is not set`);
      }
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    return {
      nodeEnv: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
      port: parseInt(process.env.PORT || '3000', 10),
      baseUrl: baseUrl,
      github: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        redirectUri: `${baseUrl}/auth/github/callback`
      },
      jwt: {
        secret: process.env.SESSION_SECRET!,
        expiresIn: '24h'
      },
      upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600', 10), // 100MB
        maxFilesPerArchive: parseInt(process.env.MAX_FILES_PER_ARCHIVE || '1000', 10),
        tempDir: process.env.TEMP_DIR || './temp',
        uploadDir: process.env.UPLOAD_DIR || './uploads'
      },
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1分
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
        uploadMaxRequests: parseInt(process.env.RATE_LIMIT_UPLOAD_MAX_REQUESTS || '10', 10)
      },
      session: {
        maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000', 10) // 24時間
      }
    };
  }

  public getConfig(): AppConfig {
    return this.config;
  }

  public get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  public isDevelopment(): boolean {
    return this.config.nodeEnv === 'development';
  }

  public isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }

  public getGitHubOAuthUrl(): string {
    const { clientId, redirectUri } = this.config.github;
    const scope = 'user:email,public_repo,repo';
    const state = this.generateState();
    
    return `https://github.com/login/oauth/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${state}`;
  }

  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * 設定の妥当性を検証
   */
  public validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // ポート番号の検証
    if (this.config.port < 1 || this.config.port > 65535) {
      errors.push('Port must be between 1 and 65535');
    }

    // GitHub設定の検証
    if (!this.config.github.clientId || this.config.github.clientId.length < 10) {
      errors.push('GitHub Client ID is invalid');
    }

    if (!this.config.github.clientSecret || this.config.github.clientSecret.length < 10) {
      errors.push('GitHub Client Secret is invalid');
    }

    // セッション設定の検証
    if (!this.config.jwt.secret || this.config.jwt.secret.length < 32) {
      errors.push('JWT secret must be at least 32 characters long');
    }

    // アップロード設定の検証
    if (this.config.upload.maxFileSize < 1024 * 1024) { // 1MB
      errors.push('Max file size must be at least 1MB');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 設定情報をログ出力（機密情報は除く）
   */
  public logConfig(): void {
    const safeConfig = {
      port: this.config.port,
      nodeEnv: this.config.nodeEnv,
      github: {
        clientId: this.config.github.clientId.substring(0, 8) + '...',
        redirectUri: this.config.github.redirectUri
      },
      upload: this.config.upload,
      rateLimit: this.config.rateLimit
    };

    console.log('Application Configuration:', JSON.stringify(safeConfig, null, 2));
  }
}

// シングルトンインスタンスをエクスポート
export const config = ConfigManager.getInstance();

