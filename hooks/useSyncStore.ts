import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabase, getSupabaseConfig } from '../services/supabase';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_TIMEOUT_MS  = 10_000; // 10s — si pas de réponse, on retry
const MAX_RETRIES      = 3;
const KEEPALIVE_MS     = 25_000; // ping toutes les 25s pour garder la connexion vivante

export function useSyncStore<T>(baseKey: string, initialValue: T) {
  const supabase        = getSupabase();
  const { companyId }   = getSupabaseConfig();
  const isCloud         = !!supabase;

  const sanitize = (str: string) => str.trim().replace(/\s+/g, '_');
  const effectiveKey    = companyId ? `${sanitize(companyId)}_${baseKey}` : baseKey;

  const getSavedValue = () => {
    try {
      const saved = localStorage.getItem(effectiveKey);
      if (saved) return JSON.parse(saved) as T;
    } catch {}
    return initialValue;
  };

  const [value,        setValue]        = useState<T>(getSavedValue);
  const [status,       setStatus]       = useState<SyncStatus>('idle');
  const [history,      setHistory]      = useState<T[]>([]);
  const [lastModified, setLastModified] = useState<number>(0);

  const isRemoteUpdate  = useRef(false);
  const pendingData     = useRef<T | null>(null);
  const saveTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepaliveRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef      = useRef<any>(null);

  // ── Fetch depuis Supabase ─────────────────────────────────────────────────
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
      } else if (error?.code === 'PGRST116') {
        const local = getSavedValue();
        await supabase.from('crewflo_sync').upsert({ key: effectiveKey, data: local as any });
      }
    } catch (e) {
      console.warn('[SyncStore] fetchFromCloud error:', e);
    }
  }, [effectiveKey, supabase]);

  // ── Save avec timeout + retry ─────────────────────────────────────────────
  const saveToCloud = useCallback(async (dataToSave: T, attempt = 1): Promise<void> => {
    if (!supabase) return;
    setStatus('saving');

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), SAVE_TIMEOUT_MS)
    );

    try {
      const savePromise = supabase
        .from('crewflo_sync')
        .upsert({ key: effectiveKey, data: dataToSave as any });

      const { error } = await Promise.race([savePromise, timeoutPromise]) as any;
      if (error) throw error;

      pendingData.current = null;
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);

    } catch (err: any) {
      console.warn(`[SyncStore] save attempt ${attempt} failed:`, err?.message ?? err);

      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        saveTimeoutRef.current = setTimeout(() => saveToCloud(dataToSave, attempt + 1), delay);
      } else {
        console.error('[SyncStore] save failed after', MAX_RETRIES, 'attempts.');
        setStatus('error');
      }
    }
  }, [effectiveKey, supabase]);

  // ── persistData ───────────────────────────────────────────────────────────
  const persistData = useCallback((newData: T) => {
    // Sauvegarde locale TOUJOURS en premier (jamais perdu)
    try {
      localStorage.setItem(effectiveKey, JSON.stringify(newData));
    } catch (e) { console.error(e); }

    if (isCloud && supabase) {
      pendingData.current = newData;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveToCloud(newData);
    }
  }, [effectiveKey, isCloud, supabase, saveToCloud]);

  // ── Chargement initial ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isCloud) return;
    fetchFromCloud();
  }, [effectiveKey, isCloud]);

  // ── Canal Realtime avec reconnexion auto ──────────────────────────────────
  const setupChannel = useCallback(() => {
    if (!supabase) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel(`room_${effectiveKey}_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crewflo_sync', filter: `key=eq.${effectiveKey}` },
        (payload: any) => {
          if (payload.new?.data) {
            isRemoteUpdate.current = true;
            const newData = payload.new.data as T;
            setValue(newData);
            localStorage.setItem(effectiveKey, JSON.stringify(newData));
            isRemoteUpdate.current = false;
            setStatus('saved');
          }
        }
      )
      .subscribe((channelStatus: string) => {
        if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT') {
          console.warn('[SyncStore] canal perdu, reconnexion dans 3s...');
          setTimeout(() => setupChannel(), 3000);
        }
      });

    channelRef.current = channel;
  }, [effectiveKey, supabase]);

  useEffect(() => {
    if (!isCloud) return;
    setupChannel();
    return () => {
      if (supabase && channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [effectiveKey, isCloud]);

  // ── Keepalive toutes les 25s ──────────────────────────────────────────────
  useEffect(() => {
    if (!isCloud || !supabase) return;
    keepaliveRef.current = setInterval(async () => {
      try {
        await supabase.from('crewflo_sync').select('key').eq('key', effectiveKey).limit(1);
      } catch {}
    }, KEEPALIVE_MS);
    return () => { if (keepaliveRef.current) clearInterval(keepaliveRef.current); };
  }, [effectiveKey, isCloud, supabase]);

  // ── Resync au retour de veille / focus ────────────────────────────────────
  useEffect(() => {
    if (!isCloud) return;

    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchFromCloud();
        if (pendingData.current) saveToCloud(pendingData.current);
        setupChannel();
      }
    };
    const handleFocus = () => {
      fetchFromCloud();
      if (pendingData.current) saveToCloud(pendingData.current);
    };

    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isCloud, fetchFromCloud, saveToCloud, setupChannel]);

  // ── API publique ──────────────────────────────────────────────────────────
  const setAndSyncValue = useCallback((newValue: T | ((val: T) => T)) => {
    setValue((currentValue) => {
      const valueToStore = newValue instanceof Function ? newValue(currentValue) : newValue;
      if (!isRemoteUpdate.current) {
        setHistory(prev => [...prev.slice(-19), currentValue]);
        setLastModified(Date.now());
      }
      persistData(valueToStore);
      return valueToStore;
    });
  }, [persistData]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previousValue = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setValue(previousValue);
    persistData(previousValue);
    setLastModified(Date.now());
  }, [history, persistData]);

  const canUndo = history.length > 0;

  return [value, setAndSyncValue, isCloud, status, undo, canUndo, lastModified] as const;
}
