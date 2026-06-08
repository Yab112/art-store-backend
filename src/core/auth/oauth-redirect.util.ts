const SESSION_COOKIE_NAMES = [
  "__Secure-better-auth.session_token",
  "better-auth.session_token",
] as const;

export function extractSignedSessionTokenFromSetCookie(
  setCookieHeader: string,
): string | null {
  const segments = setCookieHeader.split(/,(?=\s*(?:__Secure-)?better-auth\.session_token=)/);

  for (const segment of segments) {
    for (const cookieName of SESSION_COOKIE_NAMES) {
      const prefix = `${cookieName}=`;
      if (!segment.trim().startsWith(prefix)) {
        continue;
      }

      const rawValue = segment.trim().slice(prefix.length).split(";")[0]?.trim();
      if (!rawValue || rawValue === "") {
        continue;
      }

      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue;
      }
    }
  }

  return null;
}

export function appendTokenToOAuthRedirect(
  location: string,
  token: string,
): string {
  const handoffUrl = new URL(location);

  if (handoffUrl.pathname.endsWith("/oauth-handoff")) {
    const redirectParam = handoffUrl.searchParams.get("redirect");
    if (redirectParam) {
      const finalUrl = new URL(redirectParam);
      finalUrl.searchParams.set("token", token);
      return finalUrl.toString();
    }
  }

  handoffUrl.searchParams.set("token", token);
  return handoffUrl.toString();
}
