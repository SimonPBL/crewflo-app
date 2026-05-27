// Gestion des Web Push notifications côté client
// - subscribe()      : demande permission + crée subscription + l'envoie à Supabase
// - unsubscribe()    : retire la subscription locale + Supabase
// - getStatus()      : retourne l'état actuel (autorisé, refusé, pas encore demandé, etc.)

import { getSupabase } from './supabase';

// Clé publique VAPID — même valeur que celle dans l'Edge Function send-daily-digest
// Pas un secret : sert au browser pour identifier le serveur d'origine
const VAPID_PUBLIC_KEY = 'BPwd--VuK0eNLzBwJEOurYUEy_pQcmFzoqBATlh4UibknuDU-X43CJb8sm8zVHRizn2EO9mkmSUFwVQMRTMhIeg';

export type PushStatus =
  | 'unsupported'    // le navigateur ne supporte pas Web Push
  | 'denied'         // l'user a refusé la permission
  | 'not-asked'      // la permission n'a jamais été demandée
  | 'subscribed'     // tout est en place, push actifs
  | 'permission-ok'; // permission accordée mais pas encore inscrit côté serveur

// Helper : convertir clé base64URL en Uint8Array (format attendu par PushManager.subscribe)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Vérifier si Web Push est supporté
export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

// Récupérer l'état actuel
export async function getStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported';

  const perm = Notification.permission;
  if (perm === 'denied') return 'denied';
  if (perm === 'default') return 'not-asked';

  // permission === 'granted' — vérifier si on a une subscription active
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return 'subscribed';
    return 'permission-ok';
  } catch {
    return 'permission-ok';
  }
}

// Sauvegarder une subscription dans Supabase
async function saveSubscription(sub: PushSubscription): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return false;

  const json = sub.toJSON() as any;
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!endpoint || !p256dh || !auth) return false;

  // Upsert : un user peut avoir le même endpoint qu'avant (re-subscribe)
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent.slice(0, 200),
      last_used_at: new Date().toISOString(),
    }, { onConflict: 'user_id,endpoint' });

  if (error) {
    console.warn('[push] saveSubscription error:', error.message);
    return false;
  }
  return true;
}

// Supprimer une subscription dans Supabase
async function removeSubscription(endpoint: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  } catch (e) {
    console.warn('[push] removeSubscription error:', e);
  }
}

/**
 * Activer les push pour ce device :
 *   1. Demande la permission au navigateur
 *   2. Crée une subscription via PushManager
 *   3. Envoie la subscription à Supabase
 *
 * Retourne true si succès complet, false sinon.
 */
export async function subscribe(): Promise<boolean> {
  if (!isPushSupported()) return false;

  // 1. Demander la permission
  let perm = Notification.permission;
  if (perm === 'default') {
    perm = await Notification.requestPermission();
  }
  if (perm !== 'granted') return false;

  // 2. Obtenir le service worker enregistré
  const reg = await navigator.serviceWorker.ready;
  if (!reg) return false;

  // 3. Créer/récupérer la subscription
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    } catch (err: any) {
      console.warn('[push] subscribe failed:', err?.message);
      return false;
    }
  }

  // 4. Envoyer à Supabase
  return await saveSubscription(sub);
}

/**
 * Désactiver les push pour ce device :
 *   1. Récupère la subscription locale
 *   2. La supprime côté navigateur
 *   3. La supprime côté Supabase
 */
export async function unsubscribe(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true; // déjà désinscrit
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await removeSubscription(endpoint);
    return true;
  } catch (err: any) {
    console.warn('[push] unsubscribe failed:', err?.message);
    return false;
  }
}
