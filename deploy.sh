#!/bin/bash

# GitHub Uploader デプロイメントスクリプト
set -e

echo "🚀 GitHub Uploader デプロイメント開始..."

# 色付きログ関数
log_info() {
    echo -e "\033[34m[INFO]\033[0m $1"
}

log_success() {
    echo -e "\033[32m[SUCCESS]\033[0m $1"
}

log_warning() {
    echo -e "\033[33m[WARNING]\033[0m $1"
}

log_error() {
    echo -e "\033[31m[ERROR]\033[0m $1"
}

# 前提条件チェック
check_prerequisites() {
    log_info "前提条件をチェック中..."
    
    # Node.js チェック
    if ! command -v node &> /dev/null; then
        log_error "Node.js がインストールされていません"
        exit 1
    fi
    
    # npm チェック
    if ! command -v npm &> /dev/null; then
        log_error "npm がインストールされていません"
        exit 1
    fi
    
    # flyctl チェック
    if ! command -v flyctl &> /dev/null; then
        log_warning "flyctl がインストールされていません。インストールしています..."
        curl -L https://fly.io/install.sh | sh
        export PATH="$HOME/.fly/bin:$PATH"
    fi
    
    log_success "前提条件チェック完了"
}

# 依存関係インストール
install_dependencies() {
    log_info "依存関係をインストール中..."
    npm ci
    log_success "依存関係インストール完了"
}

# ビルド
build_project() {
    log_info "プロジェクトをビルド中..."
    npm run build
    log_success "ビルド完了"
}

# 環境変数設定確認
check_environment() {
    log_info "環境変数設定を確認中..."
    
    if [ ! -f .env ]; then
        log_warning ".env ファイルが見つかりません。.env.example をコピーしています..."
        cp .env.example .env
        log_warning "⚠️  .env ファイルを編集して、GitHub OAuth設定を行ってください"
    fi
    
    # 必須環境変数チェック
    required_vars=("GITHUB_CLIENT_ID" "GITHUB_CLIENT_SECRET" "JWT_SECRET")
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ] && ! grep -q "^${var}=" .env; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        log_error "以下の環境変数が設定されていません:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        log_error ".env ファイルを編集してから再実行してください"
        exit 1
    fi
    
    log_success "環境変数設定確認完了"
}

# Fly.io ログイン確認
check_fly_auth() {
    log_info "Fly.io 認証状態を確認中..."
    
    if ! flyctl auth whoami &> /dev/null; then
        log_warning "Fly.io にログインしていません。ログインしています..."
        flyctl auth login
    fi
    
    log_success "Fly.io 認証確認完了"
}

# アプリケーション作成/更新
deploy_to_fly() {
    log_info "Fly.io にデプロイ中..."
    
    # アプリが存在するかチェック
    if ! flyctl apps list | grep -q "github-uploader"; then
        log_info "新しいアプリケーションを作成中..."
        flyctl apps create github-uploader --org personal
    fi
    
    # 環境変数を設定
    log_info "環境変数を設定中..."
    
    # .env ファイルから環境変数を読み込み
    if [ -f .env ]; then
        while IFS='=' read -r key value; do
            # コメント行と空行をスキップ
            if [[ $key =~ ^[[:space:]]*# ]] || [[ -z $key ]]; then
                continue
            fi
            
            # クォートを除去
            value=$(echo "$value" | sed 's/^["'\'']//' | sed 's/["'\'']$//')
            
            case $key in
                GITHUB_CLIENT_ID|GITHUB_CLIENT_SECRET|JWT_SECRET)
                    log_info "Setting secret: $key"
                    flyctl secrets set "$key=$value" --app github-uploader
                    ;;
                NODE_ENV|PORT|BASE_URL)
                    # これらは fly.toml で設定済み
                    ;;
                *)
                    log_info "Setting environment variable: $key"
                    flyctl secrets set "$key=$value" --app github-uploader
                    ;;
            esac
        done < .env
    fi
    
    # デプロイ実行
    log_info "アプリケーションをデプロイ中..."
    flyctl deploy --app github-uploader
    
    log_success "デプロイ完了"
}

# デプロイ後確認
verify_deployment() {
    log_info "デプロイメントを確認中..."
    
    # アプリのURLを取得
    app_url=$(flyctl info --app github-uploader | grep "Hostname" | awk '{print $2}')
    
    if [ -n "$app_url" ]; then
        log_success "✅ アプリケーションが正常にデプロイされました!"
        echo ""
        echo "🌐 アプリケーションURL: https://$app_url"
        echo "❤️  ヘルスチェック: https://$app_url/health"
        echo "📚 API ドキュメント: https://$app_url/api"
        echo ""
        echo "📱 GitHub OAuth設定を更新してください:"
        echo "   Authorization callback URL: https://$app_url/auth/github/callback"
        echo ""
        
        # ヘルスチェック
        log_info "ヘルスチェックを実行中..."
        if curl -f "https://$app_url/health" &> /dev/null; then
            log_success "✅ ヘルスチェック成功"
        else
            log_warning "⚠️  ヘルスチェックに失敗しました。アプリケーションの起動を待ってから再度確認してください"
        fi
    else
        log_error "アプリケーションURLの取得に失敗しました"
        exit 1
    fi
}

# メイン実行
main() {
    echo "🚀 GitHub Uploader デプロイメント開始"
    echo "========================================"
    
    check_prerequisites
    install_dependencies
    build_project
    check_environment
    check_fly_auth
    deploy_to_fly
    verify_deployment
    
    echo ""
    echo "========================================"
    log_success "🎉 デプロイメント完了!"
    echo ""
    echo "次のステップ:"
    echo "1. GitHub Developer Settings でOAuth設定を更新"
    echo "2. アプリケーションにアクセスして動作確認"
    echo "3. tar.gz ファイルをアップロードしてテスト"
    echo ""
}

# スクリプト実行
main "$@"

