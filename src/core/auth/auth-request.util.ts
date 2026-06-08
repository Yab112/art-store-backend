const SESSION_COOKIE_PATTERN =
  /(?:(?:__Secure-)?better-auth\.session_token)=([^;]+)/g;

const SESSION_COOKIE_REMOVE_PATTERN =
  /(?:__Secure-)?better-auth\.session_token=[^;]+;?/g;

export function extractSessionCookieNames(cookieHeader: string): string[] {
  const names = new Set<string>();
  const pattern =
    /((?:__Secure-)?better-auth\.session_token)=[^;]+/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(cookieHeader)) !== null) {
    names.add(match[1]);
  }

  return Array.from(names);
}

export function normalizeAuthRequestHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  const normalized = { ...headers };
  const authHeader = normalized.authorization ?? normalized.Authorization;
  const authValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  let cookieHeader =
    typeof normalized.cookie === "string" ? normalized.cookie : "";

  if (authValue?.startsWith("Bearer ")) {
    const token = authValue.slice("Bearer ".length).trim();
    if (token) {
      const secureCookie = `__Secure-better-auth.session_token=${token}`;
      cookieHeader = cookieHeader
        ? `${cookieHeader}; ${secureCookie}`
        : secureCookie;
    }
  }

  if (cookieHeader) {
    const sessionTokenMatches = cookieHeader.match(SESSION_COOKIE_PATTERN);

    if (sessionTokenMatches && sessionTokenMatches.length > 1) {
      const lastSessionCookie =
        sessionTokenMatches[sessionTokenMatches.length - 1];
      const cleanedCookies = cookieHeader
        .replace(SESSION_COOKIE_REMOVE_PATTERN, "")
        .trim();

      cookieHeader = cleanedCookies
        ? `${cleanedCookies}; ${lastSessionCookie}`
        : lastSessionCookie;
    }

    normalized.cookie = cookieHeader;
  }

  return normalized;
}
