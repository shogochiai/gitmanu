export interface GitHubUser {
    id: number;
    login: string;
    name: string;
    email: string;
    avatar_url: string;
    access_token: string;
}
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
export interface GitHubCommit {
    sha: string | undefined;
    message: string;
    url: string;
}
export interface FileEntry {
    path: string;
    content: string;
    encoding: 'base64' | 'utf-8';
    size: number;
}
export interface ProjectStructure {
    files: FileEntry[];
    directories: string[];
    totalSize: number;
    fileCount: number;
}
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
export interface UploadRequest {
    projectName: string;
    projectDescription?: string;
    isPrivate: boolean;
    topics?: string[];
    file: File;
}
export interface UserSession {
    sessionId: string;
    userId: string;
    login: string;
    accessToken: string;
    createdAt: number;
    lastAccessAt: number;
    expiresAt: number;
}
export interface JWTPayload {
    sessionId: string;
    userId: string;
    login: string;
    iat?: number;
    exp?: number;
}
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
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    details?: string;
}
export interface CookieOptions {
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
    path?: string;
    domain?: string;
}
export interface UploadStats {
    total_files: number;
    uploaded_files: number;
    total_size: number;
    processing_time: number;
}
//# sourceMappingURL=index.d.ts.map