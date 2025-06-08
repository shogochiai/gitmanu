import { AppConfig } from '../types/index.js';
/**
 * アプリケーション設定を管理するクラス
 */
export declare class ConfigManager {
    private static instance;
    private config;
    private constructor();
    static getInstance(): ConfigManager;
    private loadConfig;
    getConfig(): AppConfig;
    get<K extends keyof AppConfig>(key: K): AppConfig[K];
    isDevelopment(): boolean;
    isProduction(): boolean;
    getGitHubOAuthUrl(): string;
    private generateState;
    /**
     * 設定の妥当性を検証
     */
    validateConfig(): {
        valid: boolean;
        errors: string[];
    };
    /**
     * 設定情報をログ出力（機密情報は除く）
     */
    logConfig(): void;
}
export declare const config: ConfigManager;
//# sourceMappingURL=config.d.ts.map