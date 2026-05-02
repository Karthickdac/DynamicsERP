import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { publicUser } from "../lib/auth";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

router.get("/users", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(usersTable).orderBy(usersTable.firstName);
  res.json(rows.map(publicUser));
});

export default router;
