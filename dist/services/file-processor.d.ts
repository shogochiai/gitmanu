interface FileInfo {
    path: string;
    size: number;
    type: 'file' | 'directory';
    content?: Buffer;
}
export declare class FileProcessor {
    private readonly maxFileSize;
    private readonly maxTotalFiles;
    private readonly allowedExtensions;
    /**
     * アーカイブファイルを展開
     */
    extractArchive(archivePath: string, extractPath: string): Promise<{
        files: string[];
        rootDir: string | null;
    }>;
    /**
     * ファイル情報を取得
     */
    getFileInfo(filePath: string, basePath: string): Promise<FileInfo>;
    /**
     * ディレクトリ構造を取得
     */
    getDirectoryStructure(basePath: string): Promise<FileInfo[]>;
    /**
     * ファイル内容をBase64エンコード
     */
    encodeFileContent(content: Buffer): string;
    /**
     * ファイル内容をテキストとして取得（可能な場合）
     */
    getTextContent(content: Buffer, filePath: string): string | null;
    /**
     * バイナリファイルかどうかを判定
     */
    private isBinaryFile;
    /**
     * 除外すべきパスかどうかをチェック
     */
    private shouldExcludePath;
    /**
     * 安全でないパスかどうかをチェック
     */
    private isUnsafePath;
    /**
     * 許可されたファイルかどうかをチェック
     */
    private isAllowedFile;
    /**
     * ファイルサイズを人間が読みやすい形式に変換
     */
    formatFileSize(bytes: number): string;
    /**
     * プロジェクト統計を取得
     */
    getProjectStats(files: FileInfo[]): Promise<{
        totalFiles: number;
        totalSize: number;
        fileTypes: Record<string, number>;
        languages: Record<string, number>;
        directories: number;
    }>;
    /**
     * 拡張子からプログラミング言語を推定
     */
    private getLanguageFromExtension;
}
export {};
//# sourceMappingURL=file-processor.d.ts.map