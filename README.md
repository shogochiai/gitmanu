# 📱 GitHub Uploader

モバイル対応のGitHubプロジェクトアップロードサービス

## 🌟 特徴

- **📱 モバイル最適化**: スマートフォンからでも快適に操作
- **🔐 GitHub OAuth**: 安全なGitHub認証システム
- **📦 tar.gz対応**: アーカイブファイルを自動展開してリポジトリ作成
- **⚡ 高速処理**: 効率的なファイル処理とアップロード
- **🛡️ セキュリティ**: レート制限、CORS、セキュリティヘッダー
- **☁️ クラウド対応**: Fly.ioで簡単デプロイ

## 🚀 クイックスタート

### 1. リポジトリクローン

```bash
git clone https://github.com/[username]/github-uploader.git
cd github-uploader
```

### 2. 依存関係インストール

```bash
npm install
```

### 3. 環境変数設定

```bash
cp .env.example .env
# .env ファイルを編集してGitHub OAuth設定を行う
```

### 4. GitHub OAuth App作成

1. [GitHub Developer Settings](https://github.com/settings/developers) にアクセス
2. "New OAuth App" をクリック
3. 以下の情報を入力:
   - **Application name**: GitHub Uploader
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/auth/github/callback`
4. Client IDとClient Secretを`.env`ファイルに設定

### 5. 開発サーバー起動

```bash
npm run dev
```

アプリケーションが `http://localhost:3000` で起動します。

## 🌐 本番デプロイ（Fly.io）

### 前提条件

- [Fly.io](https://fly.io) アカウント
- [flyctl CLI](https://fly.io/docs/hands-on/install-flyctl/) インストール

### デプロイ手順

```bash
# 自動デプロイスクリプト実行
chmod +x deploy.sh
./deploy.sh
```

または手動デプロイ:

```bash
# Fly.io ログイン
flyctl auth login

# アプリケーション作成
flyctl apps create github-uploader

# 環境変数設定
flyctl secrets set GITHUB_CLIENT_ID=your_client_id
flyctl secrets set GITHUB_CLIENT_SECRET=your_client_secret
flyctl secrets set JWT_SECRET=your_jwt_secret

# デプロイ
flyctl deploy
```

## 📖 API ドキュメント

### 認証エンドポイント

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/auth/github` | GitHub OAuth認証開始 |
| GET | `/auth/github/callback` | OAuth コールバック |
| POST | `/api/auth/logout` | ログアウト |
| GET | `/api/auth/status` | 認証状態確認 |
| GET | `/api/auth/profile` | ユーザープロフィール取得 |

### アップロードエンドポイント

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| POST | `/api/upload` | ファイルアップロード＆リポジトリ作成 |
| GET | `/api/upload/repositories` | ユーザーリポジトリ一覧 |

### システムエンドポイント

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/health` | ヘルスチェック |
| GET | `/api` | API情報 |

## 🔧 設定

### 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `NODE_ENV` | 実行環境 | `development` |
| `PORT` | ポート番号 | `3000` |
| `BASE_URL` | ベースURL | `http://localhost:3000` |
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID | - |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret | - |
| `JWT_SECRET` | JWT署名用秘密鍵 | - |
| `MAX_FILE_SIZE` | 最大ファイルサイズ（バイト） | `104857600` (100MB) |
| `MAX_FILES_PER_ARCHIVE` | アーカイブ内最大ファイル数 | `10000` |

### ファイル制限

- **対応形式**: `.tar.gz`, `.tgz`
- **最大ファイルサイズ**: 100MB
- **最大ファイル数**: 10,000ファイル
- **対応ファイル種別**: ソースコード、設定ファイル、ドキュメント、小さな画像

## 📱 使用方法

### 1. ログイン

1. アプリケーションにアクセス
2. "GitHubでログイン" ボタンをクリック
3. GitHub認証を完了

### 2. プロジェクトアップロード

1. "ファイルを選択" でtar.gzファイルを選択
2. プロジェクト名と説明を入力
3. プライベート/パブリック設定を選択
4. "アップロード" ボタンをクリック

### 3. 結果確認

- アップロード完了後、GitHubリポジトリのURLが表示されます
- 自動的にREADME.mdが生成されます（存在しない場合）

## 🛡️ セキュリティ

- **OAuth認証**: GitHub公式OAuth使用
- **CSRF保護**: 状態パラメータによる検証
- **レート制限**: API乱用防止
- **ファイル検証**: 安全でないファイルの除外
- **パストラバーサル防止**: ディレクトリ外アクセス防止

## 🧪 テスト

```bash
# ユニットテスト実行
npm test

# カバレッジ付きテスト
npm run test:coverage

# E2Eテスト
npm run test:e2e
```

## 📊 監視

### ヘルスチェック

```bash
curl http://localhost:3000/health
```

### ログ確認（Fly.io）

```bash
flyctl logs --app github-uploader
```

### メトリクス

- リクエスト数
- レスポンス時間
- エラー率
- アップロード成功率

## 🤝 コントリビューション

1. フォークしてください
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📄 ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 🆘 サポート

問題が発生した場合は、以下の方法でサポートを受けられます:

- [Issues](https://github.com/[username]/github-uploader/issues) でバグ報告や機能要求
- [Discussions](https://github.com/[username]/github-uploader/discussions) で質問や議論

## 🙏 謝辞

- [Hono](https://hono.dev/) - 高速なWebフレームワーク
- [Fly.io](https://fly.io/) - 優れたクラウドプラットフォーム
- [GitHub API](https://docs.github.com/en/rest) - 強力なAPI

---

**📱 モバイルからでも簡単にGitHubプロジェクトをアップロード！**

