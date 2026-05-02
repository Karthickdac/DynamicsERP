import { pgTable, serial, integer, varchar, text, numeric, timestamp, date } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const siteSurveysTable = pgTable("site_surveys", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  surveyDate: date("survey_date").notNull(),
  surveyorId: integer("surveyor_id").references(() => usersTable.id, { onDelete: "set null" }),
  roofType: varchar("roof_type", { length: 64 }),
  roofAreaSqft: numeric("roof_area_sqft", { precision: 10, scale: 2 }),
  shadowAnalysis: text("shadow_analysis"),
  loadDetails: text("load_details"),
  existingMeterDetails: text("existing_meter_details"),
  recommendedCapacityKwp: numeric("recommended_capacity_kwp", { precision: 10, scale: 2 }),
  notes: text("notes"),
  status: varchar("status", { length: 32 }).notNull().default("submitted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SiteSurveyRow = typeof siteSurveysTable.$inferSelect;
