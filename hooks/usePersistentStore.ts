import { useState, useEffect, useCallback } from 'react';

// Un hook personnalisé qui fonctionne comme useState, mais :
// 1. Sauvegarde les données dans le navigateur (localStorage)
// 2. Écoute les changements venant d'autres onglets pour synchroniser
export function usePersistentStore<T>(key: string, initialValue: T) {
  // Fonction pour récupérer la valeur stockée ou utiliser la valeur initiale
  const getSavedValue = () => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved);
      }
      return initialValue;
    } catch (error) {
      console.error(`Erreur lors du chargement de ${key}`, error);
      return initialValue;
    }
  };

  const [value, setValue] = useState<T>(getSavedValue);

  // Sauvegarder dans le localStorage à chaque changement
  const setAndSaveValue = useCallback((newValue: T | ((val: T) => T)) => {
    setValue((currentValue) => {
      const valueToStore = newValue instanceof Function ? newValue(currentValue) : newValue;
      try {
        localStorage.setItem(key, JSON.stringify(valueToStore));
        // On dispatch un event manuel pour que l'onglet courant sache qu'il y a eu modif (optionnel selon implémentation)
      } catch (error) {
        console.error(`Erreur lors de la sauvegarde de ${key}`, error);
      }
      return valueToStore;
    });
  }, [key]);

  // Écouter les changements venant d'autres onglets (événement 'storage')
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setValue(JSON.parse(e.newValue));
        } catch (error) {
          console.error("Erreur de synchronisation", error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [value, setAndSaveValue] as const;
}