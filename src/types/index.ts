// GitHub OAuth関連の型定義
export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
  access_token: string;
}

// GitHub リポジトリ情報
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  created_at: string;
  updated_at: string;
  topics?: string[];
  language?: string | null | undefined;
  stargazers_count?: number;
  forks_count?: number;
}

// GitHub コミット情報
export interface GitHubCommit {
  sha: string | undefined;
  message: string;
  url: string;
}

// ファイルエントリ
export interface FileEntry {
  path: string;
  content: string;
  encoding: 'base64' | 'utf-8';
  size: number;
}

// プロジェクト構造
export interface ProjectStructure {
  files: FileEntry[];
  directories: string[];
  totalSize: number;
  fileCount: number;
}

// アップロード結果
export interface UploadResult {
  success: boolean;
  repository: GitHubRepository;
  upload_stats: {
    total_files: number;
    uploaded_files: number;
    total_size: number;
    processing_time: number;
  };
}

// アップロードリクエスト
export interface UploadRequest {
  projectName: string;
  projectDescription?: string;
  isPrivate: boolean;
  topics?: string[];
  file: File;
}

// ユーザーセッション
export interface UserSession {
  sessionId: string;
  userId: string;
  login: string;
  accessToken: string;
  createdAt: number;
  lastAccessAt: number;
  expiresAt: number;
}

// JWT ペイロード
export interface JWTPayload {
  sessionId: string;
  userId: string;
  login: string;
  iat?: number;
  exp?: number;
}

// アプリケーション設定
export interface AppConfig {
  nodeEnv: string;
  port: number;
  baseUrl: string;
  github: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  upload: {
    maxFileSize: number;
    maxFilesPerArchive: number;
    tempDir: string;
    uploadDir: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    uploadMaxRequests: number;
  };
  session: {
    maxAge: number;
  };
}

// API レスポンス
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: string;
}

// Cookie オプション
export interface CookieOptions {
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  path?: string;
  domain?: string;
}

// アップロード統計
export interface UploadStats {
  total_files: number;
  uploaded_files: number;
  total_size: number;
  processing_time: number;
}

