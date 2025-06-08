import { Octokit } from '@octokit/rest';
/**
 * GitHub API操作を管理するクラス
 */
export class GitHubService {
    octokit;
    constructor(accessToken) {
        this.octokit = new Octokit({
            auth: accessToken,
            userAgent: 'GitHub-Uploader-Service/1.0.0'
        });
    }
    /**
     * 認証されたユーザー情報を取得
     */
    async getAuthenticatedUser() {
        try {
            const { data: user } = await this.octokit.rest.users.getAuthenticated();
            const { data: emails } = await this.octokit.rest.users.listEmailsForAuthenticatedUser();
            const primaryEmail = emails.find(email => email.primary)?.email || user.email;
            return {
                id: user.id,
                login: user.login,
                name: user.name || user.login,
                email: primaryEmail || '',
                avatar_url: user.avatar_url,
                access_token: '' // 後で設定される
            };
        }
        catch (error) {
            console.error('Failed to get authenticated user:', error);
            throw new Error('Failed to retrieve user information from GitHub');
        }
    }
    /**
     * 新しいリポジトリを作成
     */
    async createRepository(name, description, isPrivate = false, topics) {
        try {
            const { data: repo } = await this.octokit.rest.repos.createForAuthenticatedUser({
                name,
                description: description || `Project uploaded via GitHub Uploader`,
                private: isPrivate,
                auto_init: false,
                has_issues: true,
                has_projects: true,
                has_wiki: true
            });
            // トピックを設定
            if (topics && topics.length > 0) {
                try {
                    await this.octokit.rest.repos.replaceAllTopics({
                        owner: repo.owner.login,
                        repo: repo.name,
                        names: topics
                    });
                }
                catch (error) {
                    console.warn('Failed to set topics:', error);
                }
            }
            return {
                id: repo.id,
                name: repo.name,
                full_name: repo.full_name,
                description: repo.description || '',
                private: repo.private,
                html_url: repo.html_url,
                clone_url: repo.clone_url || '',
                ssh_url: repo.ssh_url || '',
                created_at: repo.created_at || '',
                updated_at: repo.updated_at || '',
                topics: topics || [],
                language: repo.language || undefined,
                stargazers_count: repo.stargazers_count || 0,
                forks_count: repo.forks_count || 0
            };
        }
        catch (error) {
            console.error('Repository creation failed:', error);
            throw new Error(`Repository creation failed: ${error.message}`);
        }
    }
    /**
     * ファイルをリポジトリにアップロード
     */
    async uploadFiles(owner, repo, files) {
        try {
            const commits = [];
            for (const file of files) {
                try {
                    const commit = await this.createFile(owner, repo, file.path, file.content, `Add ${file.path}`);
                    commits.push(commit);
                }
                catch (error) {
                    console.warn(`Failed to upload file ${file.path}:`, error);
                }
            }
            return commits;
        }
        catch (error) {
            console.error('File upload failed:', error);
            throw new Error(`File upload failed: ${error.message}`);
        }
    }
    /**
     * ファイルを作成
     */
    async createFile(owner, repo, path, content, message) {
        try {
            const response = await this.octokit.rest.repos.createOrUpdateFileContents({
                owner,
                repo,
                path,
                message,
                content,
                committer: {
                    name: 'GitHub Uploader',
                    email: 'noreply@github-uploader.com'
                }
            });
            return {
                sha: response.data.commit.sha,
                message: response.data.commit.message || message,
                url: response.data.commit.html_url || ''
            };
        }
        catch (error) {
            console.error(`Failed to create file ${path}:`, error);
            throw new Error(`Failed to create file ${path}: ${error.message}`);
        }
    }
    /**
     * README.mdファイルを作成
     */
    async createReadme(owner, repo, projectName, description) {
        const readmeContent = this.generateReadmeContent(projectName, description);
        const encodedContent = Buffer.from(readmeContent).toString('base64');
        return this.createFile(owner, repo, 'README.md', encodedContent, 'Add README.md');
    }
    /**
     * README.mdの内容を生成
     */
    generateReadmeContent(projectName, description) {
        return `# ${projectName}

${description || 'Project uploaded via GitHub Uploader'}

## 📁 Project Structure

This project was uploaded using GitHub Uploader, a mobile-friendly service for uploading tar.gz archives to GitHub repositories.

## 🚀 Getting Started

1. Clone this repository
2. Install dependencies (if applicable)
3. Follow the setup instructions in the project files

## 📝 Description

${description || 'No description provided.'}

## 🤝 Contributing

Feel free to contribute to this project by submitting issues or pull requests.

## 📄 License

Please check the project files for license information.

---

*This README was automatically generated by [GitHub Uploader](https://github-uploader.fly.dev)*
`;
    }
    /**
     * ユーザーのリポジトリ一覧を取得
     */
    async getUserRepositories(page = 1, perPage = 30) {
        try {
            const { data: repos } = await this.octokit.rest.repos.listForAuthenticatedUser({
                sort: 'updated',
                direction: 'desc',
                page,
                per_page: perPage
            });
            return repos.map(repo => ({
                id: repo.id,
                name: repo.name,
                full_name: repo.full_name,
                description: repo.description || '',
                private: repo.private,
                html_url: repo.html_url,
                clone_url: repo.clone_url || '',
                ssh_url: repo.ssh_url || '',
                created_at: repo.created_at || '',
                updated_at: repo.updated_at || '',
                topics: repo.topics || [],
                language: repo.language || undefined,
                stargazers_count: repo.stargazers_count || 0,
                forks_count: repo.forks_count || 0
            }));
        }
        catch (error) {
            console.error('Failed to get user repositories:', error);
            throw new Error(`Failed to get repositories: ${error.message}`);
        }
    }
    /**
     * リポジトリの詳細情報を取得
     */
    async getRepository(owner, repo) {
        try {
            const { data: repository } = await this.octokit.rest.repos.get({
                owner,
                repo
            });
            return {
                id: repository.id,
                name: repository.name,
                full_name: repository.full_name,
                description: repository.description || '',
                private: repository.private,
                html_url: repository.html_url,
                clone_url: repository.clone_url || '',
                ssh_url: repository.ssh_url || '',
                created_at: repository.created_at || '',
                updated_at: repository.updated_at || '',
                topics: repository.topics || [],
                language: repository.language || undefined,
                stargazers_count: repository.stargazers_count || 0,
                forks_count: repository.forks_count || 0
            };
        }
        catch (error) {
            console.error('Failed to get repository:', error);
            throw new Error(`Failed to get repository: ${error.message}`);
        }
    }
    /**
     * レート制限情報を取得
     */
    async getRateLimit() {
        try {
            const { data } = await this.octokit.rest.rateLimit.get();
            return data;
        }
        catch (error) {
            console.error('Failed to get rate limit:', error);
            throw new Error(`Failed to get rate limit: ${error.message}`);
        }
    }
}
//# sourceMappingURL=github.js.map