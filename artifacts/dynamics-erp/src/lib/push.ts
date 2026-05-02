function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  const swUrl = `${import.meta.env.BASE_URL}sw.js`;
  try {
    const reg = await navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL });
    return reg;
  } catch (e) {
    console.warn("SW registration failed", e);
    return null;
  }
}

export type PushSubscriptionPayload = { endpoint: string; p256dh: string; auth: string; userAgent: string | null };

export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscriptionPayload | null> {
  if (!isPushSupported()) return null;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;
  const reg = await ensureServiceWorker();
  if (!reg) return null;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  const json = sub.toJSON() as { keys?: { p256dh?: string; auth?: string }; endpoint?: string };
  const p256dh = json.keys?.p256dh ?? arrayBufferToBase64(sub.getKey("p256dh"));
  const auth = json.keys?.auth ?? arrayBufferToBase64(sub.getKey("auth"));
  return {
    endpoint: sub.endpoint,
    p256dh,
    auth,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  };
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  if (!reg) return null;
  return await reg.pushManager.getSubscription();
}

export async function unsubscribeFromPush(): Promise<string | null> {
  const sub = await getCurrentSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}
