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

    const cookieHeader =
      typeof normalizedHeaders.cookie === "string"
        ? normalizedHeaders.cookie
        : "";
    const token = cookieHeader
      ? getSessionTokenFromCookieHeader(cookieHeader)
      : null;

    if (!token) {
      res.status(401).json({
        error: "Session cookie not found",
        token: null,
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
