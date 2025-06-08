import { Hono } from 'hono';
import { authMiddleware, requireAuth } from '../middleware/auth.js';
import { GitHubService } from '../services/github.js';
import { FileProcessor } from '../services/file-processor.js';
import { UploadResult, GitHubUser, UserSession } from '../types/index.js';
import path from 'path';
import fs from 'fs/promises';

// Honoの型拡張
type Variables = {
  user: GitHubUser;
  session: UserSession;
};

const upload = new Hono<{ Variables: Variables }>();

// 認証ミドルウェアを適用
upload.use('*', authMiddleware);

/**
 * ファイルアップロード＆GitHub リポジトリ作成
 */
upload.post('/', requireAuth, async (c) => {
  let tempFilePath: string | null = null;
  let tempExtractPath: string | null = null;

  try {
    const user = c.get('user');
    if (!user) {
      return c.json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'ログインが必要です'
      }, 401);
    }

    // マルチパートフォームデータを解析
    const formData = await c.req.formData();
    
    const file = formData.get('file') as File;
    const projectName = formData.get('projectName') as string;
    const projectDescription = formData.get('projectDescription') as string || '';
    const isPrivate = formData.get('isPrivate') === 'true';
    const topicsJson = formData.get('topics') as string;
    
    let topics: string[] = [];
    try {
      topics = topicsJson ? JSON.parse(topicsJson) : [];
    } catch (e) {
      topics = [];
    }

    // バリデーション
    if (!file) {
      return c.json({
        success: false,
        error: 'NO_FILE',
        message: 'ファイルが選択されていません'
      }, 400);
    }

    if (!projectName || !isValidProjectName(projectName)) {
      return c.json({
        success: false,
        error: 'INVALID_PROJECT_NAME',
        message: 'プロジェクト名が無効です。英数字、ハイフン、アンダースコアのみ使用できます'
      }, 400);
    }

    // ファイル形式チェック
    if (!isValidArchiveFile(file.name)) {
      return c.json({
        success: false,
        error: 'INVALID_FILE_TYPE',
        message: '対応していないファイル形式です。.tar.gz または .tgz ファイルを選択してください'
      }, 400);
    }

    // ファイルサイズチェック
    if (file.size > 100 * 1024 * 1024) { // 100MB
      return c.json({
        success: false,
        error: 'FILE_TOO_LARGE',
        message: 'ファイルサイズが大きすぎます。100MB以下のファイルを選択してください'
      }, 400);
    }

    // 一時ファイルパスを生成
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2);
    tempFilePath = path.join(tempDir, `upload_${timestamp}_${randomId}.tar.gz`);
    tempExtractPath = path.join(tempDir, `extract_${timestamp}_${randomId}`);

    // ファイルを一時保存
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(tempFilePath, new Uint8Array(arrayBuffer));

    console.log(`File uploaded: ${file.name} (${file.size} bytes) -> ${tempFilePath}`);

    // ファイルを解析・展開
    const fileProcessor = new FileProcessor();
    const extractedFiles = await fileProcessor.extractArchive(tempFilePath, tempExtractPath);

    console.log(`Extracted ${extractedFiles.length} files to ${tempExtractPath}`);

    // GitHub サービスを初期化
    const githubService = new GitHubService(user.access_token);

    // リポジトリが既に存在するかチェック
    const existingRepo = await githubService.getRepository(user.login, projectName);
    if (existingRepo) {
      return c.json({
        success: false,
        error: 'REPOSITORY_EXISTS',
        message: `リポジトリ "${projectName}" は既に存在します。別の名前を選択してください`
      }, 409);
    }

    // GitHub リポジトリを作成
    const repository = await githubService.createRepository(
      projectName,
      projectDescription,
      isPrivate,
      topics
    );

    console.log(`Repository created: ${repository.full_name}`);

    // ファイルをリポジトリにアップロード
    const uploadResults = await githubService.uploadFiles(
      user.login,
      projectName,
      extractedFiles
    );

    console.log(`Uploaded ${uploadResults.length} files to repository`);

    // README.md が存在しない場合は自動生成
    const hasReadme = extractedFiles.some(file => 
      file.toLowerCase() === 'readme.md' || 
      file.toLowerCase() === 'readme.txt' ||
      file.toLowerCase() === 'readme'
    );

    if (!hasReadme) {
      const readmeContent = generateReadmeContent(projectName, projectDescription, topics);
      await githubService.createFile(
        user.login,
        projectName,
        'README.md',
        readmeContent,
        'Add auto-generated README.md'
      );
      console.log('Auto-generated README.md created');
    }

    // 結果を返す
    const result: UploadResult = {
      success: true,
      repository: {
        id: repository.id,
        name: repository.name,
        full_name: repository.full_name,
        html_url: repository.html_url,
        clone_url: repository.clone_url,
        ssh_url: repository.ssh_url,
        private: repository.private,
        description: repository.description,
        topics: repository.topics || [],
        created_at: repository.created_at,
        updated_at: repository.updated_at
      },
      upload_stats: {
        total_files: extractedFiles.length,
        uploaded_files: uploadResults.length,
        total_size: file.size,
        processing_time: Date.now() - timestamp
      }
    };

    return c.json({
      success: true,
      data: result,
      message: 'プロジェクトが正常にアップロードされました'
    });

  } catch (error: any) {
    console.error('Upload error:', error);

    // エラーの種類に応じてメッセージを調整
    let errorMessage = 'アップロード中にエラーが発生しました';
    let errorCode = 'UPLOAD_ERROR';

    if (error.message.includes('Repository creation failed')) {
      errorMessage = 'リポジトリの作成に失敗しました';
      errorCode = 'REPOSITORY_CREATION_FAILED';
    } else if (error.message.includes('File upload failed')) {
      errorMessage = 'ファイルのアップロードに失敗しました';
      errorCode = 'FILE_UPLOAD_FAILED';
    } else if (error.message.includes('Archive extraction failed')) {
      errorMessage = 'アーカイブファイルの展開に失敗しました';
      errorCode = 'ARCHIVE_EXTRACTION_FAILED';
    } else if (error.message.includes('API rate limit')) {
      errorMessage = 'GitHub APIの制限に達しました。しばらく待ってから再試行してください';
      errorCode = 'RATE_LIMIT_EXCEEDED';
    }

    return c.json({
      success: false,
      error: errorCode,
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, 500);

  } finally {
    // 一時ファイルをクリーンアップ
    try {
      if (tempFilePath) {
        await fs.unlink(tempFilePath);
        console.log(`Cleaned up temp file: ${tempFilePath}`);
      }
      if (tempExtractPath) {
        await fs.rm(tempExtractPath, { recursive: true, force: true });
        console.log(`Cleaned up temp directory: ${tempExtractPath}`);
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
  }
});

/**
 * アップロード進行状況取得（WebSocket対応予定）
 */
upload.get('/status/:uploadId', requireAuth, async (c) => {
  const uploadId = c.req.param('uploadId');
  
  // TODO: WebSocketまたはServer-Sent Eventsでリアルタイム進行状況を提供
  return c.json({
    success: true,
    data: {
      uploadId,
      status: 'completed',
      progress: 100,
      message: 'アップロード完了'
    }
  });
});

/**
 * ユーザーのリポジトリ一覧取得
 */
upload.get('/repositories', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'ログインが必要です'
      }, 401);
    }

    const githubService = new GitHubService(user.access_token);
    const repositories = await githubService.getUserRepositories();

    return c.json({
      success: true,
      data: {
        repositories: repositories.map(repo => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          html_url: repo.html_url,
          description: repo.description,
          private: repo.private,
          topics: repo.topics || [],
          created_at: repo.created_at,
          updated_at: repo.updated_at,
          language: repo.language,
          stargazers_count: repo.stargazers_count,
          forks_count: repo.forks_count
        }))
      }
    });

  } catch (error: any) {
    console.error('Repository list error:', error);
    return c.json({
      success: false,
      error: 'REPOSITORY_LIST_ERROR',
      message: 'リポジトリ一覧の取得中にエラーが発生しました'
    }, 500);
  }
});

/**
 * プロジェクト名の妥当性チェック
 */
function isValidProjectName(name: string): boolean {
  // GitHub リポジトリ名の制約に従う
  return /^[a-zA-Z0-9\-_.]+$/.test(name) && 
         name.length >= 1 && 
         name.length <= 100 &&
         !name.startsWith('.') &&
         !name.startsWith('-') &&
         !name.endsWith('.') &&
         !name.endsWith('-');
}

/**
 * アーカイブファイルの妥当性チェック
 */
function isValidArchiveFile(filename: string): boolean {
  const validExtensions = ['.tar.gz', '.tgz'];
  return validExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

/**
 * README.md 自動生成
 */
function generateReadmeContent(projectName: string, description: string, topics: string[]): string {
  const now = new Date().toLocaleDateString('ja-JP');
  
  let content = `# ${projectName}\n\n`;
  
  if (description) {
    content += `${description}\n\n`;
  }
  
  if (topics && topics.length > 0) {
    content += `## トピック\n\n`;
    content += topics.map(topic => `- ${topic}`).join('\n') + '\n\n';
  }
  
  content += `## 概要\n\n`;
  content += `このプロジェクトは GitHub Uploader を使用してアップロードされました。\n\n`;
  
  content += `## インストール\n\n`;
  content += `\`\`\`bash\n`;
  content += `git clone https://github.com/[username]/${projectName}.git\n`;
  content += `cd ${projectName}\n`;
  content += `\`\`\`\n\n`;
  
  content += `## 使用方法\n\n`;
  content += `プロジェクトの使用方法をここに記載してください。\n\n`;
  
  content += `## ライセンス\n\n`;
  content += `このプロジェクトのライセンスを記載してください。\n\n`;
  
  content += `---\n\n`;
  content += `*このREADMEは ${now} に自動生成されました。*\n`;
  
  return content;
}

export default upload;

