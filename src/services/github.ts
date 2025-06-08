import { Octokit } from '@octokit/rest';
import { GitHubUser, GitHubRepository, GitHubCommit, FileEntry } from '../types/index.js';

/**
 * GitHub API操作を管理するクラス
 */
export class GitHubService {
  private octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({
      auth: accessToken,
      userAgent: 'GitHub-Uploader-Service/1.0.0'
    });
  }

  /**
   * 認証されたユーザー情報を取得
   */
  public async getAuthenticatedUser(): Promise<GitHubUser> {
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
    } catch (error) {
      console.error('Failed to get authenticated user:', error);
      throw new Error('Failed to retrieve user information from GitHub');
    }
  }

  /**
   * 新しいリポジトリを作成
   */
  public async createRepository(
    name: string,
    description?: string,
    isPrivate: boolean = false,
    topics?: string[]
  ): Promise<GitHubRepository> {
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
        } catch (error) {
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
    } catch (error: any) {
      console.error('Repository creation failed:', error);
      throw new Error(`Repository creation failed: ${error.message}`);
    }
  }

  /**
   * ファイルをリポジトリにアップロード
   */
  async uploadFiles(
    owner: string,
    repo: string,
    files: FileEntry[]
  ): Promise<GitHubCommit[]> {
    try {
      const commits: GitHubCommit[] = [];
      console.log(`Starting upload of ${files.length} files to ${owner}/${repo}`);

      for (const file of files) {
        try {
          console.log(`Uploading file: ${file.path} (${file.size} bytes, encoding: ${file.encoding})`);
          const commit = await this.createFile(
            owner, 
            repo, 
            file.path, 
            file.content, 
            `Add ${file.path}`,
            file.encoding as 'base64' | 'utf-8'
          );
          commits.push(commit);
          console.log(`Successfully uploaded: ${file.path} (commit: ${commit.sha})`);
        } catch (error: any) {
          console.error(`Failed to upload file ${file.path}:`, error.message);
          // Continue with other files even if one fails
        }
      }

      console.log(`Upload complete: ${commits.length}/${files.length} files uploaded successfully`);
      return commits;
    } catch (error: any) {
      console.error('File upload failed:', error);
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  /**
   * ファイルを作成
   */
  async createFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    encoding: 'base64' | 'utf-8' = 'utf-8'
  ): Promise<GitHubCommit> {
    try {
      // GitHub APIは常にbase64エンコードされたコンテンツを期待する
      let base64Content: string;
      if (encoding === 'base64') {
        // すでにbase64エンコードされている場合はそのまま使用
        base64Content = content;
      } else {
        // utf-8の場合はbase64エンコード
        base64Content = Buffer.from(content, 'utf-8').toString('base64');
      }

      const response = await this.octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: base64Content,
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
    } catch (error: any) {
      console.error(`Failed to create file ${path}:`, error);
      throw new Error(`Failed to create file ${path}: ${error.message}`);
    }
  }

  /**
   * README.mdファイルを作成
   */
  async createReadme(
    owner: string,
    repo: string,
    projectName: string,
    description?: string
  ): Promise<GitHubCommit> {
    const readmeContent = this.generateReadmeContent(projectName, description);
    const encodedContent = Buffer.from(readmeContent).toString('base64');
    
    return this.createFile(owner, repo, 'README.md', encodedContent, 'Add README.md');
  }

  /**
   * README.mdの内容を生成
   */
  private generateReadmeContent(projectName: string, description?: string): string {
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
  async getUserRepositories(page: number = 1, perPage: number = 30): Promise<GitHubRepository[]> {
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
    } catch (error: any) {
      console.error('Failed to get user repositories:', error);
      throw new Error(`Failed to get repositories: ${error.message}`);
    }
  }

  /**
   * リポジトリの詳細情報を取得
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository | null> {
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
    } catch (error: any) {
      // 404エラー（リポジトリが存在しない）の場合はnullを返す
      if (error.status === 404) {
        return null;
      }
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
    } catch (error: any) {
      console.error('Failed to get rate limit:', error);
      throw new Error(`Failed to get rate limit: ${error.message}`);
    }
  }
}

