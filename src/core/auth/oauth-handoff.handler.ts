import type { Request, Response } from "express";
import { auth } from "../../auth";
import {
  getSessionTokenFromCookieHeader,
  normalizeAuthRequestHeaders,
} from "./auth-request.util";

const normalizeRedirectTarget = (value: string | undefined): string | null => {
  if (!value?.trim()) {
    return null;
  }

  const redirect = value.trim();
  const allowedOrigins = new Set(
    [
      process.env.FRONTEND_URL,
      process.env.ADMIN_FRONTEND_URL,
      "http://localhost:5173",
      "http://localhost:5174",
      "https://www.arthopia.com.et",
      "https://arthopia.com.et",
      "https://mainadmin.arthopia.com.et",
      "https://art-store-frontend-flame.vercel.app",
    ]
      .filter(Boolean)
      .map((origin) => origin!.replace(/\/+$/, "")),
  );

  try {
    const parsed = new URL(redirect);
    const origin = `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, "");

    if (!allowedOrigins.has(origin)) {
      return null;
    }

    return redirect;
  } catch {
    return null;
  }
};

export async function handleOAuthHandoff(req: Request, res: Response) {
  try {
    const normalizedHeaders = normalizeAuthRequestHeaders(
      req.headers as Record<string, string | string[] | undefined>,
    );

    const session = await auth.api.getSession({
      headers: normalizedHeaders as any,
    });

    const fallbackRedirect =
      normalizeRedirectTarget(process.env.FRONTEND_URL) ?? "/";
    const redirectParam = Array.isArray(req.query.redirect)
      ? req.query.redirect[0]
      : req.query.redirect;
    const redirectTarget =
      normalizeRedirectTarget(
        typeof redirectParam === "string" ? redirectParam : undefined,
      ) ?? fallbackRedirect;

    if (!session?.user) {
      const errorUrl = new URL(redirectTarget);
      errorUrl.searchParams.set("auth_error", "no_session");
      console.warn(
        "[oauth-handoff] No session cookie on handoff request — cross-origin OAuth needs this endpoint as callbackURL",
      );
      res.redirect(errorUrl.toString());
      return;
    }

    const cookieHeader =
      typeof normalizedHeaders.cookie === "string"
        ? normalizedHeaders.cookie
        : "";
    const token = cookieHeader
      ? getSessionTokenFromCookieHeader(cookieHeader)
      : null;

    if (!token) {
      const errorUrl = new URL(redirectTarget);
      errorUrl.searchParams.set("auth_error", "missing_token");
      res.redirect(errorUrl.toString());
      return;
    }

    const handoffUrl = new URL(redirectTarget);
    handoffUrl.searchParams.set("token", token);

    console.log(
      `[oauth-handoff] Redirecting ${session.user.email} to ${handoffUrl.origin} with bearer token`,
    );

    res.redirect(handoffUrl.toString());
  } catch (error) {
    console.error("[oauth-handoff] Failed:", error);
    res.status(500).json({
      error: "OAuth handoff failed",
    });
  }
}
