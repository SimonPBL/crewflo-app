import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { getSupabase } from '../services/supabase';
import { CheckSquare, Square, Search, ChevronDown, ChevronUp, Loader2, WifiOff } from 'lucide-react';

type FinishingItem = {
  id: string;
  category: string;
  label: string;
  sort_order: number;
};

type ProjectFinishing = {
  id: string;
  project_id: string;
  item_id: string;
  checked: boolean;
  notes: string;
};

type Row = FinishingItem & {
  checked: boolean;
  notes: string;
};

interface Props {
  projectId: string;
  canEdit: boolean;
}

export const ProjectFinishingsPanel: React.FC<Props> = ({ projectId, canEdit }) => {
  const supabase = getSupabase();
  const [items, setItems] = useState<FinishingItem[]>([]);
  const [values, setValues] = useState<ProjectFinishing[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    const { data: itemsData, error: itemsErr } = await supabase
      .from('finishing_items')
      .select('id, category, label, sort_order')
      .eq('is_active', true)
      .order('category').order('sort_order').order('label');

    if (itemsErr) { setError('Impossible de charger les finitions.'); setLoading(false); return; }

    const { data: valsData, error: valsErr } = await supabase
      .from('project_finishings')
      .select('id, project_id, item_id, checked, notes')
      .eq('project_id', projectId);

    if (valsErr) { setError('Impossible de charger les valeurs.'); setLoading(false); return; }

    setItems(itemsData || []);
    setValues(valsData || []);
    setLoading(false);
  }, [projectId, supabase]);

  useEffect(() => { load(); }, [load]);

  // Realtime sync
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase.channel(`finishings_${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_finishings', filter: `project_id=eq.${projectId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, supabase, load]);

  const upsert = async (itemId: string, patch: Partial<Pick<ProjectFinishing, 'checked' | 'notes'>>) => {
    if (!canEdit || !supabase) return;
    setSavingId(itemId);
    const existing = values.find(v => v.item_id === itemId);
    const payload = {
      project_id: projectId,
      item_id: itemId,
      checked: patch.checked ?? existing?.checked ?? false,
      notes: patch.notes ?? existing?.notes ?? '',
    };
    await supabase.from('project_finishings').upsert(payload, { onConflict: 'project_id,item_id' });
    setSavingId(null);
  };

  const rows: Row[] = useMemo(() => {
    const map = new Map(values.map(v => [v.item_id, v]));
    return items.map(it => ({
      ...it,
      checked: map.get(it.id)?.checked ?? false,
      notes: map.get(it.id)?.notes ?? '',
    }));
  }, [items, values]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter(r => r.label.toLowerCase().includes(s) || r.category.toLowerCase().includes(s) || r.notes.toLowerCase().includes(s));
  }, [rows, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of filtered) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Stats globales
  const totalChecked = rows.filter(r => r.checked).length;
  const totalItems = rows.length;
  const pct = totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0;

  if (!supabase) return (
    <div className="p-6 text-center text-slate-500 flex flex-col items-center gap-2">
      <WifiOff className="w-8 h-8 text-slate-300" />
      <p className="text-sm">Connexion Supabase requise pour les finitions.</p>
    </div>
  );

  if (loading) return (
    <div className="p-6 flex items-center justify-center gap-2 text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin" /> Chargement...
    </div>
  );

  if (error) return (
    <div className="p-6 text-center text-red-500 text-sm">{error}</div>
  );

  return (
    <div className="flex flex-col">
      {/* Header stats */}
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        {!canEdit && (
          <div className="mb-3 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-2">
            Lecture seule — les finitions sont gérées par l'admin.
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">{totalChecked} / {totalItems} confirmés</span>
          <span className="text-sm font-bold text-blue-600">{pct}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Recherche */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une finition..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-400"
          />
        </div>
      </div>

      {/* Liste par catégorie */}
      <div className="p-4 space-y-3">
        {grouped.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">Aucun résultat pour "{search}"</div>
        )}

        {grouped.map(([cat, list]) => {
          const catChecked = list.filter(r => r.checked).length;
          const isOpen = !collapsed[cat];

          return (
            <div key={cat} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              {/* Header catégorie */}
              <button
                onClick={() => setCollapsed(p => ({ ...p, [cat]: !p[cat] }))}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-200"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-800">{cat}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${catChecked === list.length ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                    {catChecked}/{list.length}
                  </span>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {/* Items */}
              {isOpen && (
                <div className="divide-y divide-slate-100">
                  {list.map(r => (
                    <div key={r.id} className={`p-3 flex gap-3 items-start transition-colors ${r.checked ? 'bg-green-50' : 'bg-white'}`}>
                      {/* Checkbox */}
                      <button
                        disabled={!canEdit}
                        onClick={() => {
                          const newChecked = !r.checked;
                          setValues(prev => {
                            const ex = prev.find(v => v.item_id === r.id);
                            if (!ex) return [...prev, { id: crypto.randomUUID(), project_id: projectId, item_id: r.id, checked: newChecked, notes: '' }];
                            return prev.map(v => v.item_id === r.id ? { ...v, checked: newChecked } : v);
                          });
                          upsert(r.id, { checked: newChecked });
                        }}
                        className={`mt-0.5 flex-shrink-0 ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        {r.checked
                          ? <CheckSquare className="w-5 h-5 text-green-600" />
                          : <Square className="w-5 h-5 text-slate-300" />
                        }
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${r.checked ? 'text-green-800' : 'text-slate-800'}`}>
                          {r.label}
                        </div>
                        <textarea
                          className={`mt-2 w-full p-2 text-sm border rounded-lg outline-none resize-none transition-colors
                            ${canEdit ? 'bg-white border-slate-200 focus:border-blue-400' : 'bg-transparent border-transparent text-slate-500 cursor-default'}
                            ${r.notes ? 'min-h-[56px]' : 'min-h-[36px]'}`}
                          placeholder={canEdit ? 'Modèle, couleur, format, code produit...' : '—'}
                          value={r.notes}
                          disabled={!canEdit}
                          rows={1}
                          onChange={e => {
                            const val = e.target.value;
                            setValues(prev => {
                              const ex = prev.find(v => v.item_id === r.id);
                              if (!ex) return [...prev, { id: crypto.randomUUID(), project_id: projectId, item_id: r.id, checked: r.checked, notes: val }];
                              return prev.map(v => v.item_id === r.id ? { ...v, notes: val } : v);
                            });
                          }}
                          onBlur={e => upsert(r.id, { notes: e.target.value })}
                        />
                        {savingId === r.id && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Sauvegarde...
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {canEdit && (
          <p className="text-center text-xs text-slate-400 pt-2 pb-4">
            Pour ajouter une case : Supabase → Table Editor → finishing_items → Insert row
          </p>
        )}
      </div>
    </div>
  );
};
