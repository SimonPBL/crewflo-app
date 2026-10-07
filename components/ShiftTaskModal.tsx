import React, { useMemo, useState } from 'react';
import { CalendarDays, X, ArrowRight, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Project, Supplier, Task } from '../types';
import { SCHEDULE_TEMPLATE } from './ScheduleTemplate';
import { addBusinessDays, businessDaysBetween, isBusinessDay, localDateKey, placeTask } from '../lib/ccqHolidays';

// ── Décalage de tâches ─────────────────────────────────────────
// On déplace une tâche à une nouvelle date; la modale liste les tâches
// du même chantier qui commencent le jour même ou après sa date d'origine.
// Pré-cochées : tâches intérieures de la cédule + tâches ajoutées à la main.
// Décochées : tâches de la catégorie « Extérieur » de la cédule.
// Les tâches cochées reculent (ou avancent) du même nombre de jours ouvrables.

type TaskKind = 'interieur' | 'exterieur' | 'manuelle';

const norm = (s: string) => s.trim().toLowerCase();

const EXTERIOR_LABELS = new Set(
  (SCHEDULE_TEMPLATE.find(c => c.key === 'exterieur')?.items || []).map(i => norm(i.label))
);
const TEMPLATE_ORDER: Map<string, number> = (() => {
  const m = new Map<string, number>();
  let i = 0;
  SCHEDULE_TEMPLATE.forEach(c => c.items.forEach(it => { m.set(norm(it.label), i++); }));
  return m;
})();

export const getTaskKind = (title: string): TaskKind => {
  const t = norm(title || '');
  if (EXTERIOR_LABELS.has(t)) return 'exterieur';
  if (TEMPLATE_ORDER.has(t)) return 'interieur';
  return 'manuelle';
};

const dayStart = (iso: string) => { const d = new Date(iso); d.setHours(0, 0, 0, 0); return d.getTime(); };

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' });

/** Applique la date choisie (AAAA-MM-JJ) en gardant l'heure de `iso`. */
const withDate = (iso: string, ymd: string) => {
  const src = new Date(iso);
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, src.getHours(), src.getMinutes(), 0, 0);
};

// Décale le début de `delta` jours ouvrables, puis garde la durée en jours ouvrables
// (fins de semaine et congés CCQ sautés).
const shiftTask = (t: Task, delta: number): { start: string; end: string } => {
  const placed = placeTask(new Date(t.start), new Date(t.end), addBusinessDays(new Date(t.start), delta));
  return { start: placed.start.toISOString(), end: placed.end.toISOString() };
};

interface ShiftTaskModalProps {
  task: Task;                       // tâche telle qu'enregistrée (date d'origine)
  tasks: Task[];
  suppliers: Supplier[];
  projects: Project[];
  initialNewStart?: string;         // date déjà choisie dans la fiche de la tâche
  edited?: Partial<Task>;           // autres modifications faites dans la fiche
  onApply: (updates: Record<string, Partial<Task>>) => void;
  onSaveOnly?: () => void;          // enregistrer la tâche seule, sans décaler les autres
  onNotify: (projectId: string, supplierIds: string[]) => void;
  onClose: () => void;
}

export const ShiftTaskModal: React.FC<ShiftTaskModalProps> = ({
  task, tasks, suppliers, projects, initialNewStart, edited, onApply, onSaveOnly, onNotify, onClose,
}) => {
  const base: Task = { ...task, ...(edited || {}) } as Task;
  const [newDate, setNewDate] = useState<string>(localDateKey(new Date(initialNewStart || task.start)));

  const candidates = useMemo(() => {
    const origDay = dayStart(task.start);
    return tasks
      .filter(t => t.projectId === task.projectId && t.id !== task.id && dayStart(t.start) >= origDay)
      .sort((a, b) => {
        const d = new Date(a.start).getTime() - new Date(b.start).getTime();
        if (d !== 0) return d;
        return (TEMPLATE_ORDER.get(norm(a.title)) ?? 999) - (TEMPLATE_ORDER.get(norm(b.title)) ?? 999);
      })
      .map(t => ({ task: t, kind: getTaskKind(t.title) }));
  }, [tasks, task.id, task.projectId, task.start]);

  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(candidates.filter(c => c.kind !== 'exterieur').map(c => c.task.id))
  );
  const [done, setDone] = useState<{ count: number; supplierIds: string[] } | null>(null);

  const chosenStart = useMemo(() => withDate(base.start, newDate), [base.start, newDate]);
  const isOffDay = !isBusinessDay(chosenStart);
  // Tâche déplacée : début ramené au prochain jour ouvrable, même durée en jours ouvrables
  const moved = useMemo(() => placeTask(new Date(base.start), new Date(base.end), chosenStart),
    [base.start, base.end, chosenStart]);
  const newStart = moved.start;
  const movedEnd = moved.end;
  const delta = businessDaysBetween(new Date(task.start), newStart);
  const dateChanged = localDateKey(new Date(task.start)) !== localDateKey(newStart)
    || localDateKey(new Date(task.end)) !== localDateKey(movedEnd);

  const toggle = (id: string) => setChecked(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const supplierName = (id: string) => suppliers.find(s => s.id === id)?.name || '';
  const projectName = projects.find(p => p.id === task.projectId)?.name || '';
  const nbChecked = delta === 0 ? 0 : candidates.filter(c => checked.has(c.task.id)).length;

  const apply = () => {
    if (!newDate) return;
    const updates: Record<string, Partial<Task>> = {
      [task.id]: { ...(edited || {}), start: newStart.toISOString(), end: movedEnd.toISOString() },
    };
    const sup = new Set<string>([base.supplierId]);
    if (delta !== 0) {
      candidates.forEach(c => {
        if (!checked.has(c.task.id)) return;
        updates[c.task.id] = shiftTask(c.task, delta);
        sup.add(c.task.supplierId);
      });
    }
    onApply(updates);
    setDone({ count: Object.keys(updates).length, supplierIds: Array.from(sup).filter(Boolean) });
  };

  const kindTag = (kind: TaskKind) => {
    if (kind === 'exterieur') return <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">Extérieur</span>;
    if (kind === 'manuelle') return <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">Ajoutée à la main</span>;
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh]">
        {/* En-tête */}
        <div className="flex-none px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-800 truncate">Déplacer {base.title}</h3>
            <p className="text-xs text-slate-500 truncate">{projectName}{base.supplierId ? ` · ${supplierName(base.supplierId)}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Fermer"><X className="w-5 h-5" /></button>
        </div>

        {done ? (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800">Cédule mise à jour</p>
                <p className="text-sm text-slate-500">{done.count} tâche{done.count > 1 ? 's' : ''} déplacée{done.count > 1 ? 's' : ''}. Veux-tu prévenir les fournisseurs touchés?</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Plus tard</button>
              <button onClick={() => onNotify(task.projectId, done.supplierIds)}
                className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> Prévenir
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Dates */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-slate-500">Date actuelle</p>
                  <p className="text-sm font-semibold text-slate-800">{fmt(task.start)}</p>
                </div>
                <label className="border border-blue-300 rounded-lg px-3 py-2 block cursor-pointer">
                  <p className="text-[11px] text-slate-500 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Nouvelle date</p>
                  <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                    className="w-full text-sm font-semibold text-blue-700 bg-transparent outline-none" />
                </label>
              </div>

              {isOffDay && (
                <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Cette date tombe une fin de semaine ou un congé CCQ : la tâche commencera le {fmt(newStart.toISOString())}.</span>
                </div>
              )}

              {dateChanged && (
                <p className="text-xs text-slate-500">
                  Nouvelle période : <span className="font-semibold text-slate-700">{fmt(newStart.toISOString())} → {fmt(movedEnd.toISOString())}</span> (fins de semaine et congés sautés)
                </p>
              )}

              {!dateChanged ? (
                <p className="text-sm text-slate-500">Choisis la nouvelle date de la tâche.</p>
              ) : candidates.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune autre tâche après celle-ci dans ce chantier.</p>
              ) : (
                <>
                  <p className="text-sm text-slate-600">
                    Décalage : <span className="font-semibold">{delta > 0 ? '+' : ''}{delta} jour{Math.abs(delta) > 1 ? 's' : ''} ouvrable{Math.abs(delta) > 1 ? 's' : ''}</span>. Coche les tâches qui suivent :
                  </p>
                  <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
                    {candidates.map(({ task: t, kind }) => {
                      const on = checked.has(t.id) && delta !== 0;
                      const shifted = shiftTask(t, delta);
                      return (
                        <label key={t.id} className="flex items-center gap-3 py-2.5 cursor-pointer">
                          <input type="checkbox" checked={checked.has(t.id)} onChange={() => toggle(t.id)}
                            className="w-5 h-5 accent-blue-600 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800 truncate">{t.title}{kindTag(kind)}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1 flex-wrap">
                              {supplierName(t.supplierId) && <span className="truncate">{supplierName(t.supplierId)} ·</span>}
                              <span>{fmt(t.start)}</span>
                              {on ? (<><ArrowRight className="w-3 h-3" /><span className="font-semibold text-blue-700">{fmt(shifted.start)}</span></>)
                                  : <span>· reste en place</span>}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Pied */}
            <div className="flex-none p-4 border-t border-slate-100 space-y-2 pb-6 sm:pb-4">
              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Annuler</button>
                <button onClick={apply} disabled={!dateChanged}
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40">
                  Appliquer ({1 + nbChecked})
                </button>
              </div>
              {onSaveOnly && (
                <button onClick={onSaveOnly} className="w-full py-2 text-xs text-slate-500 hover:text-slate-800">
                  Enregistrer seulement cette tâche
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
