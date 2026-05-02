import { Router, type IRouter } from "express";
import { requireAuth, requireRole } from "../middlewares/authMiddleware";
import {
  getAllAssignments,
  replaceAssignments,
  getAccessibleModules,
} from "../lib/module_access_service";
import { MANAGED_ROLES, MODULE_REGISTRY } from "../lib/modules";

const router: IRouter = Router();

// Admin: read modules registry + all assignments for non-admin roles.
router.get(
  "/module-access",
  requireAuth,
  requireRole(["admin"]),
  async (_req, res): Promise<void> => {
    try {
      const assignments = await getAllAssignments();
      res.json({
        modules: MODULE_REGISTRY.map((m) => ({ key: m.key, label: m.label, group: m.group })),
        managedRoles: MANAGED_ROLES,
        assignments,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load module access.";
      res.status(500).json({ message });
    }
  },
);

// Admin: replace all assignments for managed (non-admin) roles.
router.put(
  "/module-access",
  requireAuth,
  requireRole(["admin"]),
  async (req, res): Promise<void> => {
    const body = req.body as { assignments?: Array<{ role?: unknown; moduleKey?: unknown }> };
    if (!body || !Array.isArray(body.assignments)) {
      res.status(400).json({ message: "Body must include an `assignments` array." });
      return;
    }
    const cleaned = body.assignments
      .filter(
        (a): a is { role: string; moduleKey: string } =>
          typeof a?.role === "string" && typeof a?.moduleKey === "string",
      )
      .map((a) => ({ role: a.role, moduleKey: a.moduleKey }));
    try {
      await replaceAssignments(cleaned);
      const assignments = await getAllAssignments();
      res.json({
        modules: MODULE_REGISTRY.map((m) => ({ key: m.key, label: m.label, group: m.group })),
        managedRoles: MANAGED_ROLES,
        assignments,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save module access.";
      res.status(500).json({ message });
    }
  },
);

// Any authenticated user: get the module keys they can access.
router.get("/me/modules", requireAuth, async (req, res): Promise<void> => {
  const role = req.user?.role ?? "";
  try {
    const moduleKeys = await getAccessibleModules(role);
    res.json({ role, moduleKeys });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load my modules.";
    res.status(500).json({ message });
  }
});

export default router;
