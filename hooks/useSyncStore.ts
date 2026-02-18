import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabase, getSupabaseConfig } from '../services/supabase';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useSyncStore<T>(baseKey: string, initialValue: T) {
  const supabase = getSupabase();
  const { companyId } = getSupabaseConfig();
  const isCloud = !!supabase;

  const sanitize = (str: string) => str.trim().replace(/\s+/g, '_');

  const effectiveKey = companyId 
    ? `${sanitize(companyId)}_${baseKey}` 
    : baseKey;

  const getSavedValue = () => {
    try {
      const saved = localStorage.getItem(effectiveKey);
      if (saved) return JSON.parse(saved);
      return initialValue;
    } catch (error) {
      return initialValue;
    }
  };

  const [value, setValue] = useState<T>(getSavedValue);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [history, setHistory] = useState<T[]>([]);
  const [lastModified, setLastModified] = useState<number>(0);
  const isRemoteUpdate = useRef(false);

  const persistData = useCallback((newData: T) => {
    try {
      localStorage.setItem(effectiveKey, JSON.stringify(newData));
    } catch (e) { console.error(e); }

    if (isCloud && supabase) {
      setStatus('saving');
      supabase
        .from('crewflo_sync')
        .upsert({ key: effectiveKey, data: newData as any })
        .then(({ error }) => {
          if (error) {
            console.error("Erreur sync", error);
            setStatus('error');
          } else {
            setStatus('saved');
            setTimeout(() => setStatus('idle'), 2000);
          }
        });
    }
  }, [effectiveKey, isCloud, supabase]);

  useEffect(() => {
    if (!isCloud || !supabase) return;

    const fetchInitial = async () => {
      const { data, error } = await supabase
        .from('crewflo_sync')
        .select('data')
        .eq('key', effectiveKey)
        .single();

      if (data && data.data) {
        isRemoteUpdate.current = true;
        setValue(data.data as T);
        localStorage.setItem(effectiveKey, JSON.stringify(data.data));
        isRemoteUpdate.current = false;
        setStatus('saved');
      } else if (error && error.code === 'PGRST116') {
        await supabase.from('crewflo_sync').upsert({ key: effectiveKey, data: value as any });
      }
    };

    fetchInitial();
  }, [effectiveKey, isCloud]);

  useEffect(() => {
    if (!isCloud || !supabase) return;

    const channel = supabase
      .channel(`room_${effectiveKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crewflo_sync',
          filter: `key=eq.${effectiveKey}`,
        },
        (payload) => {
          if (payload.new && (payload.new as any).data) {
            isRemoteUpdate.current = true;
            const newData = (payload.new as any).data as T;
            setValue(newData);
            localStorage.setItem(effectiveKey, JSON.stringify(newData));
            isRemoteUpdate.current = false;
            setStatus('saved');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectiveKey, isCloud]);

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
