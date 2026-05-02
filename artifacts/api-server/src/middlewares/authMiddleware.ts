import type { Request, Response, NextFunction } from "express";
import { SESSION_COOKIE, getUserBySessionToken } from "../lib/auth";
import type { UserRow } from "@workspace/db";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRow;
      sessionToken?: string;
    }
  }
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
  if (token) {
    try {
      const user = await getUserBySessionToken(token);
      if (user) {
        req.user = user;
        req.sessionToken = token;
      }
    } catch (err) {
      req.log?.warn({ err }, "auth lookup failed");
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
