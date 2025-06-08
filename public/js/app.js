/**
 * GitHub Uploader - フロントエンドJavaScript
 * モバイル対応のファイルアップロード＆GitHub連携
 */

class GitHubUploader {
    constructor() {
        this.currentUser = null;
        this.uploadedFile = null;
        this.uploadProgress = null;
        
        this.init();
    }

    /**
     * 初期化
     */
    init() {
        this.bindEvents();
        this.checkAuthStatus();
        this.setupDragAndDrop();
    }

    /**
     * イベントバインディング
     */
    bindEvents() {
        // ログインボタン
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.login());
        }

        // ログアウトボタン
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // ファイル選択
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        // アップロードエリアクリック
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.addEventListener('click', () => {
                document.getElementById('fileInput').click();
            });
        }

        // アップロードボタン
        const uploadBtn = document.getElementById('uploadBtn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => this.startUpload());
        }

        // キャンセルボタン
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelUpload());
        }

        // 新しいアップロードボタン
        const newUploadBtn = document.getElementById('newUploadBtn');
        if (newUploadBtn) {
            newUploadBtn.addEventListener('click', () => this.resetUpload());
        }

        // 再試行ボタン
        const retryBtn = document.getElementById('retryBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.retryUpload());
        }

        // リセットボタン
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetUpload());
        }

        // プロジェクト名の自動生成
        const fileInput2 = document.getElementById('fileInput');
        if (fileInput2) {
            fileInput2.addEventListener('change', () => this.autoGenerateProjectName());
        }
    }

    /**
     * ドラッグ&ドロップ設定
     */
    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        if (!uploadArea) return;

        // ドラッグオーバー防止
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });

        // ドラッグオーバー時のスタイル
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.remove('dragover');
            }, false);
        });

        // ドロップ処理
        uploadArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect({ target: { files } });
            }
        }, false);
    }

    /**
     * デフォルトイベント防止
     */
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * 認証状態確認
     */
    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/status', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.user) {
                    this.currentUser = data.data.user;
                    this.showUploadSection();
                } else {
                    this.showAuthSection();
                }
            } else {
                this.showAuthSection();
            }
        } catch (error) {
            console.error('認証状態確認エラー:', error);
            this.showAuthSection();
        }
    }

    /**
     * ログイン
     */
    login() {
        window.location.href = '/auth/github';
    }

    /**
     * ログアウト
     */
    async logout() {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                this.currentUser = null;
                this.showAuthSection();
                this.showNotification('ログアウトしました', 'success');
            }
        } catch (error) {
            console.error('ログアウトエラー:', error);
            this.showNotification('ログアウトに失敗しました', 'error');
        }
    }

    /**
     * 認証セクション表示
     */
    showAuthSection() {
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('uploadSection').style.display = 'none';
        
        // ユーザー情報を非表示
        document.getElementById('userInfo').style.display = 'none';
    }

    /**
     * アップロードセクション表示
     */
    showUploadSection() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('uploadSection').style.display = 'block';
        
        // ユーザー情報を表示
        if (this.currentUser) {
            document.getElementById('userInfo').style.display = 'flex';
            document.getElementById('userAvatar').src = this.currentUser.avatar_url;
            document.getElementById('userName').textContent = this.currentUser.name || this.currentUser.login;
        }
    }

    /**
     * ファイル選択処理
     */
    handleFileSelect(event) {
        const files = event.target.files;
        if (files.length === 0) return;

        const file = files[0];
        
        // ファイル形式チェック
        if (!this.isValidFile(file)) {
            this.showNotification('対応していないファイル形式です。.tar.gz または .tgz ファイルを選択してください。', 'error');
            return;
        }

        // ファイルサイズチェック
        if (file.size > 100 * 1024 * 1024) { // 100MB
            this.showNotification('ファイルサイズが大きすぎます。100MB以下のファイルを選択してください。', 'error');
            return;
        }

        this.uploadedFile = file;
        this.showProjectSettings();
        this.autoGenerateProjectName();
    }

    /**
     * ファイル形式チェック
     */
    isValidFile(file) {
        const validTypes = [
            'application/gzip',
            'application/x-gzip',
            'application/x-tar',
            'application/x-compressed-tar'
        ];
        
        const validExtensions = ['.tar.gz', '.tgz'];
        
        return validTypes.includes(file.type) || 
               validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    }

    /**
     * プロジェクト名自動生成
     */
    autoGenerateProjectName() {
        if (!this.uploadedFile) return;

        let projectName = this.uploadedFile.name;
        
        // 拡張子を除去
        projectName = projectName.replace(/\.(tar\.gz|tgz)$/i, '');
        
        // GitHubリポジトリ名として有効な形式に変換
        projectName = projectName
            .toLowerCase()
            .replace(/[^a-z0-9\-_]/g, '-')
            .replace(/--+/g, '-')
            .replace(/^-+|-+$/g, '');

        document.getElementById('projectName').value = projectName;
    }

    /**
     * プロジェクト設定表示
     */
    showProjectSettings() {
        document.getElementById('projectSettings').style.display = 'block';
        document.getElementById('uploadArea').style.display = 'none';
    }

    /**
     * アップロード開始
     */
    async startUpload() {
        if (!this.uploadedFile) {
            this.showNotification('ファイルが選択されていません', 'error');
            return;
        }

        const projectName = document.getElementById('projectName').value.trim();
        if (!projectName) {
            this.showNotification('プロジェクト名を入力してください', 'error');
            return;
        }

        if (!this.isValidProjectName(projectName)) {
            this.showNotification('プロジェクト名は英数字、ハイフン、アンダースコアのみ使用できます', 'error');
            return;
        }

        const projectDescription = document.getElementById('projectDescription').value.trim();
        const isPrivate = document.getElementById('isPrivate').checked;
        const topicsInput = document.getElementById('projectTopics').value.trim();
        const topics = topicsInput ? topicsInput.split(',').map(t => t.trim()).filter(t => t) : [];

        // アップロード開始
        this.showProgressSection();
        this.updateProgress(0, 'ファイルをアップロード中...', 'uploading');

        try {
            const formData = new FormData();
            formData.append('file', this.uploadedFile);
            formData.append('projectName', projectName);
            formData.append('projectDescription', projectDescription);
            formData.append('isPrivate', isPrivate.toString());
            formData.append('topics', JSON.stringify(topics));

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`アップロードエラー: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.showUploadSuccess(result.data);
            } else {
                throw new Error(result.error || 'アップロードに失敗しました');
            }

        } catch (error) {
            console.error('アップロードエラー:', error);
            this.showUploadError(error.message);
        }
    }

    /**
     * プロジェクト名の妥当性チェック
     */
    isValidProjectName(name) {
        return /^[a-zA-Z0-9\-_]+$/.test(name) && name.length >= 1 && name.length <= 100;
    }

    /**
     * プログレス表示
     */
    showProgressSection() {
        document.getElementById('projectSettings').style.display = 'none';
        document.getElementById('progressSection').style.display = 'block';
        document.getElementById('resultSection').style.display = 'none';
    }

    /**
     * プログレス更新
     */
    updateProgress(percent, message, stage) {
        document.getElementById('progressFill').style.width = `${percent}%`;
        document.getElementById('progressPercent').textContent = `${Math.round(percent)}%`;
        document.getElementById('progressStage').textContent = message;

        // ファイル情報更新
        if (this.uploadedFile) {
            document.getElementById('totalSize').textContent = this.formatFileSize(this.uploadedFile.size);
        }
    }

    /**
     * アップロード成功表示
     */
    showUploadSuccess(data) {
        document.getElementById('progressSection').style.display = 'none';
        document.getElementById('resultSection').style.display = 'block';
        document.getElementById('resultSuccess').style.display = 'block';
        document.getElementById('resultError').style.display = 'none';

        // 結果情報設定
        const repoLink = document.getElementById('repoLink');
        repoLink.href = data.repository.html_url;
        repoLink.textContent = data.repository.full_name;

        const viewRepoBtn = document.getElementById('viewRepoBtn');
        viewRepoBtn.href = data.repository.html_url;

        document.getElementById('createdAt').textContent = new Date(data.repository.created_at).toLocaleString('ja-JP');

        this.showNotification('プロジェクトが正常にアップロードされました！', 'success');
    }

    /**
     * アップロードエラー表示
     */
    showUploadError(errorMessage) {
        document.getElementById('progressSection').style.display = 'none';
        document.getElementById('resultSection').style.display = 'block';
        document.getElementById('resultSuccess').style.display = 'none';
        document.getElementById('resultError').style.display = 'block';

        document.getElementById('errorMessage').textContent = errorMessage;
        this.showNotification('アップロードに失敗しました', 'error');
    }

    /**
     * アップロードキャンセル
     */
    cancelUpload() {
        this.resetUpload();
    }

    /**
     * 再試行
     */
    retryUpload() {
        this.showProjectSettings();
    }

    /**
     * アップロードリセット
     */
    resetUpload() {
        this.uploadedFile = null;
        
        // フォームリセット
        document.getElementById('projectName').value = '';
        document.getElementById('projectDescription').value = '';
        document.getElementById('isPrivate').checked = false;
        document.getElementById('projectTopics').value = '';
        document.getElementById('fileInput').value = '';

        // 表示リセット
        document.getElementById('uploadArea').style.display = 'block';
        document.getElementById('projectSettings').style.display = 'none';
        document.getElementById('progressSection').style.display = 'none';
        document.getElementById('resultSection').style.display = 'none';
    }

    /**
     * ファイルサイズフォーマット
     */
    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * 通知表示
     */
    showNotification(message, type = 'info') {
        // 既存の通知を削除
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // 新しい通知を作成
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        // スタイル設定
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            max-width: 400px;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            transform: translateX(100%);
            transition: transform 0.3s ease-in-out;
            ${this.getNotificationStyles(type)}
        `;

        document.body.appendChild(notification);

        // アニメーション表示
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // 閉じるボタンイベント
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.hideNotification(notification);
        });

        // 自動非表示
        setTimeout(() => {
            this.hideNotification(notification);
        }, 5000);
    }

    /**
     * 通知スタイル取得
     */
    getNotificationStyles(type) {
        const styles = {
            success: 'background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;',
            error: 'background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;',
            warning: 'background-color: #fff3cd; color: #856404; border: 1px solid #ffeaa7;',
            info: 'background-color: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb;'
        };
        return styles[type] || styles.info;
    }

    /**
     * 通知非表示
     */
    hideNotification(notification) {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }
}

/**
 * URLパラメータ処理
 */
function handleUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // OAuth認証後のリダイレクト処理
    if (urlParams.get('auth') === 'success') {
        // URLをクリーンアップ
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // 認証成功通知
        setTimeout(() => {
            if (window.uploader) {
                window.uploader.showNotification('GitHubログインが完了しました！', 'success');
            }
        }, 1000);
    } else if (urlParams.get('auth') === 'error') {
        const error = urlParams.get('message') || '認証に失敗しました';
        
        // URLをクリーンアップ
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // エラー通知
        setTimeout(() => {
            if (window.uploader) {
                window.uploader.showNotification(error, 'error');
            }
        }, 1000);
    }
}

/**
 * PWA対応
 */
function setupPWA() {
    // Service Worker登録
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('SW registered: ', registration);
                })
                .catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });
        });
    }

    // インストールプロンプト
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // インストールボタンを表示（必要に応じて）
        showInstallButton();
    });

    function showInstallButton() {
        // インストールボタンの表示ロジック
        // 必要に応じて実装
    }
}

/**
 * アプリケーション初期化
 */
document.addEventListener('DOMContentLoaded', () => {
    // メインアプリケーション初期化
    window.uploader = new GitHubUploader();
    
    // URLパラメータ処理
    handleUrlParams();
    
    // PWA設定
    setupPWA();
    
    console.log('GitHub Uploader initialized');
});

