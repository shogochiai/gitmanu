import { Hono } from 'hono';
import { GitHubUser, UserSession } from '../types/index.js';
type Variables = {
    user: GitHubUser;
    session: UserSession;
};
declare const upload: Hono<{
    Variables: Variables;
}, import("hono/types").BlankSchema, "/">;
export default upload;
//# sourceMappingURL=upload.d.ts.map