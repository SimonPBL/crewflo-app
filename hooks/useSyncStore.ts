import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabase, getSupabaseConfig } from '../services/supabase';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

// Ce hook gère la synchronisation Hybride (Local ou Cloud) avec Historique (Undo)
export function useSyncStore<T>(baseKey: string, initialValue: T) {
  const supabase = getSupabase();
  const { companyId } = getSupabaseConfig();
  const isCloud = !!supabase;

  // Construction de la clé effective (Scope)
  // Si companyId existe: "MaCompagnie_crewflo_projects"
  // Sinon (rétro-compatibilité): "crewflo_projects"
  const effectiveKey = companyId ? `${companyId}_${baseKey}` : baseKey;

  // 1. Initialiser l'état localement d'abord (pour la vitesse)
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
  
  // Gestion de l'historique
  const [history, setHistory] = useState<T[]>([]);
  const [lastModified, setLastModified] = useState<number>(0);

  const isRemoteUpdate = useRef(false);

  // Fonction interne pour sauvegarder vers Supabase et LocalStorage sans toucher à l'historique
  const persistData = useCallback((newData: T) => {
      // Sauvegarde Locale
      try {
        localStorage.setItem(effectiveKey, JSON.stringify(newData));
      } catch (e) { console.error(e); }

      // Sauvegarde Cloud
      if (isCloud && supabase) {
        setStatus('saving');
        supabase
            .from('crewflo_sync')
            .update({ data: newData as any })
            .eq('key', effectiveKey) // Utilise la clé avec préfixe
            .then(({ error }) => {
                if(error) {
                    console.error("Erreur sync", error);
                    setStatus('error'); 
                } else {
                    setStatus('saved');
                    setTimeout(() => setStatus('idle'), 2000);
                }
            });
      }
  }, [effectiveKey, isCloud, supabase]);

  // 2. Si Cloud activé : Charger la donnée initiale depuis Supabase
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
        // La ligne n'existe pas, on l'initie
        await supabase.from('crewflo_sync').upsert({ key: effectiveKey, data: value as any });
      }
    };

    fetchInitial();
  }, [effectiveKey, isCloud]); 

  // 3. Si Cloud activé : Écouter les changements en temps réel
  useEffect(() => {
    if (!isCloud || !supabase) return;

    const channel = supabase
      .channel(`room_${effectiveKey}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'crewflo_sync',
          filter: `key=eq.${effectiveKey}`,
        },
        (payload) => {
          if (payload.new && payload.new.data) {
            isRemoteUpdate.current = true;
            const newData = payload.new.data as T;
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

  // 4. Fonction publique pour mettre à jour la donnée (Ajoute à l'historique)
  const setAndSyncValue = useCallback((newValue: T | ((val: T) => T)) => {
    setValue((currentValue) => {
      const valueToStore = newValue instanceof Function ? newValue(currentValue) : newValue;
      
      // On ne met à jour l'historique que si ce n'est pas une update distante (Supabase)
      if (!isRemoteUpdate.current) {
          // Limiter l'historique aux 20 dernières actions pour économiser la mémoire
          setHistory(prev => [...prev.slice(-19), currentValue]);
          setLastModified(Date.now());
      }

      persistData(valueToStore);
      return valueToStore;
    });
  }, [persistData]);

  // 5. Fonction Undo
  const undo = useCallback(() => {
    if (history.length === 0) return;

    const previousValue = history[history.length - 1];
    
    // On enlève le dernier état de l'historique
    setHistory(prev => prev.slice(0, -1));
    
    // On met à jour l'état actuel avec l'ancien
    setValue(previousValue);
    
    // On force la sauvegarde (Cloud/Local) de cet ancien état comme étant le nouveau "courant"
    persistData(previousValue);
    
    // On met à jour le timestamp pour signaler une modif (utile pour le coordinateur d'undo global)
    setLastModified(Date.now()); 
  }, [history, persistData]);

  const canUndo = history.length > 0;

  return [value, setAndSyncValue, isCloud, status, undo, canUndo, lastModified] as const;
}