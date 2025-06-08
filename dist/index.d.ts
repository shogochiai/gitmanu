import { Hono } from 'hono';
import { GitHubUser, UserSession } from './types/index.js';
type Variables = {
    user: GitHubUser;
    session: UserSession;
};
declare const app: Hono<{
    Variables: Variables;
}, import("hono/types").BlankSchema, "/">;
export default app;
//# sourceMappingURL=index.d.ts.map