import fs from 'fs/promises';
import path from 'path';
import tar from 'tar';

interface FileInfo {
  path: string;
  size: number;
  type: 'file' | 'directory';
  content?: Buffer;
}

export class FileProcessor {
  private readonly maxFileSize = 50 * 1024 * 1024; // 50MB per file
  private readonly maxTotalFiles = 10000; // Maximum number of files
  private readonly allowedExtensions = new Set([
    // テキストファイル
    '.txt', '.md', '.rst', '.log',
    // ソースコード
    '.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte',
    '.py', '.rb', '.php', '.java', '.c', '.cpp', '.h', '.hpp',
    '.cs', '.go', '.rs', '.swift', '.kt', '.scala',
    '.html', '.htm', '.css', '.scss', '.sass', '.less',
    '.json', '.xml', '.yaml', '.yml', '.toml', '.ini',
    '.sql', '.sh', '.bat', '.ps1', '.dockerfile',
    // 設定ファイル
    '.gitignore', '.gitattributes', '.editorconfig',
    '.eslintrc', '.prettierrc', '.babelrc',
    '.env', '.env.example', '.env.local',
    // ドキュメント
    '.pdf', '.doc', '.docx',
    // 画像（小さいもののみ）
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
    // その他
    '.license', '.changelog', '.makefile'
  ]);

  /**
   * アーカイブファイルを展開
   */
  async extractArchive(archivePath: string, extractPath: string): Promise<string[]> {
    try {
      await fs.mkdir(extractPath, { recursive: true });

      const extractedFiles: string[] = [];
      let fileCount = 0;
      let rootDir: string | null = null;

      // tar.gz ファイルを展開
      await tar.extract({
        file: archivePath,
        cwd: extractPath,
        filter: (filePath: string, entry: any) => {
          console.log(`Processing tar entry: ${filePath} (type: ${entry.type}, size: ${entry.size})`);
          
          // ルートディレクトリを検出して除去
          const pathParts = filePath.split('/');
          if (!rootDir && pathParts.length > 0 && entry.type === 'Directory') {
            rootDir = pathParts[0];
            console.log(`Detected root directory: ${rootDir}`);
          }

          // 除外すべきディレクトリのチェック
          if (this.shouldExcludePath(filePath)) {
            console.warn(`Excluded path: ${filePath}`);
            return false;
          }

          // ファイル数制限チェック
          if (fileCount >= this.maxTotalFiles) {
            console.warn(`Too many files, skipping: ${filePath}`);
            return false;
          }

          // ファイルサイズ制限チェック
          if (entry.size > this.maxFileSize) {
            console.warn(`File too large, skipping: ${filePath} (${entry.size} bytes)`);
            return false;
          }

          // セキュリティチェック（パストラバーサル攻撃防止）
          if (this.isUnsafePath(filePath)) {
            console.warn(`Unsafe path, skipping: ${filePath}`);
            return false;
          }

          // ファイル拡張子チェック
          if (entry.type === 'File' && !this.isAllowedFile(filePath)) {
            console.warn(`File type not allowed, skipping: ${filePath}`);
            return false;
          }

          fileCount++;
          return true;
        },
        onentry: (entry: any) => {
          // Note: onentry is called AFTER the filter function
          // If the filter returned true, the file will be extracted
          // We need to check again if this file should be included
          if (entry.type === 'File') {
            const filePath = entry.path;
            
            // 除外すべきパスの再チェック
            if (this.shouldExcludePath(filePath)) {
              return;
            }
            
            // ファイル拡張子の再チェック
            if (!this.isAllowedFile(filePath)) {
              return;
            }
            
            // ルートディレクトリを除去したパスを保存
            let cleanPath = filePath;
            if (rootDir && filePath.startsWith(rootDir + '/')) {
              cleanPath = filePath.substring(rootDir.length + 1);
            }
            
            // 空のパスはスキップ
            if (!cleanPath || cleanPath === rootDir) {
              console.log(`Skipping empty or root path: ${filePath}`);
              return;
            }
            
            console.log(`Adding file to list: ${cleanPath} (original: ${filePath})`);
            extractedFiles.push(cleanPath);
          }
        }
      });

      console.log(`Successfully extracted ${extractedFiles.length} files`);
      return extractedFiles;

    } catch (error: any) {
      console.error('Archive extraction failed:', error);
      throw new Error(`Archive extraction failed: ${error.message}`);
    }
  }

  /**
   * ファイル情報を取得
   */
  async getFileInfo(filePath: string, basePath: string): Promise<FileInfo> {
    try {
      const fullPath = path.join(basePath, filePath);
      const stats = await fs.stat(fullPath);

      const fileInfo: FileInfo = {
        path: filePath,
        size: stats.size,
        type: stats.isDirectory() ? 'directory' : 'file'
      };

      // ファイルの場合は内容を読み込み
      if (fileInfo.type === 'file' && stats.size <= this.maxFileSize) {
        try {
          fileInfo.content = await fs.readFile(fullPath);
        } catch (readError) {
          console.warn(`Failed to read file content: ${filePath}`, readError);
        }
      }

      return fileInfo;

    } catch (error: any) {
      console.error(`Failed to get file info: ${filePath}`, error);
      throw new Error(`Failed to get file info: ${error.message}`);
    }
  }

  /**
   * ディレクトリ構造を取得
   */
  async getDirectoryStructure(basePath: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];

    async function walkDirectory(currentPath: string, relativePath: string = '') {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const entryPath = path.join(currentPath, entry.name);
          const relativeEntryPath = path.join(relativePath, entry.name);

          if (entry.isDirectory()) {
            files.push({
              path: relativeEntryPath,
              size: 0,
              type: 'directory'
            });

            // 再帰的にディレクトリを探索
            await walkDirectory(entryPath, relativeEntryPath);
          } else if (entry.isFile()) {
            const stats = await fs.stat(entryPath);
            const fileInfo: FileInfo = {
              path: relativeEntryPath,
              size: stats.size,
              type: 'file'
            };

            // 小さなファイルの場合は内容も読み込み
            if (stats.size <= 1024 * 1024) { // 1MB以下
              try {
                fileInfo.content = await fs.readFile(entryPath);
              } catch (readError) {
                console.warn(`Failed to read file: ${relativeEntryPath}`, readError);
              }
            }

            files.push(fileInfo);
          }
        }
      } catch (error) {
        console.error(`Failed to read directory: ${currentPath}`, error);
      }
    }

    await walkDirectory(basePath);
    return files;
  }

  /**
   * ファイル内容をBase64エンコード
   */
  encodeFileContent(content: Buffer): string {
    return content.toString('base64');
  }

  /**
   * ファイル内容をテキストとして取得（可能な場合）
   */
  getTextContent(content: Buffer, filePath: string): string | null {
    try {
      // バイナリファイルかどうかをチェック
      if (this.isBinaryFile(content, filePath)) {
        return null;
      }

      // UTF-8として解釈を試行
      return content.toString('utf-8');
    } catch (error) {
      console.warn(`Failed to decode text content: ${filePath}`, error);
      return null;
    }
  }

  /**
   * バイナリファイルかどうかを判定
   */
  private isBinaryFile(content: Buffer, filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    
    // 拡張子による判定
    const binaryExtensions = new Set([
      '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
      '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar',
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp',
      '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.ttf', '.otf', '.woff', '.woff2', '.eot'
    ]);

    if (binaryExtensions.has(ext)) {
      return true;
    }

    // 内容による判定（最初の1024バイトをチェック）
    const sample = content.slice(0, 1024);
    let nullBytes = 0;
    let controlChars = 0;

    for (let i = 0; i < sample.length; i++) {
      const byte = sample[i];
      
      if (byte === 0) {
        nullBytes++;
      } else if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
        controlChars++;
      }
    }

    // NULL バイトが多い、または制御文字が多い場合はバイナリと判定
    return (nullBytes > sample.length * 0.01) || (controlChars > sample.length * 0.05);
  }

  /**
   * 除外すべきパスかどうかをチェック
   */
  private shouldExcludePath(filePath: string): boolean {
    const excludePatterns = [
      /node_modules\//,
      /\.git\//,
      /\.svn\//,
      /\.hg\//,
      /\.DS_Store$/,
      /Thumbs\.db$/,
      /\.vscode\//,
      /\.idea\//,
      /dist\//,
      /build\//,
      /coverage\//,
      /\.nyc_output\//,
      /\.cache\//,
      /\.next\//,
      /\.nuxt\//,
      /\.vuepress\//,
      /vendor\//,
      /bower_components\//,
      /__pycache__\//,
      /\.pytest_cache\//,
      /\.mypy_cache\//,
      /\.tox\//,
      /\.eggs\//,
      /\.gradle\//,
      /target\//  // Maven
    ];

    return excludePatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * 安全でないパスかどうかをチェック
   */
  private isUnsafePath(filePath: string): boolean {
    // パストラバーサル攻撃を防ぐ
    const normalizedPath = path.normalize(filePath);
    
    // 絶対パスや親ディレクトリへの参照を含む場合は危険
    if (normalizedPath.startsWith('/') || 
        normalizedPath.startsWith('..') || 
        normalizedPath.includes('../')) {
      return true;
    }

    // 危険なファイル名パターン
    const dangerousPatterns = [
      /^\.+$/, // . や .. のみ
      /\0/, // NULL文字
      /[<>:"|?*]/, // Windows で禁止されている文字
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i // Windows 予約名
    ];

    const fileName = path.basename(filePath);
    return dangerousPatterns.some(pattern => pattern.test(fileName));
  }

  /**
   * 許可されたファイルかどうかをチェック
   */
  private isAllowedFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath).toLowerCase();

    // 拡張子なしの特別なファイル
    const allowedNoExtFiles = new Set([
      'readme', 'license', 'changelog', 'makefile', 'dockerfile',
      'gemfile', 'rakefile', 'procfile', 'vagrantfile'
    ]);

    if (allowedNoExtFiles.has(fileName)) {
      return true;
    }

    // 拡張子による判定
    if (ext && this.allowedExtensions.has(ext)) {
      return true;
    }

    // 設定ファイルパターン
    const configPatterns = [
      /^\..*rc$/, // .eslintrc, .babelrc など
      /^\..*ignore$/, // .gitignore, .dockerignore など
      /^\.env/, // .env, .env.local など
      /package\.json$/, // package.json
      /composer\.json$/, // composer.json
      /requirements\.txt$/, // requirements.txt
      /yarn\.lock$/, // yarn.lock
      /package-lock\.json$/ // package-lock.json
    ];

    return configPatterns.some(pattern => pattern.test(fileName));
  }

  /**
   * ファイルサイズを人間が読みやすい形式に変換
   */
  formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * プロジェクト統計を取得
   */
  async getProjectStats(files: FileInfo[]): Promise<{
    totalFiles: number;
    totalSize: number;
    fileTypes: Record<string, number>;
    languages: Record<string, number>;
    directories: number;
  }> {
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      fileTypes: {} as Record<string, number>,
      languages: {} as Record<string, number>,
      directories: 0
    };

    for (const file of files) {
      if (file.type === 'directory') {
        stats.directories++;
      } else {
        stats.totalFiles++;
        stats.totalSize += file.size;

        const ext = path.extname(file.path).toLowerCase();
        if (ext) {
          stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
          
          // プログラミング言語の推定
          const language = this.getLanguageFromExtension(ext);
          if (language) {
            stats.languages[language] = (stats.languages[language] || 0) + 1;
          }
        }
      }
    }

    return stats;
  }

  /**
   * 拡張子からプログラミング言語を推定
   */
  private getLanguageFromExtension(ext: string): string | null {
    const languageMap: Record<string, string> = {
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.jsx': 'JavaScript',
      '.tsx': 'TypeScript',
      '.vue': 'Vue',
      '.svelte': 'Svelte',
      '.py': 'Python',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.java': 'Java',
      '.c': 'C',
      '.cpp': 'C++',
      '.h': 'C',
      '.hpp': 'C++',
      '.cs': 'C#',
      '.go': 'Go',
      '.rs': 'Rust',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.html': 'HTML',
      '.htm': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.sass': 'Sass',
      '.less': 'Less',
      '.json': 'JSON',
      '.xml': 'XML',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.toml': 'TOML',
      '.sql': 'SQL',
      '.sh': 'Shell',
      '.bat': 'Batch',
      '.ps1': 'PowerShell'
    };

    return languageMap[ext] || null;
  }
}

