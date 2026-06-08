import type { Request, Response } from "express";
import { auth } from "../../auth";
import {
  getSessionTokenFromCookieHeader,
  normalizeAuthRequestHeaders,
} from "./auth-request.util";

export async function handleGetBearerToken(req: Request, res: Response) {
  try {
    const normalizedHeaders = normalizeAuthRequestHeaders(
      req.headers as Record<string, string | string[] | undefined>,
    );

    const session = await auth.api.getSession({
      headers: normalizedHeaders as any,
    });

    if (!session?.user) {
      res.status(401).json({
        error: "No active session",
        token: null,
      });
      return;
    }

    const authHeader =
      normalizedHeaders.authorization ?? normalizedHeaders.Authorization;
    const authValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    const bearerToken = authValue?.startsWith("Bearer ")
      ? authValue.slice("Bearer ".length).trim()
      : null;

    const cookieHeader =
      typeof normalizedHeaders.cookie === "string"
        ? normalizedHeaders.cookie
        : "";
    const cookieToken = cookieHeader
      ? getSessionTokenFromCookieHeader(cookieHeader)
      : null;
    const token = cookieToken ?? bearerToken ?? null;

    if (!token) {
      res.status(401).json({
        error: "Session cookie not found",
        token: null,
        hint: "For Google OAuth across domains, use /api/auth/oauth-handoff as callbackURL",
      });
      return;
    }

    res.json({
      token,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
    });
  } catch (error) {
    console.error("[get-bearer-token] Failed:", error);
    res.status(500).json({
      error: "Failed to get bearer token",
      token: null,
    });
  }
}
