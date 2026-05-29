import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, AlertCircle, MapPin, Calendar as CalendarIcon, UserPlus, UserMinus, Edit, ThumbsUp, ThumbsDown, Smartphone, BellOff, Loader2 } from 'lucide-react';
import type { AppNotification, NotificationEventType } from '../types';
import { subscribe as pushSubscribe, unsubscribe as pushUnsubscribe, getStatus as getPushStatus, isPushSupported, PushStatus } from '../services/pushNotifications';

interface NotificationsViewProps {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  onMarkAllRead: () => void;
  onMarkRead: (ids: string[]) => void;
  onDismiss: (id: string) => void;
}

const eventIcon = (type: NotificationEventType) => {
  switch (type) {
    case 'task_created': return <UserPlus className="w-5 h-5 text-blue-500" />;
    case 'task_moved': return <CalendarIcon className="w-5 h-5 text-amber-500" />;
    case 'task_project_changed': return <MapPin className="w-5 h-5 text-amber-500" />;
    case 'task_reassigned': return <UserPlus className="w-5 h-5 text-blue-500" />;
    case 'task_unassigned': return <UserMinus className="w-5 h-5 text-orange-500" />;
    case 'task_deleted': return <AlertCircle className="w-5 h-5 text-red-500" />;
    case 'task_updated': return <Edit className="w-5 h-5 text-slate-500" />;
    case 'task_confirmed': return <ThumbsUp className="w-5 h-5 text-green-500" />;
    case 'task_declined': return <ThumbsDown className="w-5 h-5 text-orange-500" />;
    default: return <Bell className="w-5 h-5 text-slate-400" />;
  }
};

// Date complète : "12 juin 2026 à 14h30"
const formatFull = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-CA', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
};

// Groupe les notifs par jour ("Aujourd'hui", "Hier", "12 mai")
const dayBucket = (iso: string): string => {
  try {
    const d = new Date(iso);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const nDate = new Date(d); nDate.setHours(0, 0, 0, 0);

    if (nDate.getTime() === today.getTime()) return "Aujourd'hui";
    if (nDate.getTime() === yesterday.getTime()) return 'Hier';
    return d.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch { return 'Plus tôt'; }
};

// ─── Section "Réglages push" affichée en haut de la page ──────────────────
const PushToggle: React.FC = () => {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const s = await getPushStatus();
    setStatus(s);
  };

  useEffect(() => { refresh(); }, []);

  const handleEnable = async () => {
    setBusy(true);
    const ok = await pushSubscribe();
    setBusy(false);
    await refresh();
    if (!ok && AppNotification.permission === 'denied') {
      alert("Tu as bloqué les notifications dans ton navigateur. Pour les activer, va dans les réglages du navigateur pour ce site, puis recharge la page.");
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    await pushUnsubscribe();
    setBusy(false);
    await refresh();
  };

  if (!isPushSupported() || status === 'unsupported') {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-start gap-3">
        <BellOff className="w-5 h-5 text-slate-400 flex-none mt-0.5" />
        <div className="text-sm text-slate-600">
          <strong>Notifications push non supportées</strong> sur ce navigateur. Utilise Chrome, Edge ou Safari récent.
        </div>
      </div>
    );
  }

  if (status === null) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Vérification...
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <BellOff className="w-5 h-5 text-amber-600 flex-none mt-0.5" />
        <div className="text-sm text-amber-900">
          <strong>Notifications bloquées dans le navigateur.</strong>
          <p className="mt-1">Va dans les réglages du site (icône cadenas dans la barre d'adresse → Notifications) pour les autoriser, puis recharge la page.</p>
        </div>
      </div>
    );
  }

  const isOn = status === 'subscribed';

  return (
    <div className={`border rounded-lg p-4 flex items-start gap-3 ${isOn ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
      <Smartphone className={`w-5 h-5 flex-none mt-0.5 ${isOn ? 'text-green-600' : 'text-blue-600'}`} />
      <div className="flex-1">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className={`font-semibold ${isOn ? 'text-green-900' : 'text-blue-900'}`}>
              {isOn ? 'Notifications push activées sur cet appareil' : 'Activer les notifications push'}
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              {isOn
                ? 'Tu recevras un résumé quotidien à 12h s\'il y a des changements.'
                : 'Reçois un push quotidien à 12h sur ton téléphone/ordi quand y\'a des changements.'}
            </div>
          </div>
          <button
            onClick={isOn ? handleDisable : handleEnable}
            disabled={busy}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-50 ${
              isOn
                ? 'bg-white border border-green-300 text-green-700 hover:bg-green-50'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {busy ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> ...</>
            ) : isOn ? (
              <><BellOff className="w-4 h-4" /> Désactiver</>
            ) : (
              <><Bell className="w-4 h-4" /> Activer</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  unreadCount,
  loading,
  onMarkAllRead,
  onMarkRead,
  onDismiss,
}) => {
  // Au montage, marquer toutes les non lues comme lues après 3s
  React.useEffect(() => {
    if (loading) return;
    const unreadIds = notifications.filter(n => !n.readAt).map(n => n.id);
    if (unreadIds.length === 0) return;
    const t = setTimeout(() => onMarkRead(unreadIds), 3_000);
    return () => clearTimeout(t);
  }, [loading, notifications, onMarkRead]);

  // Grouper par jour
  const grouped = notifications.reduce<Record<string, AppNotification[]>>((acc, n) => {
    const bucket = dayBucket(n.createdAt);
    if (!acc[bucket]) acc[bucket] = [];
    acc[bucket].push(n);
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Bell className="w-7 h-7 text-blue-600" />
            Notifications
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {notifications.length === 0 ? (
              'Aucune notification.'
            ) : (
              <>
                {notifications.length} notification{notifications.length > 1 ? 's' : ''}
                {unreadCount > 0 && <span className="ml-2 text-blue-600 font-medium">— {unreadCount} non lue{unreadCount > 1 ? 's' : ''}</span>}
              </>
            )}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Check className="w-4 h-4" /> Tout marquer lu
          </button>
        )}
      </div>

      {/* Toggle push notifications */}
      <PushToggle />

      {/* Liste */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500">
          Chargement...
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-12 text-center">
          <Bell className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500">Tu n'as aucune notification.</p>
          <p className="text-xs text-slate-400 mt-2">
            Tu en recevras quand quelqu'un fera des changements dans le calendrier.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([bucket, items]) => (
            <div key={bucket}>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 px-1">
                {bucket}
              </h3>
              <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
                {items.map(n => (
                  <li
                    key={n.id}
                    className={`group relative px-4 py-3 hover:bg-slate-50 transition-colors ${!n.readAt ? 'bg-blue-50/30' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-none mt-0.5">{eventIcon(n.eventType)}</div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-800">{n.title}</span>
                          {!n.readAt && (
                            <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                              Nouveau
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-600 mt-1">{n.description}</div>
                        <div className="text-xs text-slate-400 mt-1.5 flex items-center gap-2">
                          {n.actorName && <span>par <strong>{n.actorName}</strong></span>}
                          <span>•</span>
                          <span>{formatFull(n.createdAt)}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => onDismiss(n.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity flex-none"
                        title="Supprimer cette notification"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Note d'info */}
      <div className="bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-lg p-3">
        <strong>Note :</strong> Les notifications sont conservées pendant 30 jours puis supprimées automatiquement.
      </div>
    </div>
  );
};
