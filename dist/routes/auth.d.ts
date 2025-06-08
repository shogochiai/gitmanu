import { Hono } from 'hono';
import { GitHubUser, UserSession } from '../types/index.js';
type Variables = {
    user: GitHubUser;
    session: UserSession;
};
declare const auth: Hono<{
    Variables: Variables;
}, import("hono/types").BlankSchema, "/">;
export default auth;
//# sourceMappingURL=auth.d.ts.map