import { Hono } from 'hono';
import { authMiddleware, requireAuth } from '../middleware/auth.js';
import { GitHubService } from '../services/github.js';
import { FileProcessor } from '../services/file-processor.js';
import { UploadResult, GitHubUser, UserSession, FileEntry, GitHubCommit } from '../types/index.js';
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
    const extractedFilePaths = await fileProcessor.extractArchive(tempFilePath, tempExtractPath);

    console.log(`Extracted ${extractedFilePaths.length} files to ${tempExtractPath}`);
    
    // デバッグ: 実際に抽出されたファイルを確認
    try {
      const actualFiles = await fs.readdir(tempExtractPath, { recursive: true });
      console.log(`Actual files in ${tempExtractPath}:`, actualFiles);
    } catch (debugError) {
      console.error('Debug readdir failed:', debugError);
    }

    // GitHub サービスを初期化
    const githubService = new GitHubService(user.access_token);

    // 利用可能なリポジトリ名を見つける
    let finalProjectName = projectName;
    let suffix = 1;
    
    while (true) {
      const existingRepo = await githubService.getRepository(user.login, finalProjectName);
      if (!existingRepo) {
        break; // 利用可能な名前が見つかった
      }
      
      // 既に存在する場合は番号を追加
      suffix++;
      finalProjectName = `${projectName}-${suffix}`;
      console.log(`Repository ${projectName} exists, trying ${finalProjectName}`);
    }

    // 名前が変更された場合はユーザーに通知
    if (finalProjectName !== projectName) {
      console.log(`Repository name changed from ${projectName} to ${finalProjectName}`);
    }

    // GitHub リポジトリを作成
    const repository = await githubService.createRepository(
      finalProjectName,
      projectDescription,
      isPrivate,
      topics
    );

    console.log(`Repository created: ${repository.full_name}`);

    // 抽出されたファイルをFileEntry形式に変換
    const fileEntries: FileEntry[] = [];
    console.log(`Processing ${extractedFilePaths.length} extracted files from ${tempExtractPath}`);
    
    for (const filePath of extractedFilePaths) {
      try {
        const fullPath = path.join(tempExtractPath, filePath);
        console.log(`Reading file: ${fullPath}`);
        
        // ファイルの存在確認
        const stats = await fs.stat(fullPath);
        if (!stats.isFile()) {
          console.warn(`Skipping non-file: ${fullPath}`);
          continue;
        }
        
        const content = await fs.readFile(fullPath);
        
        // バイナリファイルかテキストファイルかを判定（簡易的な判定）
        const ext = path.extname(filePath).toLowerCase();
        const binaryExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.pdf', '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.dylib'];
        const isBinary = binaryExtensions.includes(ext);
        
        fileEntries.push({
          path: filePath,
          content: content.toString(isBinary ? 'base64' : 'utf-8'),
          encoding: isBinary ? 'base64' : 'utf-8',
          size: content.length
        });
        console.log(`Successfully processed file: ${filePath} (${content.length} bytes, ${isBinary ? 'binary' : 'text'})`);
      } catch (error) {
        console.error(`Failed to read file ${filePath}:`, error);
      }
    }
    
    console.log(`Successfully prepared ${fileEntries.length} files for upload`);

    // ファイルがない場合はエラー
    if (fileEntries.length === 0) {
      console.error('No files were extracted from the archive');
      
      // リポジトリを削除する必要がある場合はここで削除
      // ただし、空のリポジトリも有効なので、READMEだけ追加して続行
      console.log('Creating repository with README only');
    }

    // ファイルをリポジトリにアップロード
    let uploadResults: GitHubCommit[] = [];
    if (fileEntries.length > 0) {
      uploadResults = await githubService.uploadFiles(
        user.login,
        finalProjectName,
        fileEntries
      );
      console.log(`Uploaded ${uploadResults.length} files to repository`);
    } else {
      console.log('No files to upload from the archive');
    }

    // README.md が存在しない場合は自動生成
    const hasReadme = extractedFilePaths.some(file => 
      file.toLowerCase() === 'readme.md' || 
      file.toLowerCase() === 'readme.txt' ||
      file.toLowerCase() === 'readme'
    );

    if (!hasReadme) {
      const readmeContent = generateReadmeContent(finalProjectName, projectDescription, topics);
      await githubService.createFile(
        user.login,
        finalProjectName,
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
        total_files: extractedFilePaths.length,
        uploaded_files: uploadResults.length,
        total_size: file.size,
        processing_time: Date.now() - timestamp
      }
    };

    return c.json({
      success: true,
      data: result,
      message: finalProjectName !== projectName 
        ? `プロジェクトが "${finalProjectName}" として正常にアップロードされました（"${projectName}" は既に存在していたため）`
        : 'プロジェクトが正常にアップロードされました'
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

