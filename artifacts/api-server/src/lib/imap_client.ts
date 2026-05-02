import { ImapFlow, type ImapFlowOptions, type FetchMessageObject } from "imapflow";
import { simpleParser } from "mailparser";
import { eq } from "drizzle-orm";
import { db, emailSettingsTable, type EmailSettingsRow } from "@workspace/db";
import { logger } from "./logger";

const SINGLETON_ID = 1;

export type ResolvedImapConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
};

export type InboxMessageSummary = {
  uid: number;
  seq: number;
  subject: string | null;
  fromName: string | null;
  fromAddress: string | null;
  date: string | null;
  snippet: string | null;
  seen: boolean;
  flagged: boolean;
  hasAttachments: boolean;
};

export type InboxList = {
  mailbox: string;
  total: number;
  unseen: number;
  messages: InboxMessageSummary[];
};

export type InboxAttachment = {
  filename: string | null;
  contentType: string | null;
  size: number;
};

export type InboxMessageDetail = {
  uid: number;
  subject: string | null;
  fromName: string | null;
  fromAddress: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  date: string | null;
  text: string | null;
  html: string | null;
  attachments: InboxAttachment[];
};

async function loadSettings(): Promise<EmailSettingsRow | null> {
  const rows = await db
    .select()
    .from(emailSettingsTable)
    .where(eq(emailSettingsTable.id, SINGLETON_ID))
    .limit(1);
  return rows[0] ?? null;
}

export async function resolveImapConfig(): Promise<
  { ok: true; cfg: ResolvedImapConfig } | { ok: false; message: string }
> {
  const s = await loadSettings();
  if (!s) return { ok: false, message: "Email settings not configured." };
  const host = s.imapHost?.trim();
  if (!host) return { ok: false, message: "IMAP host is not configured." };
  // IMAP credentials fall back to SMTP credentials when not separately set,
  // since most hosts (Hostinger, Gmail, Office 365, Zoho) use the same mailbox
  // login for both.
  const user = (s.imapUser?.trim() || s.smtpUser?.trim() || "") as string;
  const pass = (s.imapPassword || s.smtpPassword || "") as string;
  if (!user || !pass) {
    return { ok: false, message: "IMAP username/password not configured (and no SMTP fallback available)." };
  }
  const secure = s.imapSecure ?? true;
  const port = s.imapPort ?? (secure ? 993 : 143);
  return { ok: true, cfg: { host, port, secure, user, pass } };
}

function buildClient(cfg: ResolvedImapConfig): ImapFlow {
  const options: ImapFlowOptions = {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    // Keep IMAP logs out of our pino output unless we explicitly debug.
    logger: false,
    // The Replit sandbox has no IPv6 routing; force IPv4 lookups.
    // ImapFlow forwards `socket.connect` options.
    // @ts-expect-error - `family` is a valid net.connect option but not in ImapFlowOptions types.
    family: 4,
  };
  return new ImapFlow(options);
}

async function withClient<T>(cfg: ResolvedImapConfig, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const client = buildClient(cfg);
  try {
    await client.connect();
    return await fn(client);
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore logout errors
    }
  }
}

export type ImapVerifyResult =
  | { ok: true; host: string; mailboxes: string[]; message: string }
  | { ok: false; host: string | null; message: string };

export async function verifyImap(): Promise<ImapVerifyResult> {
  const r = await resolveImapConfig();
  if (!r.ok) return { ok: false, host: null, message: r.message };
  try {
    const mailboxes = await withClient(r.cfg, async (client) => {
      const list = await client.list();
      return list.map((m) => m.path);
    });
    return {
      ok: true,
      host: r.cfg.host,
      mailboxes,
      message: `Connected to ${r.cfg.host}:${r.cfg.port} as ${r.cfg.user} (${mailboxes.length} mailboxes).`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err }, "[imap] verify failed");
    return { ok: false, host: r.cfg.host, message: `IMAP login failed: ${message}` };
  }
}

function decodeFromAddress(envelope: FetchMessageObject["envelope"]): {
  name: string | null;
  address: string | null;
} {
  const from = envelope?.from?.[0];
  if (!from) return { name: null, address: null };
  return { name: from.name || null, address: from.address || null };
}

export async function listInbox(opts: { mailbox?: string; limit?: number } = {}): Promise<InboxList> {
  const r = await resolveImapConfig();
  if (!r.ok) throw new Error(r.message);
  const mailbox = opts.mailbox?.trim() || "INBOX";
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);

  return withClient(r.cfg, async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const status = client.mailbox && typeof client.mailbox === "object" ? client.mailbox : null;
      const total = status?.exists ?? 0;
      if (total === 0) {
        return { mailbox, total: 0, unseen: 0, messages: [] };
      }
      const start = Math.max(1, total - limit + 1);
      const range = `${start}:${total}`;
      const messages: InboxMessageSummary[] = [];
      // Fetch envelope + flags + size + bodyStructure (for attachment hint).
      // `preview` (RFC 8970) is widely supported; we fall back to a snippet from
      // the text body when not available.
      for await (const msg of client.fetch(range, {
        envelope: true,
        flags: true,
        uid: true,
        bodyStructure: true,
        size: true,
      })) {
        const { name, address } = decodeFromAddress(msg.envelope);
        const flags = msg.flags ?? new Set<string>();
        const hasAttachments = detectAttachments(msg.bodyStructure);
        messages.push({
          uid: msg.uid,
          seq: msg.seq,
          subject: msg.envelope?.subject ?? null,
          fromName: name,
          fromAddress: address,
          date: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : null,
          snippet: null,
          seen: flags.has("\\Seen"),
          flagged: flags.has("\\Flagged"),
          hasAttachments,
        });
      }
      messages.sort((a, b) => b.uid - a.uid);

      let unseen = 0;
      try {
        const search = await client.search({ seen: false }, { uid: true });
        unseen = Array.isArray(search) ? search.length : 0;
      } catch {
        unseen = 0;
      }

      return { mailbox, total, unseen, messages };
    } finally {
      lock.release();
    }
  });
}

function detectAttachments(structure: FetchMessageObject["bodyStructure"]): boolean {
  if (!structure) return false;
  const stack: any[] = [structure];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (Array.isArray(node.childNodes)) {
      for (const child of node.childNodes) stack.push(child);
    }
    const disp = (node.disposition || "").toString().toLowerCase();
    if (disp === "attachment") return true;
    if (node.dispositionParameters && node.dispositionParameters.filename) return true;
    const parameters = node.parameters || {};
    if (parameters.name) return true;
  }
  return false;
}

export async function getInboxMessage(
  uid: number,
  opts: { mailbox?: string } = {},
): Promise<InboxMessageDetail | null> {
  const r = await resolveImapConfig();
  if (!r.ok) throw new Error(r.message);
  const mailbox = opts.mailbox?.trim() || "INBOX";

  return withClient(r.cfg, async (client) => {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const download = await client.download(String(uid), undefined, { uid: true });
      if (!download || !download.content) return null;
      const parsed = await simpleParser(download.content);

      const fromFirst = parsed.from?.value?.[0];
      const toAddresses = (Array.isArray(parsed.to) ? parsed.to : parsed.to ? [parsed.to] : [])
        .flatMap((a) => (a?.value ?? []).map((v) => v.address || ""))
        .filter(Boolean);
      const ccAddresses = (Array.isArray(parsed.cc) ? parsed.cc : parsed.cc ? [parsed.cc] : [])
        .flatMap((a) => (a?.value ?? []).map((v) => v.address || ""))
        .filter(Boolean);

      // Mark as read after fetching detail (typical mail client behaviour).
      try {
        await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      } catch {
        // non-fatal
      }

      return {
        uid,
        subject: parsed.subject ?? null,
        fromName: fromFirst?.name || null,
        fromAddress: fromFirst?.address || null,
        toAddresses,
        ccAddresses,
        date: parsed.date ? parsed.date.toISOString() : null,
        text: parsed.text ?? null,
        html: typeof parsed.html === "string" ? parsed.html : null,
        attachments: (parsed.attachments ?? []).map((a) => ({
          filename: a.filename ?? null,
          contentType: a.contentType ?? null,
          size: a.size ?? 0,
        })),
      };
    } finally {
      lock.release();
    }
  });
}
