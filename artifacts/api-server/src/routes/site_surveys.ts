import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, siteSurveysTable, usersTable } from "@workspace/db";
import { CreateSiteSurveyBody, UpdateSiteSurveyBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

function dateOrNull(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  return new Date(v).toISOString().slice(0, 10);
}

const sSelect = {
  id: siteSurveysTable.id, projectId: siteSurveysTable.projectId,
  surveyDate: siteSurveysTable.surveyDate, surveyorId: siteSurveysTable.surveyorId,
  surveyorFirst: usersTable.firstName, surveyorLast: usersTable.lastName,
  roofType: siteSurveysTable.roofType, roofAreaSqft: siteSurveysTable.roofAreaSqft,
  shadowAnalysis: siteSurveysTable.shadowAnalysis, loadDetails: siteSurveysTable.loadDetails,
  existingMeterDetails: siteSurveysTable.existingMeterDetails,
  recommendedCapacityKwp: siteSurveysTable.recommendedCapacityKwp,
  notes: siteSurveysTable.notes, status: siteSurveysTable.status,
  createdAt: siteSurveysTable.createdAt, updatedAt: siteSurveysTable.updatedAt,
};

function surveyDto(s: { [K in keyof typeof sSelect]: unknown }) {
  const x = s as Record<string, any>;
  return {
    id: x.id, projectId: x.projectId, surveyDate: x.surveyDate,
    surveyorId: x.surveyorId,
    surveyorName: x.surveyorFirst ? `${x.surveyorFirst} ${x.surveyorLast ?? ""}`.trim() : null,
    roofType: x.roofType, roofAreaSqft: x.roofAreaSqft != null ? Number(x.roofAreaSqft) : null,
    shadowAnalysis: x.shadowAnalysis, loadDetails: x.loadDetails,
    existingMeterDetails: x.existingMeterDetails,
    recommendedCapacityKwp: x.recommendedCapacityKwp != null ? Number(x.recommendedCapacityKwp) : null,
    notes: x.notes, status: x.status,
    createdAt: x.createdAt.toISOString(), updatedAt: x.updatedAt.toISOString(),
  };
}

router.get("/projects/:id/surveys", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db.select(sSelect).from(siteSurveysTable)
    .leftJoin(usersTable, eq(usersTable.id, siteSurveysTable.surveyorId))
    .where(eq(siteSurveysTable.projectId, id))
    .orderBy(desc(siteSurveysTable.surveyDate));
  res.json(rows.map(surveyDto));
});

router.post("/projects/:id/surveys", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = CreateSiteSurveyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const [row] = await db.insert(siteSurveysTable).values({
    projectId: id,
    surveyDate: dateOrNull(d.surveyDate)!,
    surveyorId: d.surveyorId ?? null,
    roofType: d.roofType ?? null,
    roofAreaSqft: d.roofAreaSqft != null ? String(d.roofAreaSqft) : null,
    shadowAnalysis: d.shadowAnalysis ?? null,
    loadDetails: d.loadDetails ?? null,
    existingMeterDetails: d.existingMeterDetails ?? null,
    recommendedCapacityKwp: d.recommendedCapacityKwp != null ? String(d.recommendedCapacityKwp) : null,
    notes: d.notes ?? null,
  }).returning();
  const [withU] = await db.select(sSelect).from(siteSurveysTable)
    .leftJoin(usersTable, eq(usersTable.id, siteSurveysTable.surveyorId))
    .where(eq(siteSurveysTable.id, row.id));
  res.status(201).json(surveyDto(withU));
});

router.patch("/surveys/:surveyId", requireAuth, async (req, res): Promise<void> => {
  const surveyId = parseId(req.params.surveyId);
  if (surveyId == null) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateSiteSurveyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const update: Record<string, unknown> = { updatedAt: sql`now()` };
  if (d.surveyDate !== undefined) update.surveyDate = dateOrNull(d.surveyDate);
  if (d.surveyorId !== undefined) update.surveyorId = d.surveyorId ?? null;
  if (d.roofType !== undefined) update.roofType = d.roofType ?? null;
  if (d.roofAreaSqft !== undefined) update.roofAreaSqft = d.roofAreaSqft != null ? String(d.roofAreaSqft) : null;
  if (d.shadowAnalysis !== undefined) update.shadowAnalysis = d.shadowAnalysis ?? null;
  if (d.loadDetails !== undefined) update.loadDetails = d.loadDetails ?? null;
  if (d.existingMeterDetails !== undefined) update.existingMeterDetails = d.existingMeterDetails ?? null;
  if (d.recommendedCapacityKwp !== undefined) update.recommendedCapacityKwp = d.recommendedCapacityKwp != null ? String(d.recommendedCapacityKwp) : null;
  if (d.notes !== undefined) update.notes = d.notes ?? null;
  if (d.status !== undefined) update.status = d.status;
  await db.update(siteSurveysTable).set(update).where(eq(siteSurveysTable.id, surveyId));
  const [withU] = await db.select(sSelect).from(siteSurveysTable)
    .leftJoin(usersTable, eq(usersTable.id, siteSurveysTable.surveyorId))
    .where(eq(siteSurveysTable.id, surveyId));
  res.json(surveyDto(withU));
});

export default router;
