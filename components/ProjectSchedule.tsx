import React, { useState, useMemo } from 'react';
import { SCHEDULE_TEMPLATE, ScheduleCategory } from './ScheduleTemplate';
import { Project, Supplier, Task } from '../types';
import { Check, X, ChevronDown, ChevronRight, Calendar, Truck, AlertCircle } from 'lucide-react';

// ── Types internes ────────────────────────────────────────────

type ItemStatus = 'pending' | 'active' | 'na'; // pending = pas encore décidé

interface ScheduleEntry {
  categoryKey: string;
  itemKey: string;
  status: ItemStatus;
  supplierId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

interface Props {
  project: Project;
  suppliers: Supplier[];
  existingTasks: Task[];
  onGenerateTasks: (tasks: Omit<Task, 'id' | 'createdAt'>[]) => void;
  onClose: () => void;
}

// ── Mini calendrier de sélection de date ─────────────────────

const MiniDatePicker: React.FC<{
  value: string;
  onChange: (date: string) => void;
  label: string;
}> = ({ value, onChange, label }) => {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const d = value ? new Date(value) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const days = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = new Date(year, month, 1);
    const offset = first.getDay();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [viewDate]);

  const displayValue = value
    ? new Date(value + 'T12:00:00').toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Sélectionner';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors
          ${value ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-300 text-slate-500 hover:border-slate-400'}`}
      >
        <Calendar className="w-3 h-3" />
        {displayValue}
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-xl p-3 w-64">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => { const d = new Date(viewDate); d.setMonth(d.getMonth()-1); setViewDate(d); }}
              className="p-1 hover:bg-slate-100 rounded text-slate-600">‹</button>
            <span className="text-xs font-bold text-slate-700 capitalize">
              {viewDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => { const d = new Date(viewDate); d.setMonth(d.getMonth()+1); setViewDate(d); }}
              className="p-1 hover:bg-slate-100 rounded text-slate-600">›</button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {['D','L','M','M','J','V','S'].map((d,i) => (
              <div key={i} className="text-center text-[10px] font-bold text-slate-400">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day, i) => {
              if (!day) return <div key={i} />;
              const str = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
              const isSelected = str === value;
              const isToday = str === new Date().toISOString().slice(0,10);
              return (
                <button key={i} onClick={() => { onChange(str); setOpen(false); }}
                  className={`text-xs rounded py-1 transition-colors font-medium
                    ${isSelected ? 'bg-blue-600 text-white' : isToday ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-700'}`}>
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          {value && (
            <button onClick={() => { onChange(''); setOpen(false); }}
              className="mt-2 w-full text-xs text-slate-400 hover:text-red-500 text-center">
              Effacer
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── Composant principal ───────────────────────────────────────

export const ProjectSchedule: React.FC<Props> = ({
  project, suppliers, existingTasks, onGenerateTasks, onClose
}) => {
  const [entries, setEntries] = useState<Record<string, ScheduleEntry>>({});
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>(
    Object.fromEntries(SCHEDULE_TEMPLATE.map(c => [c.key, true]))
  );
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const getEntry = (catKey: string, itemKey: string): ScheduleEntry => {
    const key = `${catKey}_${itemKey}`;
    return entries[key] ?? {
      categoryKey: catKey,
      itemKey,
      status: 'pending',
      supplierId: '',
      startDate: '',
      endDate: '',
    };
  };

  const setEntry = (catKey: string, itemKey: string, patch: Partial<ScheduleEntry>) => {
    const key = `${catKey}_${itemKey}`;
    setEntries(prev => ({
      ...prev,
      [key]: { ...getEntry(catKey, itemKey), ...patch },
    }));
  };

  const activeEntries = Object.values(entries).filter(e => e.status === 'active');
  const readyToGenerate = activeEntries.filter(e => e.startDate && e.endDate && e.supplierId);
  const missingInfo = activeEntries.filter(e => !e.startDate || !e.endDate || !e.supplierId);

  const handleGenerate = () => {
    setGenerating(true);
    const newTasks: Omit<Task, 'id' | 'createdAt'>[] = readyToGenerate.map(entry => {
      const cat = SCHEDULE_TEMPLATE.find(c => c.key === entry.categoryKey)!;
      const item = cat.items.find(i => i.key === entry.itemKey)!;
      const start = new Date(entry.startDate + 'T07:00:00');
      const end = new Date(entry.endDate + 'T17:00:00');
      return {
        projectId: project.id,
        supplierId: entry.supplierId,
        title: item.label,
        start: start.toISOString(),
        end: end.toISOString(),
        notes: item.type === 'delivery' ? '📦 Livraison' : '',
      };
    });
    onGenerateTasks(newTasks);
    setGenerating(false);
    setGenerated(true);
    setTimeout(() => setGenerated(false), 3000);
  };

  const toggleCat = (catKey: string) =>
    setExpandedCats(prev => ({ ...prev, [catKey]: !prev[catKey] }));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
        <div>
          <h2 className="font-bold text-slate-800 text-lg">Cédule de chantier</h2>
          <p className="text-sm text-slate-500">{project.name}</p>
        </div>
        <div className="flex items-center gap-3">
          {missingInfo.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {missingInfo.length} tâche{missingInfo.length > 1 ? 's' : ''} incomplète{missingInfo.length > 1 ? 's' : ''}
            </div>
          )}
          {readyToGenerate.length > 0 && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm shadow-sm transition-all
                ${generated ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            >
              {generated ? (
                <><Check className="w-4 h-4" /> {readyToGenerate.length} tâches générées !</>
              ) : (
                <>📅 Générer {readyToGenerate.length} tâche{readyToGenerate.length > 1 ? 's' : ''}</>
              )}
            </button>
          )}
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Légende */}
      <div className="flex items-center gap-4 px-5 py-2 bg-slate-50 border-b border-slate-100 text-xs text-slate-500 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 inline-block" />
          Tâche
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-400 inline-block" />
          Livraison de matériaux
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-200 border border-slate-300 inline-block" />
          N/A — non applicable
        </div>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {SCHEDULE_TEMPLATE.map(cat => (
          <div key={cat.key} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Catégorie header */}
            <button
              onClick={() => toggleCat(cat.key)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 text-white hover:bg-slate-700 transition-colors"
            >
              <span className="font-semibold text-sm">{cat.emoji} {cat.label}</span>
              {expandedCats[cat.key] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {expandedCats[cat.key] && (
              <div className="divide-y divide-slate-100">
                {cat.items.map(item => {
                  const entry = getEntry(cat.key, item.key);
                  const isDelivery = item.type === 'delivery';
                  const isActive = entry.status === 'active';
                  const isNA = entry.status === 'na';

                  return (
                    <div key={item.key}
                      className={`px-4 py-3 transition-colors
                        ${isNA ? 'bg-slate-50 opacity-50' : isActive ? (isDelivery ? 'bg-yellow-50' : 'bg-blue-50/40') : 'bg-white'}`}>
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Icône type */}
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                          ${isDelivery ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>
                          {isDelivery ? <Truck className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                        </div>

                        {/* Nom tâche */}
                        <span className={`font-medium text-sm flex-1 min-w-[120px] ${isNA ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {item.label}
                        </span>

                        {/* Boutons ✅ / N/A */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => setEntry(cat.key, item.key, { status: isActive ? 'pending' : 'active' })}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors
                              ${isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-300 hover:border-blue-400 hover:text-blue-600'}`}
                          >
                            ✅
                          </button>
                          <button
                            onClick={() => setEntry(cat.key, item.key, { status: isNA ? 'pending' : 'na' })}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors
                              ${isNA ? 'bg-slate-500 text-white border-slate-500' : 'bg-white text-slate-400 border-slate-300 hover:border-slate-500 hover:text-slate-600'}`}
                          >
                            N/A
                          </button>
                        </div>

                        {/* Dates + entrepreneur — seulement si active */}
                        {isActive && (
                          <>
                            <MiniDatePicker
                              label="Début"
                              value={entry.startDate}
                              onChange={v => setEntry(cat.key, item.key, {
                                startDate: v,
                                endDate: entry.endDate < v ? v : entry.endDate,
                              })}
                            />
                            <span className="text-slate-400 text-xs">→</span>
                            <MiniDatePicker
                              label="Fin"
                              value={entry.endDate}
                              onChange={v => setEntry(cat.key, item.key, { endDate: v })}
                            />
                            <select
                              value={entry.supplierId}
                              onChange={e => setEntry(cat.key, item.key, { supplierId: e.target.value })}
                              className={`text-xs border rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 transition-colors
                                ${entry.supplierId ? 'bg-green-50 border-green-300 text-green-800' : 'bg-white border-slate-300 text-slate-500'}`}
                            >
                              <option value="">Entrepreneur...</option>
                              {[...suppliers].sort((a,b) => a.name.localeCompare(b.name, 'fr')).map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                            {/* Indicateur complet / incomplet */}
                            {entry.startDate && entry.endDate && entry.supplierId
                              ? <span className="text-green-500 text-xs">✓</span>
                              : <span className="text-amber-500 text-xs">⚠</span>
                            }
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer summary */}
      <div className="flex-shrink-0 px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <span>
          {activeEntries.length} sélectionnée{activeEntries.length !== 1 ? 's' : ''} · {' '}
          {readyToGenerate.length} prête{readyToGenerate.length !== 1 ? 's' : ''} · {' '}
          {Object.values(entries).filter(e => e.status === 'na').length} N/A
        </span>
        {readyToGenerate.length > 0 && (
          <button
            onClick={handleGenerate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium text-sm transition-colors"
          >
            📅 Générer {readyToGenerate.length} tâche{readyToGenerate.length > 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  );
};
