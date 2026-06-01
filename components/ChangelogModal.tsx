import React from 'react';
import { X, Sparkles, Wrench, ArrowUp, Check } from 'lucide-react';
import type { ChangelogEntry, ChangeType } from '../lib/changelog';

interface ChangelogModalProps {
  entries: ChangelogEntry[];
  onClose: () => void;
}

const typeIcon = (type: ChangeType) => {
  switch (type) {
    case 'feat': return <Sparkles className="w-4 h-4 text-blue-500" />;
    case 'fix': return <Wrench className="w-4 h-4 text-amber-500" />;
    case 'improvement': return <ArrowUp className="w-4 h-4 text-green-500" />;
    default: return null;
  }
};

const typeLabel = (type: ChangeType): string => {
  switch (type) {
    case 'feat': return 'Nouveau';
    case 'fix': return 'Correctif';
    case 'improvement': return 'Amélioration';
    default: return '';
  }
};

const formatDate = (iso: string): string => {
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return iso; }
};

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ entries, onClose }) => {
  if (entries.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between flex-none bg-gradient-to-br from-blue-50 via-white to-purple-50">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 mb-1">
              {entries.length === 1 ? 'Quoi de neuf' : `${entries.length} nouvelles versions`}
            </div>
            <h2 className="text-xl font-bold text-slate-800">
              CrewFlo est à jour !
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Voici ce qui a changé depuis ta dernière utilisation.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 flex-none"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Liste des entrées (versions) */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {entries.map((entry) => (
            <div key={entry.version}>
              <div className="flex items-baseline gap-2 mb-3 pb-1.5 border-b border-slate-100">
                <span className="font-bold text-slate-800">Version {entry.version}</span>
                {entry.title && <span className="text-sm text-slate-600">— {entry.title}</span>}
                <span className="text-xs text-slate-400 ml-auto">{formatDate(entry.date)}</span>
              </div>
              <ul className="space-y-2.5">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <div className="flex-none mt-0.5">{typeIcon(change.type)}</div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mr-1.5">
                        {typeLabel(change.type)}
                      </span>
                      <span className="text-sm text-slate-700">{change.description}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex-none bg-slate-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" /> Compris
          </button>
        </div>
      </div>
    </div>
  );
};
