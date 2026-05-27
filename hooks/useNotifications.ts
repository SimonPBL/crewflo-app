import { useState, useEffect, useCallback, useRef } from 'react';
import { Notification } from '../types';
import { getSupabase } from '../services/supabase';
import { fetchNotifications, markRead, markAllRead, deleteNotification, rowToNotification } from '../services/notifications';

/**
 * Hook qui :
 *  - Charge les notifications du user connecté au démarrage
 *  - S'abonne au realtime Supabase pour ajouter les nouvelles en direct
 *  - Expose des actions : markRead, markAllRead, dismiss
 *
 * Si pas de session Supabase, retourne une liste vide.
 */
export function useNotifications(userId: string | null, enabled: boolean = true) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const isMounted = useRef(true);

  const supabase = getSupabase();

  // Fetch initial
  const refresh = useCallback(async () => {
    if (!enabled || !userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const list = await fetchNotifications(50);
    if (isMounted.current) {
      setNotifications(list);
      setLoading(false);
    }
  }, [userId, enabled]);

  useEffect(() => {
    isMounted.current = true;
    refresh();
    return () => { isMounted.current = false; };
  }, [refresh]);

  // Realtime subscription
  useEffect(() => {
    if (!supabase || !enabled || !userId) return;

    // Channel filtré sur user_id du user connecté
    const ch = supabase
      .channel(`notifications_${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload: any) => {
          if (!isMounted.current) return;
          const newNotif = rowToNotification(payload.new);
          setNotifications(prev => [newNotif, ...prev].slice(0, 50));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload: any) => {
          if (!isMounted.current) return;
          const updated = rowToNotification(payload.new);
          setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload: any) => {
          if (!isMounted.current) return;
          setNotifications(prev => prev.filter(n => n.id !== payload.old?.id));
        }
      )
      .subscribe();

    channelRef.current = ch;
    return () => {
      if (supabase && channelRef.current) {
        try { supabase.removeChannel(channelRef.current); } catch {}
        channelRef.current = null;
      }
    };
  }, [supabase, enabled, userId]);

  // Actions
  const handleMarkRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const nowIso = new Date().toISOString();
    // Optimiste : update local immédiatement
    setNotifications(prev => prev.map(n => ids.includes(n.id) && !n.readAt ? { ...n, readAt: nowIso } : n));
    await markRead(ids);
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    const nowIso = new Date().toISOString();
    setNotifications(prev => prev.map(n => n.readAt ? n : { ...n, readAt: nowIso }));
    await markAllRead();
  }, []);

  const handleDismiss = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await deleteNotification(id);
  }, []);

  const unreadCount = notifications.filter(n => !n.readAt).length;

  return {
    notifications,
    unreadCount,
    loading,
    refresh,
    markRead: handleMarkRead,
    markAllRead: handleMarkAllRead,
    dismiss: handleDismiss,
  };
}
