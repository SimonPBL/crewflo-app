import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabase, getSupabaseConfig } from '../services/supabase';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS     = 600;
const RESUME_THROTTLE = 30_000;

export function useSyncStore<T>(
  baseKey: string,
  initialValue: T,
  ready: boolean = true,
  readOnly: boolean = false,
) {
  const supabase      = getSupabase();
  const { companyId } = getSupabaseConfig();
  const isCloud       = !!supabase;

  const sanitize     = (s: string) => s.trim().replace(/\s+/g, '_');
  const effectiveKey = companyId ? `${sanitize(companyId)}_${baseKey}` : baseKey;

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
  const retryTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef       = useRef<any>(null);
  const isMounted        = useRef(true);
  // Initialiser à Date.now() pour que le premier focus après mount soit throttlé
  // (on fetchFromCloud déjà au mount — pas besoin d'un sync immédiat au premier focus)
  const lastResumeSync   = useRef<number>(Date.now());

  // ── Helpers ────────────────────────────────────────────────────────────────
  const clearDebounce = () => {
    if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null; }
  };
  const clearRetry = () => {
    if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
  };

  const safeSetStatus = (s: SyncStatus) => {
    if (isMounted.current) setStatus(s);
  };

  // ── saveToCloud — sans verrou bloquant ────────────────────────────────────
  // On utilise AbortController au lieu d'un verrou ref.
  // Chaque save annule le précédent si encore en cours — pas de blocage permanent.
  const abortControllerRef = useRef<AbortController | null>(null);

  const saveToCloud = useCallback(async (dataToSave: T): Promise<void> => {
    if (!supabase || readOnly) return;

    // Annuler le save précédent s'il traine encore
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    clearRetry();
    safeSetStatus('saving');

    try {
      // UPDATE avec timeout 15s
      const { error: updateError } = await Promise.race([
        supabase.from('crewflo_sync').update({ data: dataToSave as any }).eq('key', effectiveKey),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15_000)),
      ]) as any;

      if (ac.signal.aborted) return; // un save plus récent a pris le relais

      if (updateError) {
        const { error: upsertError } = await Promise.race([
          supabase.from('crewflo_sync').upsert({ key: effectiveKey, data: dataToSave as any }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15_000)),
        ]) as any;

        if (ac.signal.aborted) return;

        if (upsertError) {
          console.warn('[SyncStore] save failed:', upsertError.message);
          safeSetStatus('error');
          retryTimer.current = setTimeout(() => { if (isMounted.current) safeSetStatus('idle'); }, 5_000);
          return;
        }
      }

      // Succès
      if (ac.signal.aborted) return;
      pendingData.current = null;
      abortControllerRef.current = null;
      safeSetStatus('saved');
      setTimeout(() => { if (isMounted.current) setStatus('idle'); }, 2_000);

    } catch (err: any) {
      if (ac.signal.aborted) return;
      console.warn('[SyncStore] save failed:', err?.message);
      safeSetStatus('error');
      retryTimer.current = setTimeout(() => { if (isMounted.current) safeSetStatus('idle'); }, 5_000);
    }
  }, [effectiveKey, supabase, readOnly]);

  // ── persistData ────────────────────────────────────────────────────────────
  const persistData = useCallback((newData: T) => {
    try { localStorage.setItem(effectiveKey, JSON.stringify(newData)); } catch {}

    if (!isCloud || !supabase || readOnly) return;

    pendingData.current = newData;
    clearRetry();           // annuler tout retry en cours
    clearDebounce();

    debounceTimer.current = setTimeout(() => {
      if (pendingData.current !== null && isMounted.current) {
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

      if (!isMounted.current) return;

      if (data?.data) {
        isRemoteUpdate.current = true;
        setValue(data.data as T);
        localStorage.setItem(effectiveKey, JSON.stringify(data.data));
        isRemoteUpdate.current = false;
        safeSetStatus('saved');
        setTimeout(() => { if (isMounted.current) setStatus('idle'); }, 2_000);
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
          if (payload.new?.data && isMounted.current) {
            isRemoteUpdate.current = true;
            setValue(payload.new.data as T);
            localStorage.setItem(effectiveKey, JSON.stringify(payload.new.data));
            isRemoteUpdate.current = false;
            safeSetStatus('saved');
            setTimeout(() => { if (isMounted.current) setStatus('idle'); }, 2_000);
          }
        }
      )
      .subscribe((s: string) => {
        if ((s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') && isMounted.current) {
          setTimeout(setupChannel, 3_000);
        }
      });

    channelRef.current = ch;
  }, [effectiveKey, supabase]);

  useEffect(() => {
    if (!isCloud) return;
    setupChannel();
    return () => { if (supabase && channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [effectiveKey, isCloud]);

  // ── Health check canal — vérifie toutes les 20s que le canal est vivant ───
  // Supabase peut décrocher silencieusement sans envoyer CHANNEL_ERROR
  useEffect(() => {
    if (!isCloud || !supabase) return;
    const healthCheck = setInterval(() => {
      if (!isMounted.current) return;
      const state = channelRef.current?.state;
      // 'joined' = OK, tout autre état = canal mort ou en erreur
      if (state && state !== 'joined') {
        console.warn('[SyncStore] canal mort (state:', state, ') — reconnexion');
        setupChannel();
      }
    }, 20_000);
    return () => clearInterval(healthCheck);
  }, [isCloud, supabase, setupChannel]);

  // ── Resync au retour — throttle commun focus + visible ────────────────────
  useEffect(() => {
    if (!isCloud) return;

    const syncOnResume = async () => {
      const now = Date.now();
      if (now - lastResumeSync.current < RESUME_THROTTLE) return;
      lastResumeSync.current = now;

      // Refresh session silencieux — app peut avoir dormi longtemps
      try { await supabase!.auth.refreshSession(); } catch {}
      if (!isMounted.current) return;

      if (pendingData.current) {
        await saveToCloud(pendingData.current);
      } else {
        fetchFromCloud();
      }
      setupChannel();
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') syncOnResume();
    };
    const onFocus   = () => syncOnResume();
    const onOnline  = () => {
      lastResumeSync.current = 0; // retour réseau = sync forcé sans throttle
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

  // ── Cleanup complet au unmount ─────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (abortControllerRef.current) abortControllerRef.current.abort();
      clearDebounce();
      clearRetry();
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

  // ── forceRetry — refresh session + retry depuis données locales ────────────
  // Appelé par le bouton "Réessayer" dans le UI après timeout d'envoi
  const forceRetry = useCallback(async () => {
    if (!supabase || readOnly) return;
    // Annuler tout save en cours
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    clearRetry();
    safeSetStatus('idle');
    try { await supabase.auth.refreshSession(); } catch {}
    // Récupérer les données — pendingData en priorité, sinon localStorage
    const data = pendingData.current ?? (() => {
      try {
        const raw = localStorage.getItem(effectiveKey);
        return raw ? JSON.parse(raw) as T : null;
      } catch { return null; }
    })();
    if (data) {
      pendingData.current = data;
      await saveToCloud(data);
    }
  }, [supabase, readOnly, effectiveKey, saveToCloud]);

  return [value, setAndSyncValue, isCloud, status, undo, history.length > 0, lastModified, forceRetry] as const;
}
