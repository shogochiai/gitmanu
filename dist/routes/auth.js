import { Hono } from 'hono';
import { config } from '../utils/config.js';
import { sessionManager } from '../utils/session.js';
import { setCookie, deleteCookie } from '../middleware/auth.js';
const auth = new Hono();
/**
 * GitHub OAuth認証開始
 */
auth.get('/github', async (c) => {
    try {
        const state = generateRandomString(32);
        const scope = 'user:email,repo,public_repo';
        // 状態をセッションに保存（CSRF攻撃防止）
        setCookie(c, 'oauth_state', state, { maxAge: 600, httpOnly: true }); // 10分間有効
        const authUrl = new URL('https://github.com/login/oauth/authorize');
        authUrl.searchParams.set('client_id', config.get('github').clientId);
        authUrl.searchParams.set('redirect_uri', config.get('github').redirectUri);
        authUrl.searchParams.set('scope', scope);
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('allow_signup', 'true');
        return c.redirect(authUrl.toString());
    }
    catch (error) {
        console.error('GitHub OAuth start error:', error);
        return c.redirect('/?auth=error&message=' + encodeURIComponent('認証の開始に失敗しました'));
    }
});
/**
 * GitHub OAuth コールバック
 */
auth.get('/github/callback', async (c) => {
    try {
        const code = c.req.query('code');
        const state = c.req.query('state');
        const error = c.req.query('error');
        const errorDescription = c.req.query('error_description');
        // エラーチェック
        if (error) {
            console.error('GitHub OAuth error:', error, errorDescription);
            return c.redirect('/?auth=error&message=' + encodeURIComponent(errorDescription || 'GitHub認証がキャンセルされました'));
        }
        if (!code || !state) {
            return c.redirect('/?auth=error&message=' + encodeURIComponent('認証パラメータが不正です'));
        }
        // 状態検証（CSRF攻撃防止）
        const savedState = getCookieValue(c.req.header('Cookie') || '', 'oauth_state');
        if (!savedState || savedState !== state) {
            return c.redirect('/?auth=error&message=' + encodeURIComponent('認証状態が不正です'));
        }
        // 状態Cookieを削除
        deleteCookie(c, 'oauth_state');
        // アクセストークンを取得
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'GitHub-Uploader/1.0'
            },
            body: JSON.stringify({
                client_id: config.get('github').clientId,
                client_secret: config.get('github').clientSecret,
                code: code,
                redirect_uri: config.get('github').redirectUri
            })
        });
        if (!tokenResponse.ok) {
            throw new Error(`Token request failed: ${tokenResponse.statusText}`);
        }
        const tokenData = await tokenResponse.json();
        if (tokenData.error) {
            throw new Error(`Token error: ${tokenData.error_description || tokenData.error}`);
        }
        const accessToken = tokenData.access_token;
        if (!accessToken) {
            throw new Error('アクセストークンの取得に失敗しました');
        }
        // ユーザー情報を取得
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'GitHub-Uploader/1.0'
            }
        });
        if (!userResponse.ok) {
            throw new Error(`User info request failed: ${userResponse.statusText}`);
        }
        const userData = await userResponse.json();
        // ユーザーのメールアドレスを取得
        const emailResponse = await fetch('https://api.github.com/user/emails', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'GitHub-Uploader/1.0'
            }
        });
        let primaryEmail = userData.email;
        if (emailResponse.ok) {
            const emails = await emailResponse.json();
            const primary = emails.find((email) => email.primary);
            if (primary) {
                primaryEmail = primary.email;
            }
        }
        // GitHubユーザー情報を構築
        const user = {
            id: userData.id,
            login: userData.login,
            name: userData.name || userData.login,
            email: primaryEmail || '',
            avatar_url: userData.avatar_url,
            access_token: accessToken
        };
        // セッションを作成
        const sessionId = sessionManager.createSession(user);
        // JWTトークンを生成
        const jwtToken = sessionManager.generateJWT(sessionId);
        // セッションCookieを設定
        setCookie(c, 'session_token', jwtToken, {
            maxAge: 24 * 60 * 60, // 24時間
            httpOnly: true,
            secure: c.req.url.startsWith('https://'),
            sameSite: 'Lax'
        });
        // 成功リダイレクト
        return c.redirect('/?auth=success');
    }
    catch (error) {
        console.error('GitHub OAuth callback error:', error);
        return c.redirect('/?auth=error&message=' + encodeURIComponent('認証処理中にエラーが発生しました'));
    }
});
/**
 * ログアウト
 */
auth.post('/logout', async (c) => {
    try {
        const sessionToken = getCookieValue(c.req.header('Cookie') || '', 'session_token');
        if (sessionToken) {
            const jwtPayload = sessionManager.verifyJWT(sessionToken);
            if (jwtPayload) {
                // セッションを削除
                sessionManager.destroySession(jwtPayload.sessionId);
            }
        }
        // セッションCookieを削除
        deleteCookie(c, 'session_token');
        return c.json({
            success: true,
            message: 'ログアウトしました'
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        return c.json({
            success: false,
            error: 'LOGOUT_ERROR',
            message: 'ログアウト処理中にエラーが発生しました'
        }, 500);
    }
});
/**
 * 認証状態確認
 */
auth.get('/status', async (c) => {
    try {
        const sessionToken = getCookieValue(c.req.header('Cookie') || '', 'session_token');
        if (!sessionToken) {
            return c.json({
                success: true,
                data: { authenticated: false, user: null }
            });
        }
        const jwtPayload = sessionManager.verifyJWT(sessionToken);
        if (!jwtPayload) {
            return c.json({
                success: true,
                data: { authenticated: false, user: null }
            });
        }
        const session = sessionManager.getSession(jwtPayload.sessionId);
        if (!session) {
            return c.json({
                success: true,
                data: { authenticated: false, user: null }
            });
        }
        // セッションを更新
        sessionManager.refreshSession(jwtPayload.sessionId);
        // ユーザー情報を取得（GitHub APIから最新情報を取得）
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${session.accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'GitHub-Uploader/1.0'
            }
        });
        if (!userResponse.ok) {
            // アクセストークンが無効な場合はセッションを削除
            sessionManager.destroySession(jwtPayload.sessionId);
            deleteCookie(c, 'session_token');
            return c.json({
                success: true,
                data: { authenticated: false, user: null }
            });
        }
        const userData = await userResponse.json();
        const user = {
            id: userData.id,
            login: userData.login,
            name: userData.name || userData.login,
            email: userData.email || '',
            avatar_url: userData.avatar_url,
            access_token: session.accessToken
        };
        return c.json({
            success: true,
            data: {
                authenticated: true,
                user: {
                    id: user.id,
                    login: user.login,
                    name: user.name,
                    email: user.email,
                    avatar_url: user.avatar_url
                    // access_tokenは含めない（セキュリティ上の理由）
                }
            }
        });
    }
    catch (error) {
        console.error('Auth status check error:', error);
        return c.json({
            success: false,
            error: 'AUTH_STATUS_ERROR',
            message: '認証状態の確認中にエラーが発生しました'
        }, 500);
    }
});
/**
 * ユーザープロフィール取得
 */
auth.get('/profile', async (c) => {
    try {
        const sessionToken = getCookieValue(c.req.header('Cookie') || '', 'session_token');
        if (!sessionToken) {
            return c.json({
                success: false,
                error: 'UNAUTHORIZED',
                message: 'ログインが必要です'
            }, 401);
        }
        const jwtPayload = sessionManager.verifyJWT(sessionToken);
        if (!jwtPayload) {
            return c.json({
                success: false,
                error: 'INVALID_TOKEN',
                message: 'セッションが無効です'
            }, 401);
        }
        const session = sessionManager.getSession(jwtPayload.sessionId);
        if (!session) {
            return c.json({
                success: false,
                error: 'SESSION_NOT_FOUND',
                message: 'セッションが見つかりません'
            }, 401);
        }
        // GitHub APIからユーザー情報を取得
        const [userResponse, emailResponse] = await Promise.all([
            fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `Bearer ${session.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'GitHub-Uploader/1.0'
                }
            }),
            fetch('https://api.github.com/user/emails', {
                headers: {
                    'Authorization': `Bearer ${session.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'GitHub-Uploader/1.0'
                }
            })
        ]);
        if (!userResponse.ok) {
            throw new Error(`User info request failed: ${userResponse.statusText}`);
        }
        const userData = await userResponse.json();
        let primaryEmail = userData.email;
        if (emailResponse.ok) {
            const emails = await emailResponse.json();
            const primary = emails.find((email) => email.primary);
            if (primary) {
                primaryEmail = primary.email;
            }
        }
        return c.json({
            success: true,
            data: {
                user: {
                    id: userData.id,
                    login: userData.login,
                    name: userData.name || userData.login,
                    email: primaryEmail || '',
                    avatar_url: userData.avatar_url,
                    bio: userData.bio,
                    location: userData.location,
                    blog: userData.blog,
                    company: userData.company,
                    public_repos: userData.public_repos,
                    followers: userData.followers,
                    following: userData.following,
                    created_at: userData.created_at,
                    updated_at: userData.updated_at
                }
            }
        });
    }
    catch (error) {
        console.error('Profile fetch error:', error);
        return c.json({
            success: false,
            error: 'PROFILE_FETCH_ERROR',
            message: 'プロフィール情報の取得中にエラーが発生しました'
        }, 500);
    }
});
/**
 * ランダム文字列生成
 */
function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
/**
 * Cookie値を取得するヘルパー関数
 */
function getCookieValue(cookieString, name) {
    const cookies = cookieString.split(';').map(cookie => cookie.trim());
    for (const cookie of cookies) {
        const [cookieName, cookieValue] = cookie.split('=');
        if (cookieName === name) {
            return decodeURIComponent(cookieValue);
        }
    }
    return null;
}
export default auth;
//# sourceMappingURL=auth.js.map