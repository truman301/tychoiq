// Dependency-free auth constants safe to import from the edge middleware
// (must NOT pull in node:crypto or any Node-only modules).

export const SESSION_COOKIE = "tq_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
