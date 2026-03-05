import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabase, getSupabaseConfig } from '../services/supabase';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS     = 600;
const SAVE_TIMEOUT_MS = 10_000;
const KEEPALIVE_MS    = 30_000;

export function useSyncStore<T>(
  baseKey: string,
  initialValue: T,
  ready: boolean = true,
  readOnly: boolean = false,
) {
  const supabase      = getSupabase();
  const { companyId } = getSupabaseConfig();
  const isCloud       = !!supabase;

  const sanitize = (s: string) => s.trim().replace(/\s+/g, '_');
  const effectiveKey  = companyId ? `${sanitize(companyId)}_${baseKey}` : baseKey;

  const getSaved = (): T => {
    try {
      const raw = localStorage.getItem(effectiveKey);
      if (raw) return JSON.parse(raw) as T;
    } catch {}
    return initialValue;
  };

  const [value,        setValue]        = useState<T>(getSaved);
  const [status,       setStatus]       = useState<SyncStatus>('idle');
  const [history,      setHistory]      = useState<T[]>([]);
  const [lastModified, setLastModified] = useState<number>(0);

  const isRemoteUpdate   = useRef(false);
  const pendingData      = useRef<T | null>(null);
  const debounceTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepaliveTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef       = useRef<any>(null);
  const lastFocusSync    = useRef<number>(0);
  const savingInProgress = useRef(false);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const clearDebounce = () => {
    if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null; }
  };
  const clearSafety = () => {
    if (safetyTimer.current) { clearTimeout(safetyTimer.current); safetyTimer.current = null; }
  };
  const finishSaving = (nextStatus: SyncStatus) => {
    clearSafety();
    savingInProgress.current = false;
    pendingData.current = null;
    setStatus(nextStatus);
    if (nextStatus === 'saved') {
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const makeTimeout = () => new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), SAVE_TIMEOUT_MS)
  );

  // ── saveToCloud ────────────────────────────────────────────────────────────
  const saveToCloud = useCallback(async (dataToSave: T): Promise<void> => {
    if (!supabase || readOnly) return;
    if (savingInProgress.current) return;
    savingInProgress.current = true;

    clearSafety();

    // Safety timer — libère le verrou après 12s quoi qu'il arrive
    safetyTimer.current = setTimeout(() => {
      console.warn('[SyncStore] safety timer — reset');
      savingInProgress.current = false;
      pendingData.current = null;
      setStatus('idle');
    }, SAVE_TIMEOUT_MS + 2000);

    setStatus('saving');

    try {
      // UPDATE d'abord (fonctionne admin + fournisseur)
      const { error: updateError } = await Promise.race([
        supabase.from('crewflo_sync').update({ data: dataToSave as any }).eq('key', effectiveKey),
        makeTimeout()
      ]) as any;

      if (updateError) {
        // Fallback upsert (admin — création première ligne)
        const { error: upsertError } = await Promise.race([
          supabase.from('crewflo_sync').upsert({ key: effectiveKey, data: dataToSave as any }),
          makeTimeout()
        ]) as any;

        if (upsertError) {
          const msg = (upsertError.message ?? '').toLowerCase();
          const isAuth = msg.includes('jwt') || msg.includes('token') ||
            upsertError.code === '42501' || (upsertError as any).status === 401;
          if (isAuth) {
            try { await supabase.auth.refreshSession(); } catch {}
          }
          console.warn('[SyncStore] save failed:', upsertError.message);
          finishSaving('error');
          return;
        }
      }

      finishSaving('saved');

    } catch (err: any) {
      console.warn('[SyncStore] save exception:', err?.message ?? err);
      finishSaving('error');
    }
  }, [effectiveKey, supabase, readOnly]);

  // ── persistData ────────────────────────────────────────────────────────────
  const persistData = useCallback((newData: T) => {
    try { localStorage.setItem(effectiveKey, JSON.stringify(newData)); } catch {}

    if (!isCloud || !supabase || readOnly) return;

    pendingData.current = newData;
    clearDebounce();

    debounceTimer.current = setTimeout(() => {
      if (pendingData.current !== null) {
        saveToCloud(pendingData.current);
      }
    }, DEBOUNCE_MS);
  }, [effectiveKey, isCloud, supabase, readOnly, saveToCloud]);

  // ── fetchFromCloud ─────────────────────────────────────────────────────────
  const fetchFromCloud = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('crewflo_sync')
        .select('data')
        .eq('key', effectiveKey)
        .single();

      if (data?.data) {
        isRemoteUpdate.current = true;
        setValue(data.data as T);
        localStorage.setItem(effectiveKey, JSON.stringify(data.data));
        isRemoteUpdate.current = false;
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
      } else if (error?.code === 'PGRST116' && !readOnly) {
        const local = getSaved();
        await supabase.from('crewflo_sync').upsert({ key: effectiveKey, data: local as any });
      }
    } catch (e) {
      console.warn('[SyncStore] fetchFromCloud error:', e);
    }
  }, [effectiveKey, supabase, readOnly]);

  // ── Chargement initial ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isCloud || !ready) return;
    fetchFromCloud();
  }, [effectiveKey, isCloud, ready]);

  // ── Canal Realtime ─────────────────────────────────────────────────────────
  const setupChannel = useCallback(() => {
    if (!supabase) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const ch = supabase
      .channel(`crewflo_${effectiveKey}_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crewflo_sync', filter: `key=eq.${effectiveKey}` },
        (payload: any) => {
          if (payload.new?.data) {
            isRemoteUpdate.current = true;
            setValue(payload.new.data as T);
            localStorage.setItem(effectiveKey, JSON.stringify(payload.new.data));
            isRemoteUpdate.current = false;
            setStatus('saved');
            setTimeout(() => setStatus('idle'), 2000);
          }
        }
      )
      .subscribe((s: string) => {
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          setTimeout(setupChannel, 3000);
        }
      });

    channelRef.current = ch;
  }, [effectiveKey, supabase]);

  useEffect(() => {
    if (!isCloud) return;
    setupChannel();
    return () => { if (supabase && channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [effectiveKey, isCloud]);

  // ── Keepalive — refresh session + ping toutes les 30s ─────────────────────
  useEffect(() => {
    if (!isCloud || !supabase) return;
    keepaliveTimer.current = setInterval(async () => {
      try {
        await supabase.auth.refreshSession();
        await supabase.from('crewflo_sync').select('key').eq('key', effectiveKey).limit(1);
      } catch {}
    }, KEEPALIVE_MS);
    return () => { if (keepaliveTimer.current) clearInterval(keepaliveTimer.current); };
  }, [effectiveKey, isCloud, supabase]);

  // ── Resync au retour (focus / visibilité / online) ─────────────────────────
  useEffect(() => {
    if (!isCloud) return;

    const syncOnResume = async () => {
      if (pendingData.current && !savingInProgress.current) {
        await saveToCloud(pendingData.current);
      } else if (!pendingData.current) {
        fetchFromCloud();
      }
      setupChannel();
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') syncOnResume();
    };

    const onFocus = () => {
      const now = Date.now();
      if (now - lastFocusSync.current < 30_000) return;
      lastFocusSync.current = now;
      syncOnResume();
    };

    const onOnline = () => {
      console.log('[SyncStore] retour en ligne → sync');
      syncOnResume();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [isCloud, fetchFromCloud, saveToCloud, setupChannel]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearDebounce();
      clearSafety();
    };
  }, []);

  // ── API publique ───────────────────────────────────────────────────────────
  const setAndSyncValue = useCallback((newValue: T | ((val: T) => T)) => {
    setValue(current => {
      const next = newValue instanceof Function ? newValue(current) : newValue;
      if (!isRemoteUpdate.current) {
        setHistory(prev => [...prev.slice(-19), current]);
        setLastModified(Date.now());
      }
      persistData(next);
      return next;
    });
  }, [persistData]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setValue(prev);
    persistData(prev);
    setLastModified(Date.now());
  }, [history, persistData]);

  return [value, setAndSyncValue, isCloud, status, undo, history.length > 0, lastModified] as const;
}
