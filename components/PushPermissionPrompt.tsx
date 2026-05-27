// Bannière toast en bas de l'écran qui propose d'activer les push.
// S'affiche automatiquement pour les users connectés qui n'ont pas encore
// activé/refusé les notifs push.
//
// 3 actions : Activer (subscribe), Plus tard (snooze 7j), Non merci (skip définitif)
// État stocké en localStorage pour pas spammer l'user.

import React, { useEffect, useState } from 'react';
import { Bell, X, Loader2 } from 'lucide-react';
import { subscribe as pushSubscribe, getStatus as getPushStatus, isPushSupported } from '../services/pushNotifications';

const LS_KEY = 'crewflo_push_prompt_state';
const SNOOZE_DAYS = 7;

type StoredState =
  | { kind: 'never' }                    // user a dit "Non merci" — ne plus jamais demander
  | { kind: 'snoozed'; until: number };  // user a dit "Plus tard" — redemander après cette date

function readState(): StoredState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredState;
  } catch { return null; }
}

function writeState(s: StoredState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}

function clearState() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}

interface PushPermissionPromptProps {
  enabled: boolean;  // true = l'user est connecté (sinon on ne montre rien)
}

export const PushPermissionPrompt: React.FC<PushPermissionPromptProps> = ({ enabled }) => {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  // Décider si on doit afficher
  useEffect(() => {
    if (!enabled) { setVisible(false); return; }
    if (!isPushSupported()) { setVisible(false); return; }

    // Vérifier l'état du browser
    const perm = (typeof Notification !== 'undefined') ? Notification.permission : 'default';
    if (perm !== 'default') {
      // Soit déjà autorisé (on vérifie status === 'subscribed'), soit bloqué
      // Dans les deux cas, pas besoin de prompt
      setVisible(false);
      return;
    }

    // Vérifier le localStorage (a-t-on déjà demandé récemment ?)
    const stored = readState();
    if (stored?.kind === 'never') {
      setVisible(false);
      return;
    }
    if (stored?.kind === 'snoozed' && stored.until > Date.now()) {
      setVisible(false);
      return;
    }

    // Délai 3s avant d'afficher — pas trop intrusif au chargement
    const t = setTimeout(async () => {
      const status = await getPushStatus();
      if (status === 'not-asked' || status === 'permission-ok') {
        setVisible(true);
      }
    }, 3_000);
    return () => clearTimeout(t);
  }, [enabled]);

  const handleEnable = async () => {
    setBusy(true);
    const ok = await pushSubscribe();
    setBusy(false);
    if (ok) {
      clearState();
      setVisible(false);
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      // User a refusé → on enregistre "never" pour pas redemander
      writeState({ kind: 'never' });
      setVisible(false);
    }
    // Si échec sans denial, on laisse le prompt visible pour réessayer
  };

  const handleSnooze = () => {
    writeState({ kind: 'snoozed', until: Date.now() + SNOOZE_DAYS * 86_400_000 });
    setVisible(false);
  };

  const handleNever = () => {
    writeState({ kind: 'never' });
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-[60] animate-slide-up">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl p-4 flex items-start gap-3">
        {/* Icône */}
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-none">
          <Bell className="w-5 h-5 text-blue-600" />
        </div>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-800">
            Activer les notifications ?
          </div>
          <div className="text-sm text-slate-600 mt-1">
            Reçois un résumé quotidien à 12h sur ton appareil quand des changements arrivent sur tes chantiers.
          </div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              onClick={handleEnable}
              disabled={busy}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
            >
              {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> ...</> : <><Bell className="w-3.5 h-3.5" /> Activer</>}
            </button>
            <button
              onClick={handleSnooze}
              disabled={busy}
              className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium disabled:opacity-50"
            >
              Plus tard
            </button>
            <button
              onClick={handleNever}
              disabled={busy}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium disabled:opacity-50"
            >
              Non merci
            </button>
          </div>
        </div>

        {/* Bouton de fermeture (= snooze) */}
        <button
          onClick={handleSnooze}
          className="text-slate-300 hover:text-slate-500 flex-none"
          title="Fermer (redemander plus tard)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
