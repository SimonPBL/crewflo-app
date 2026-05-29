import React from 'react';
import { Bell, X, ChevronRight, UserPlus, UserMinus, MapPin, AlertCircle, Edit, ThumbsUp, ThumbsDown, Calendar as CalendarIcon } from 'lucide-react';
import type { AppNotification, NotificationEventType } from '../types';

interface StartupNotificationsModalProps {
  notifications: AppNotification[];
  onClose: () => void;
  onSeeAll: () => void;
}

const eventIcon = (type: NotificationEventType) => {
  switch (type) {
    case 'task_created': return <UserPlus className="w-4 h-4 text-blue-500" />;
    case 'task_moved': return <CalendarIcon className="w-4 h-4 text-amber-500" />;
    case 'task_project_changed': return <MapPin className="w-4 h-4 text-amber-500" />;
    case 'task_reassigned': return <UserPlus className="w-4 h-4 text-blue-500" />;
    case 'task_unassigned': return <UserMinus className="w-4 h-4 text-orange-500" />;
    case 'task_deleted': return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'task_updated': return <Edit className="w-4 h-4 text-slate-500" />;
    case 'task_confirmed': return <ThumbsUp className="w-4 h-4 text-green-500" />;
    case 'task_declined': return <ThumbsDown className="w-4 h-4 text-orange-500" />;
    default: return <Bell className="w-4 h-4 text-slate-400" />;
  }
};

const relativeTime = (iso: string): string => {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Il y a ${diffH} h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return 'Hier';
    if (diffD < 7) return `Il y a ${diffD} j`;
    return d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
  } catch { return iso; }
};

export const StartupNotificationsModal: React.FC<StartupNotificationsModalProps> = ({
  notifications,
  onClose,
  onSeeAll,
}) => {
  // Top 5 notifs non lues
  const unreadTop5 = notifications.filter(n => !n.readAt).slice(0, 5);
  const total = notifications.filter(n => !n.readAt).length;

  if (unreadTop5.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-none bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">
                {total === 1 ? 'Nouveau changement' : 'Derniers changements'}
              </h3>
              <p className="text-xs text-slate-500">
                {total} non lu{total > 1 ? 's' : ''} depuis ta dernière visite
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Liste des notifs */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <ul className="space-y-3">
            {unreadTop5.map(n => (
              <li key={n.id} className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-b-0 last:pb-0">
                <div className="flex-none mt-0.5">{eventIcon(n.eventType)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-800">{n.title}</div>
                  <div className="text-xs text-slate-600 mt-0.5">{n.description}</div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                    {n.actorName && <span>par <strong>{n.actorName}</strong></span>}
                    <span>•</span>
                    <span>{relativeTime(n.createdAt)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {total > 5 && (
            <p className="text-xs text-slate-400 text-center mt-3 italic">
              … et {total - 5} autre{total - 5 > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Footer avec boutons */}
        <div className="px-5 py-3 border-t border-slate-200 flex items-center gap-2 flex-none bg-slate-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
          >
            OK
          </button>
          <button
            onClick={onSeeAll}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
          >
            Voir tout <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
