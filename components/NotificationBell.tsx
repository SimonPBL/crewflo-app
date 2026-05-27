import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, X, ChevronRight } from 'lucide-react';
import { Notification, NotificationEventType } from '../types';

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  onMarkAllRead: () => void;
  onMarkRead: (ids: string[]) => void;
  onDismiss: (id: string) => void;
  onOpenFullView: () => void;
}

// Couleur du dot d'icône selon le type d'event
const eventColor = (type: NotificationEventType): string => {
  switch (type) {
    case 'task_created':
    case 'task_reassigned':
      return 'bg-blue-500';
    case 'task_moved':
    case 'task_project_changed':
      return 'bg-amber-500';
    case 'task_deleted':
    case 'task_unassigned':
      return 'bg-red-500';
    case 'task_confirmed':
      return 'bg-green-500';
    case 'task_declined':
      return 'bg-orange-500';
    case 'task_updated':
    default:
      return 'bg-slate-400';
  }
};

// "Il y a 5 min", "Il y a 2 h", "Hier", "12 mai"
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

export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  unreadCount,
  loading,
  onMarkAllRead,
  onMarkRead,
  onDismiss,
  onOpenFullView,
}) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fermer si clic à l'extérieur
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Quand on ouvre le dropdown, marquer comme lues les notifs visibles après 2s
  useEffect(() => {
    if (!open) return;
    const unreadIds = notifications.filter(n => !n.readAt).slice(0, 10).map(n => n.id);
    if (unreadIds.length === 0) return;
    const t = setTimeout(() => onMarkRead(unreadIds), 2_000);
    return () => clearTimeout(t);
  }, [open, notifications, onMarkRead]);

  const top10 = notifications.slice(0, 10);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton cloche */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-slate-100 transition-colors"
        title="Notifications"
        aria-label={`Notifications (${unreadCount} non lue${unreadCount > 1 ? 's' : ''})`}
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-[80vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-none">
            <h3 className="font-bold text-slate-800">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> Tout marquer lu
              </button>
            )}
          </div>

          {/* Liste */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">Chargement...</div>
            ) : top10.length === 0 ? (
              <div className="px-4 py-12 text-center text-slate-400 text-sm">
                <Bell className="w-10 h-10 mx-auto mb-2 text-slate-200" />
                Aucune notification.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {top10.map(n => (
                  <li
                    key={n.id}
                    className={`group relative px-4 py-3 hover:bg-slate-50 transition-colors ${!n.readAt ? 'bg-blue-50/40' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Dot couleur */}
                      <div className={`w-2 h-2 rounded-full ${eventColor(n.eventType)} mt-2 flex-none`} />

                      {/* Contenu */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">
                          {n.title}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                          {n.description}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                          {n.actorName && <span>par <strong>{n.actorName}</strong></span>}
                          <span>•</span>
                          <span>{relativeTime(n.createdAt)}</span>
                        </div>
                      </div>

                      {/* Bouton dismiss */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity flex-none"
                        title="Supprimer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <button
              onClick={() => { setOpen(false); onOpenFullView(); }}
              className="px-4 py-3 border-t border-slate-200 text-sm font-medium text-blue-600 hover:bg-slate-50 flex items-center justify-center gap-1 flex-none"
            >
              Voir tout l'historique <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
