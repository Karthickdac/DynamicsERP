import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger";
import { ensureCompanySettings } from "../routes/company_settings";

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

function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM,
  );
}

function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function getActiveProvider(): EmailProvider {
  if (isResendConfigured()) return "resend";
  if (isSmtpConfigured()) return "smtp";
  return "none";
}

export function isEmailDeliveryEnabled(): boolean {
  return getActiveProvider() !== "none";
}

let cachedTransporter: Transporter | null = null;
let cachedTransporterKey = "";

function getSmtpTransporter(): Transporter {
  const host = process.env.SMTP_HOST!;
  const portRaw = process.env.SMTP_PORT;
  const port = portRaw ? Number(portRaw) : 587;
  const secureRaw = process.env.SMTP_SECURE;
  const secure = secureRaw ? secureRaw === "true" || secureRaw === "1" : port === 465;
  const user = process.env.SMTP_USER!;
  const pass = process.env.SMTP_PASS!;
  const key = `${host}:${port}:${secure}:${user}`;
  if (cachedTransporter && cachedTransporterKey === key) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  cachedTransporterKey = key;
  return cachedTransporter;
}

async function buildFromHeader(provider: EmailProvider): Promise<string> {
  // Provider-specific overrides win, then fall back to the generic SMTP_FROM.
  const from =
    provider === "resend"
      ? process.env.RESEND_FROM ?? process.env.SMTP_FROM ?? ""
      : process.env.SMTP_FROM ?? process.env.RESEND_FROM ?? "";
  // If already in "Name <email>" form, return as-is.
  if (/<.+@.+>/.test(from)) return from;
  const explicitName =
    provider === "resend"
      ? process.env.RESEND_FROM_NAME ?? process.env.SMTP_FROM_NAME
      : process.env.SMTP_FROM_NAME ?? process.env.RESEND_FROM_NAME;
  let name = explicitName;
  if (!name) {
    try {
      const company = await ensureCompanySettings();
      name = company.name;
    } catch {
      name = undefined;
    }
  }
  if (name && from) return `"${name.replace(/"/g, "'")}" <${from}>`;
  return from;
}

function bodyToHtml(body: string): string {
  // Treat the template body as plain text — escape HTML and convert newlines.
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escaped}</div>`;
}

async function deliverViaSmtp(input: DeliverInput): Promise<DeliverResult> {
  try {
    const transporter = getSmtpTransporter();
    const from = await buildFromHeader("smtp");
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

async function deliverViaResend(input: DeliverInput): Promise<DeliverResult> {
  try {
    const apiKey = process.env.RESEND_API_KEY!;
    const from = await buildFromHeader("resend");
    if (!from) {
      return {
        status: "failed",
        provider: "resend",
        message: "Resend send failed: no From address configured (set RESEND_FROM or SMTP_FROM).",
      };
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
  const provider = getActiveProvider();
  if (provider === "resend") return deliverViaResend(input);
  if (provider === "smtp") return deliverViaSmtp(input);
  logger.info(
    { to: input.to, subject: input.subject },
    "[email:skipped] no provider configured",
  );
  return {
    status: "skipped",
    provider: "none",
    message:
      "Email delivery skipped — no email provider is configured. Configure SMTP credentials (SMTP_HOST/USER/PASS/FROM) or add a Resend integration to send real emails. The message has been recorded in the email log.",
  };
}

export async function verifyEmailTransport(): Promise<{
  provider: EmailProvider;
  ok: boolean;
  message: string;
}> {
  const provider = getActiveProvider();
  if (provider === "none") {
    return { provider, ok: false, message: "No email provider configured." };
  }
  if (provider === "smtp") {
    try {
      const t = getSmtpTransporter();
      await t.verify();
      return { provider, ok: true, message: "SMTP transport verified." };
    } catch (err) {
      return { provider, ok: false, message: `SMTP verify failed: ${(err as Error).message}` };
    }
  }
  // Resend has no cheap "verify" endpoint — just confirm the key is present.
  return { provider, ok: true, message: "Resend API key detected." };
}
