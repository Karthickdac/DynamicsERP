import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  LoginBody,
  RegisterBody,
} from "@workspace/api-zod";
import {
  SESSION_COOKIE,
  createSession,
  deleteSession,
  hashPassword,
  publicUser,
  verifyPassword,
} from "../lib/auth";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

const isProd = process.env.NODE_ENV === "production";
const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProd,
  path: "/",
};

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password, firstName, lastName } = parsed.data;
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }
  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(usersTable)
    .values({ email, passwordHash, firstName, lastName, role: "sales" })
    .returning();
  const { token, expiresAt } = await createSession(user.id);
  res.cookie(SESSION_COOKIE, token, { ...cookieOpts, expires: expiresAt });
  res.status(201).json({ user: publicUser(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const { token, expiresAt } = await createSession(user.id);
  res.cookie(SESSION_COOKIE, token, { ...cookieOpts, expires: expiresAt });
  res.status(200).json({ user: publicUser(user) });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  if (req.sessionToken) await deleteSession(req.sessionToken);
  res.clearCookie(SESSION_COOKIE, cookieOpts);
  res.status(204).end();
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  res.json(publicUser(req.user!));
});

export default router;
