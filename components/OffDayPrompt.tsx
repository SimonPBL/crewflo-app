import React, { useMemo, useState } from 'react';
import { CalendarOff, X } from 'lucide-react';
import { CCQ_HOLIDAYS, localDateKey, offDayLabel, offDaysInRange } from '../lib/ccqHolidays';

// ── « Le fournisseur travaille-t-il ces jours-là? » ────────────
// Affichée chaque fois qu'une tâche touche une fin de semaine, un férié
// ou un congé CCQ. Simon coche les jours travaillés (samedi et/ou dimanche, etc.).
// Les jours non cochés sont sautés : la tâche n'apparaît pas ces jours-là.

export interface OffDayItem {
  id: string;
  title: string;
  subtitle?: string;
  start: string;
  end: string;
  worked?: string[];   // jours déjà cochés
}

interface Props {
  items: OffDayItem[];
  onConfirm: (worked: Record<string, string[]>) => void;
  onCancel: () => void;
}

const dayFmt = (d: Date) => d.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' });

/** Regroupe les jours non ouvrables consécutifs en blocs (ex. sam.-dim.-lun. férié). */
const toBlocks = (days: Date[]) => {
  const blocks: Date[][] = [];
  days.forEach(d => {
    const last = blocks[blocks.length - 1];
    const prev = last?.[last.length - 1];
    if (prev && (d.getTime() - prev.getTime()) <= 36 * 3600 * 1000) last.push(d);
    else blocks.push([d]);
  });
  return blocks;
};

export const OffDayPrompt: React.FC<Props> = ({ items, onConfirm, onCancel }) => {
  const prepared = useMemo(() => items
    .map(it => ({ ...it, blocks: toBlocks(offDaysInRange(it.start, it.end)) }))
    .filter(it => it.blocks.length > 0), [items]);

  const [worked, setWorked] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {};
    items.forEach(it => { init[it.id] = new Set(it.worked || []); });
    return init;
  });

  const toggle = (id: string, key: string) => setWorked(prev => {
    const n = new Set(prev[id] || []);
    if (n.has(key)) n.delete(key); else n.add(key);
    return { ...prev, [id]: n };
  });

  // Toutes les fins de semaine (samedis + dimanches) de toutes les tâches
  const weekendKeys = useMemo(() => {
    const m: Record<string, string[]> = {};
    prepared.forEach(it => {
      m[it.id] = it.blocks.flat().filter(d => d.getDay() === 0 || d.getDay() === 6).map(localDateKey);
    });
    return m;
  }, [prepared]);
  const hasWeekends = Object.values(weekendKeys).some(k => k.length > 0);
  const allWeekendsOn = hasWeekends && Object.entries(weekendKeys).every(([id, keys]) => keys.every(k => worked[id]?.has(k)));
  const toggleAllWeekends = () => setWorked(prev => {
    const next: Record<string, Set<string>> = { ...prev };
    Object.entries(weekendKeys).forEach(([id, keys]) => {
      const n = new Set(prev[id] || []);
      keys.forEach(k => { if (allWeekendsOn) n.delete(k); else n.add(k); });
      next[id] = n;
    });
    return next;
  });

  const confirm = () => {
    const out: Record<string, string[]> = {};
    items.forEach(it => { out[it.id] = Array.from(worked[it.id] || []).sort(); });
    onConfirm(out);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh]">
        <div className="flex-none px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <CalendarOff className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-base font-bold text-slate-800">Fin de semaine ou congé</h3>
              <p className="text-xs text-slate-500">Le fournisseur travaille-t-il ces jours-là? Coche les jours travaillés. Les autres sont sautés.</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Fermer"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {hasWeekends && (
            <button type="button" onClick={toggleAllWeekends} aria-pressed={allWeekendsOn}
              className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-lg border text-left ${allWeekendsOn ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-300'}`}>
              <span className="text-sm font-semibold text-slate-800">Travaille toutes les fins de semaine</span>
              <span className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${allWeekendsOn ? 'bg-blue-600' : 'bg-slate-300'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${allWeekendsOn ? 'translate-x-6' : 'translate-x-1'}`} />
              </span>
            </button>
          )}
          {prepared.map(it => (
            <div key={it.id} className="space-y-2">
              {prepared.length > 1 && (
                <div>
                  <p className="text-sm font-semibold text-slate-800">{it.title}</p>
                  {it.subtitle && <p className="text-xs text-slate-500">{it.subtitle}</p>}
                </div>
              )}
              {it.blocks.map(block => {
                const labels = Array.from(new Set(block.map(d => offDayLabel(d) || ''))).filter(Boolean).join(' + ');
                return (
                  <div key={localDateKey(block[0])} className="bg-slate-50 rounded-lg p-2.5">
                    <p className="text-xs font-medium text-slate-600 mb-2">{labels}</p>
                    <div className="flex flex-wrap gap-2">
                      {block.map(d => {
                        const key = localDateKey(d);
                        const on = worked[it.id]?.has(key);
                        // Même code de couleur que le calendrier : fin de semaine = bleu, férié / congé CCQ = orange
                        const isHoliday = !!CCQ_HOLIDAYS[key];
                        const cls = isHoliday
                          ? (on ? 'bg-orange-500 border-orange-500 text-white font-semibold' : 'bg-orange-50 border-orange-200 text-orange-700')
                          : (on ? 'bg-blue-600 border-blue-600 text-white font-semibold' : 'bg-blue-50 border-blue-200 text-blue-800');
                        return (
                          <button key={key} type="button" onClick={() => toggle(it.id, key)} aria-pressed={on}
                            title={isHoliday ? CCQ_HOLIDAYS[key] : 'Fin de semaine'}
                            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${cls}`}>
                            {on ? '✓ ' : ''}{dayFmt(d)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex-none p-4 border-t border-slate-100 pb-6 sm:pb-4 flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Retour</button>
          <button onClick={confirm} className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">Confirmer</button>
        </div>
      </div>
    </div>
  );
};

/** Vrai si au moins une tâche touche un jour non ouvrable. */
export const touchesOffDays = (start: string, end: string) => offDaysInRange(start, end).length > 0;
