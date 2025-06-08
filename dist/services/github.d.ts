import { GitHubUser, GitHubRepository, GitHubCommit, FileEntry } from '../types/index.js';
/**
 * GitHub API操作を管理するクラス
 */
export declare class GitHubService {
    private octokit;
    constructor(accessToken: string);
    /**
     * 認証されたユーザー情報を取得
     */
    getAuthenticatedUser(): Promise<GitHubUser>;
    /**
     * 新しいリポジトリを作成
     */
    createRepository(name: string, description?: string, isPrivate?: boolean, topics?: string[]): Promise<GitHubRepository>;
    /**
     * ファイルをリポジトリにアップロード
     */
    uploadFiles(owner: string, repo: string, files: FileEntry[]): Promise<GitHubCommit[]>;
    /**
     * ファイルを作成
     */
    createFile(owner: string, repo: string, path: string, content: string, message: string, encoding?: 'base64' | 'utf-8'): Promise<GitHubCommit>;
    /**
     * README.mdファイルを作成
     */
    createReadme(owner: string, repo: string, projectName: string, description?: string): Promise<GitHubCommit>;
    /**
     * README.mdの内容を生成
     */
    private generateReadmeContent;
    /**
     * ユーザーのリポジトリ一覧を取得
     */
    getUserRepositories(page?: number, perPage?: number): Promise<GitHubRepository[]>;
    /**
     * リポジトリの詳細情報を取得
     */
    getRepository(owner: string, repo: string): Promise<GitHubRepository | null>;
    /**
     * レート制限情報を取得
     */
    getRateLimit(): Promise<{
        resources: {
            core: import("@octokit/openapi-types").components["schemas"]["rate-limit"];
            graphql?: import("@octokit/openapi-types").components["schemas"]["rate-limit"];
            search: import("@octokit/openapi-types").components["schemas"]["rate-limit"];
            code_search?: import("@octokit/openapi-types").components["schemas"]["rate-limit"];
            source_import?: import("@octokit/openapi-types").components["schemas"]["rate-limit"];
            integration_manifest?: import("@octokit/openapi-types").components["schemas"]["rate-limit"];
            code_scanning_upload?: import("@octokit/openapi-types").components["schemas"]["rate-limit"];
            actions_runner_registration?: import("@octokit/openapi-types").components["schemas"]["rate-limit"];
            scim?: import("@octokit/openapi-types").components["schemas"]["rate-limit"];
            dependency_snapshots?: import("@octokit/openapi-types").components["schemas"]["rate-limit"];
            code_scanning_autofix?: import("@octokit/openapi-types").components["schemas"]["rate-limit"];
        };
        rate: import("@octokit/openapi-types").components["schemas"]["rate-limit"];
    }>;
}
//# sourceMappingURL=github.d.ts.map