// Browser-only helpers for Firebase web push. Call from event handlers / effects.
import { registerPushDevice } from "@/lib/push.functions";

export type PushResult =
  | { status: "registered"; token: string }
  | { status: "not-configured" | "unsupported" | "open-in-new-tab" | "denied" | "ios-install" };

function config() {
  const appId = import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID"] as string | undefined;
  return {
    apiKey: import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY"] as string | undefined,
    projectId: import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID"] as string | undefined,
    appId,
    messagingSenderId: appId?.split(":")[1] ?? "",
    vapidKey: import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY"] as string | undefined,
  };
}

export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iPhone / iPad" : /Mac/i.test(ua) ? "Mac" : /Windows/i.test(ua) ? "Windows" : "Ordinateur";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navigateur";
  return `${os} · ${br}`;
}

function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}
function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

async function getTokenSilently(): Promise<string | null> {
  const c = config();
  if (!c.apiKey || !c.projectId || !c.appId || !c.vapidKey || !c.messagingSenderId) return null;
  const { initializeApp, getApps } = await import("firebase/app");
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) return null;
  const fb = { apiKey: c.apiKey, projectId: c.projectId, appId: c.appId, messagingSenderId: c.messagingSenderId };
  const reg = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${new URLSearchParams(fb).toString()}`);
  const app = getApps()[0] ?? initializeApp(fb);
  return (await getToken(getMessaging(app), { vapidKey: c.vapidKey, serviceWorkerRegistration: reg })) || null;
}

/** Must be called from a click: asks permission and registers this device. */
export async function enablePush(): Promise<PushResult> {
  const c = config();
  if (!c.apiKey || !c.appId || !c.vapidKey) return { status: "not-configured" };
  if (isIos() && !isStandalone()) return { status: "ios-install" };
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return { status: "unsupported" };
  if (window.top !== window.self) return { status: "open-in-new-tab" };
  const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (perm !== "granted") return { status: "denied" };
  const token = await getTokenSilently();
  if (!token) return { status: "unsupported" };
  await registerPushDevice({ data: { token, label: deviceLabel(), platform: isIos() ? "ios" : /Android/i.test(navigator.userAgent) ? "android" : "desktop" } });
  localStorage.setItem("towia-push-token", token);
  return { status: "registered", token };
}

/** On app start: refresh this device's token if permission was already granted (handles token rotation). */
export async function refreshPushIfGranted() {
  try {
    if (typeof window === "undefined" || window.top !== window.self) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const token = await getTokenSilently();
    if (!token) return;
    await registerPushDevice({ data: { token, label: deviceLabel(), platform: isIos() ? "ios" : /Android/i.test(navigator.userAgent) ? "android" : "desktop" } });
    localStorage.setItem("towia-push-token", token);
  } catch {
    /* silent */
  }
}

export function currentDeviceToken(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem("towia-push-token");
}
