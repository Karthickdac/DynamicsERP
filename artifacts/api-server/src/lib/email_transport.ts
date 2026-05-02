import { createHash } from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { ensureCompanySettings } from "../routes/company_settings";
import { db, emailSettingsTable, type EmailSettingsRow } from "@workspace/db";

const SINGLETON_ID = 1;

export type EmailProvider = "smtp" | "resend" | "none";

export type DeliverInput = {
  to: string[];
  cc?: string[] | null;
  subject: string;
  body: string;
};

export type DeliverResult =
  | { status: "sent"; provider: Exclude<EmailProvider, "none">; message: string }
  | { status: "skipped"; provider: "none"; message: string }
  | { status: "failed"; provider: EmailProvider; message: string };

type ResolvedConfig = {
  provider: EmailProvider;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
    fromName?: string | null;
  };
  resend?: {
    apiKey: string;
    from: string;
    fromName?: string | null;
  };
};

let cachedSettings: EmailSettingsRow | null = null;
let cachedSettingsAt = 0;
const SETTINGS_TTL_MS = 30_000;

export function invalidateEmailSettingsCache(): void {
  cachedSettings = null;
  cachedSettingsAt = 0;
  if (cachedTransporter) {
    try {
      cachedTransporter.close();
    } catch {
      // ignore close errors
    }
  }
  cachedTransporter = null;
  cachedTransporterKey = "";
}

async function loadSettings(): Promise<EmailSettingsRow | null> {
  const now = Date.now();
  if (cachedSettings && now - cachedSettingsAt < SETTINGS_TTL_MS) return cachedSettings;
  try {
    // Read the singleton row directly by id=1 (created lazily by the routes layer)
    // so we never accidentally load a stale duplicate row.
    const rows = await db
      .select()
      .from(emailSettingsTable)
      .where(eq(emailSettingsTable.id, SINGLETON_ID))
      .limit(1);
    cachedSettings = rows[0] ?? null;
    cachedSettingsAt = now;
    return cachedSettings;
  } catch (err) {
    logger.warn({ err }, "[email] failed to load email_settings; falling back to env vars");
    return null;
  }
}

async function resolveConfig(): Promise<ResolvedConfig> {
  const settings = await loadSettings();

  // 1. Honour DB-stored settings if provider is explicitly chosen and complete.
  if (settings && settings.provider === "smtp") {
    if (settings.smtpHost && settings.smtpUser && settings.smtpPassword && settings.smtpFrom) {
      return {
        provider: "smtp",
        smtp: {
          host: settings.smtpHost,
          port: settings.smtpPort ?? 587,
          secure: Boolean(settings.smtpSecure),
          user: settings.smtpUser,
          pass: settings.smtpPassword,
          from: settings.smtpFrom,
          fromName: settings.smtpFromName,
        },
      };
    }
  }
  if (settings && settings.provider === "resend") {
    if (settings.resendApiKey && (settings.resendFrom || settings.smtpFrom)) {
      return {
        provider: "resend",
        resend: {
          apiKey: settings.resendApiKey,
          from: settings.resendFrom ?? settings.smtpFrom ?? "",
          fromName: settings.resendFromName,
        },
      };
    }
  }

  // 2. Fall back to environment variables (legacy behaviour).
  if (process.env.RESEND_API_KEY) {
    return {
      provider: "resend",
      resend: {
        apiKey: process.env.RESEND_API_KEY,
        from: process.env.RESEND_FROM ?? process.env.SMTP_FROM ?? "",
        fromName: process.env.RESEND_FROM_NAME ?? process.env.SMTP_FROM_NAME ?? null,
      },
    };
  }
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_FROM
  ) {
    const portRaw = process.env.SMTP_PORT;
    const port = portRaw ? Number(portRaw) : 587;
    const secureRaw = process.env.SMTP_SECURE;
    const secure = secureRaw ? secureRaw === "true" || secureRaw === "1" : port === 465;
    return {
      provider: "smtp",
      smtp: {
        host: process.env.SMTP_HOST,
        port,
        secure,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.SMTP_FROM,
        fromName: process.env.SMTP_FROM_NAME ?? null,
      },
    };
  }

  return { provider: "none" };
}

export async function getActiveProvider(): Promise<EmailProvider> {
  return (await resolveConfig()).provider;
}

export async function isEmailDeliveryEnabled(): Promise<boolean> {
  return (await getActiveProvider()) !== "none";
}

let cachedTransporter: Transporter | null = null;
let cachedTransporterKey = "";

function getSmtpTransporter(cfg: NonNullable<ResolvedConfig["smtp"]>): Transporter {
  const passFingerprint = createHash("sha256").update(cfg.pass).digest("hex");
  const key = `${cfg.host}:${cfg.port}:${cfg.secure}:${cfg.user}:${passFingerprint}`;
  if (cachedTransporter && cachedTransporterKey === key) return cachedTransporter;
  if (cachedTransporter) {
    try {
      cachedTransporter.close();
    } catch {
      // ignore close errors
    }
  }
  cachedTransporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    // Force IPv4 lookups: this Replit sandbox has no IPv6 routing, and Node's
    // default dual-stack lookup can pick a v6 address first and fail with
    // "getaddrinfo ENOTFOUND" / "ENETUNREACH" before retrying v4.
    // `family` is forwarded to net.connect by nodemailer, but isn't in the
    // strict SMTPTransport.Options type, so cast to bypass the type check.
    ...({ family: 4 } as Record<string, unknown>),
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  cachedTransporterKey = key;
  return cachedTransporter;
}

async function buildFromHeader(
  from: string,
  explicitName: string | null | undefined,
): Promise<string> {
  if (!from) return from;
  if (/<.+@.+>/.test(from)) return from;
  let name = explicitName ?? null;
  if (!name) {
    try {
      const company = await ensureCompanySettings();
      name = company.name;
    } catch {
      name = null;
    }
  }
  if (name) return `"${name.replace(/"/g, "'")}" <${from}>`;
  return from;
}

function bodyToHtml(body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escaped}</div>`;
}

async function deliverViaSmtp(
  cfg: NonNullable<ResolvedConfig["smtp"]>,
  input: DeliverInput,
): Promise<DeliverResult> {
  try {
    const transporter = getSmtpTransporter(cfg);
    const from = await buildFromHeader(cfg.from, cfg.fromName ?? null);
    const info = await transporter.sendMail({
      from,
      to: input.to,
      cc: input.cc && input.cc.length ? input.cc : undefined,
      subject: input.subject,
      text: input.body,
      html: bodyToHtml(input.body),
    });
    const accepted = Array.isArray(info.accepted) ? info.accepted.length : 0;
    const rejected = Array.isArray(info.rejected) ? info.rejected.length : 0;
    if (rejected > 0 && accepted === 0) {
      return {
        status: "failed",
        provider: "smtp",
        message: `SMTP server rejected all recipients: ${(info.rejected as unknown[]).join(", ")}`,
      };
    }
    logger.info(
      { to: input.to, subject: input.subject, messageId: info.messageId, accepted, rejected },
      "[email:smtp:sent]",
    );
    return {
      status: "sent",
      provider: "smtp",
      message: `Email sent to ${input.to.join(", ")} via SMTP (${info.messageId ?? "no-id"}).`,
    };
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    logger.error({ err, to: input.to, subject: input.subject }, "[email:smtp:failed]");
    return { status: "failed", provider: "smtp", message: `SMTP send failed: ${message}` };
  }
}

async function deliverViaResend(
  cfg: NonNullable<ResolvedConfig["resend"]>,
  input: DeliverInput,
): Promise<DeliverResult> {
  try {
    const from = await buildFromHeader(cfg.from, cfg.fromName ?? null);
    if (!from) {
      return {
        status: "failed",
        provider: "resend",
        message: "Resend send failed: no From address configured.",
      };
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        cc: input.cc && input.cc.length ? input.cc : undefined,
        subject: input.subject,
        text: input.body,
        html: bodyToHtml(input.body),
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      let detail = errText;
      try {
        const j = JSON.parse(errText);
        detail = j?.message ?? j?.error ?? errText;
      } catch {
        // not JSON — keep raw text
      }
      logger.error(
        { status: res.status, body: errText, to: input.to, subject: input.subject },
        "[email:resend:failed]",
      );
      return {
        status: "failed",
        provider: "resend",
        message: `Resend rejected the email (HTTP ${res.status}): ${detail || "no detail"}`,
      };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    logger.info(
      { to: input.to, subject: input.subject, id: data.id },
      "[email:resend:sent]",
    );
    return {
      status: "sent",
      provider: "resend",
      message: `Email sent to ${input.to.join(", ")} via Resend (${data.id ?? "no-id"}).`,
    };
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    logger.error({ err, to: input.to, subject: input.subject }, "[email:resend:failed]");
    return { status: "failed", provider: "resend", message: `Resend send failed: ${message}` };
  }
}

export async function deliverEmail(input: DeliverInput): Promise<DeliverResult> {
  if (!input.to.length) {
    return { status: "failed", provider: "none", message: "No recipients provided." };
  }
  const cfg = await resolveConfig();
  if (cfg.provider === "resend" && cfg.resend) return deliverViaResend(cfg.resend, input);
  if (cfg.provider === "smtp" && cfg.smtp) return deliverViaSmtp(cfg.smtp, input);
  logger.info(
    { to: input.to, subject: input.subject },
    "[email:skipped] no provider configured",
  );
  return {
    status: "skipped",
    provider: "none",
    message:
      "Email delivery skipped — no email provider is configured. Open Admin → Email Settings to set up SMTP or Resend. The message has been recorded in the email log.",
  };
}

export async function verifyEmailTransport(): Promise<{
  provider: EmailProvider;
  ok: boolean;
  message: string;
}> {
  const cfg = await resolveConfig();
  if (cfg.provider === "none") {
    return { provider: "none", ok: false, message: "No email provider configured." };
  }
  if (cfg.provider === "smtp" && cfg.smtp) {
    try {
      const t = getSmtpTransporter(cfg.smtp);
      await t.verify();
      return { provider: "smtp", ok: true, message: "SMTP transport verified." };
    } catch (err) {
      return { provider: "smtp", ok: false, message: `SMTP verify failed: ${(err as Error).message}` };
    }
  }
  return { provider: "resend", ok: true, message: "Resend API key detected." };
}
