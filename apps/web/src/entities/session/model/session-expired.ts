/** Query value on the login URL that explains why the member landed there. */
export const SESSION_EXPIRED_ERROR = "session-expired";

/** Query value on the login URL for a signed-in user without a membership. */
export const NO_ACCESS_ERROR = "no-access";

export const SESSION_EXPIRED_HREF = `/admin/login?error=${SESSION_EXPIRED_ERROR}`;
