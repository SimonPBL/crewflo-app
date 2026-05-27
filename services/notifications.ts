import { getSupabase } from './supabase';
import type { AppNotification, NotificationEventType } from '../types';

// Event qu'on envoie à la RPC create_notifications côté Supabase
export interface NotificationEvent {
  eventType: NotificationEventType;
  targetType?: string;
  targetId?: string;
  title: string;                  // pour les admins
  description: string;            // pour les admins
  supplierTitle?: string;         // version pour le supplier (sinon utilise title)
  supplierDescription?: string;   // version pour le supplier (sinon utilise description)
  supplierUserId?: string;        // supabase auth.users.id du supplier concerné
  oldSupplierUserId?: string;     // (reassignment) ancien supplier
  oldSupplierTitle?: string;
  oldSupplierDescription?: string;
  metadata?: Record<string, any>;
}

// Mapper un row Supabase vers le type Notification frontend
const rowToNotification = (row: any): AppNotification => ({
  id: row.id,
  userId: row.user_id,
  actorId: row.actor_id ?? undefined,
  actorName: row.actor_name ?? undefined,
  companyId: row.company_id,
  eventType: row.event_type,
  targetType: row.target_type ?? 'task',
  targetId: row.target_id ?? undefined,
  title: row.title,
  description: row.description,
  metadata: row.metadata ?? {},
  readAt: row.read_at ?? undefined,
  createdAt: row.created_at,
});

// Envoie un batch d'événements pour créer les notifications correspondantes
export async function createNotifications(events: NotificationEvent[]): Promise<number> {
  if (events.length === 0) return 0;
  const supabase = getSupabase();
  if (!supabase) return 0;

  try {
    const { data, error } = await supabase.rpc('create_notifications', { events });
    if (error) {
      console.warn('[notifications] createNotifications RPC error:', error.message);
      return 0;
    }
    return (data as number) ?? 0;
  } catch (err: any) {
    console.warn('[notifications] createNotifications exception:', err?.message);
    return 0;
  }
}

// Récupère les notifications du user connecté (les N plus récentes)
export async function fetchNotifications(limit = 50): Promise<AppNotification[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[notifications] fetch error:', error.message);
      return [];
    }
    return (data ?? []).map(rowToNotification);
  } catch (err: any) {
    console.warn('[notifications] fetch exception:', err?.message);
    return [];
  }
}

// Marquer des notifications comme lues (par leurs IDs)
export async function markRead(notifIds: string[]): Promise<number> {
  if (notifIds.length === 0) return 0;
  const supabase = getSupabase();
  if (!supabase) return 0;

  try {
    const { data, error } = await supabase.rpc('mark_notifications_read', { notif_ids: notifIds });
    if (error) return 0;
    return (data as number) ?? 0;
  } catch { return 0; }
}

// Marquer toutes comme lues
export async function markAllRead(): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;
  try {
    const { data, error } = await supabase.rpc('mark_all_notifications_read');
    if (error) return 0;
    return (data as number) ?? 0;
  } catch { return 0; }
}

// Supprimer une notification (du user connecté seulement, RLS l'applique)
export async function deleteNotification(notifId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('notifications').delete().eq('id', notifId);
    return !error;
  } catch { return false; }
}

export { rowToNotification };
