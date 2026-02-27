import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { getSupabase } from '../services/supabase';
import {
  Search, ChevronDown, ChevronUp, Loader2, WifiOff,
  CheckSquare, Square, Plus, X, Check,
} from 'lucide-react';

type FinishingItem = { id: string; category: string; label: string; sort_order: number; };
type FinishingSubitem = { id: string; item_id: string; label: string; sort_order: number; };
type ProjectFinishing = { id: string; project_id: string; item_id: string; checked: boolean; notes: string; };
type ProjectSubfinishing = { id: string; project_id: string; subitem_id: string; checked: boolean; model: string; color: string; format: string; notes: string; };

interface SubDetailProps {
  value: ProjectSubfinishing;
  canEdit: boolean;
  onSave: (patch: Partial<Omit<ProjectSubfinishing, 'id' | 'project_id' | 'subitem_id'>>) => void;
}

const SubDetail: React.FC<SubDetailProps> = ({ value, canEdit, onSave }) => {
  const field = (label: string, key: 'model' | 'color' | 'format' | 'notes', placeholder: string) => (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</label>
      <input
        type="text"
        disabled={!canEdit}
        defaultValue={(value as any)[key]}
        placeholder={canEdit ? placeholder : '—'}
        onBlur={e => onSave({ [key]: e.target.value })}
        className={`w-full p-1.5 text-sm border rounded-lg outline-none transition-colors ${canEdit ? 'bg-white border-slate-200 focus:border-blue-400' : 'bg-transparent border-transparent text-slate-600 cursor-default'}`}
      />
    </div>
  );
  return (
    <div className="mt-2 ml-1 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
      {field('Modèle / No produit', 'model', 'Ex: STO-2241')}
      {field('Couleur', 'color', 'Ex: Blanc mat')}
      {field('Format / Dimension', 'format', 'Ex: 12"x24"')}
      <div className="sm:col-span-2">{field('Notes', 'notes', 'Informations supplémentaires...')}</div>
    </div>
  );
};

interface Props { projectId: string; canEdit: boolean; }

export const ProjectFinishingsPanel: React.FC<Props> = ({ projectId, canEdit }) => {
  const supabase = getSupabase();
  const [items, setItems] = useState<FinishingItem[]>([]);
  const [subitems, setSubitems] = useState<FinishingSubitem[]>([]);
  const [values, setValues] = useState<ProjectFinishing[]>([]);
  const [subvalues, setSubvalues] = useState<ProjectSubfinishing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [newSubLabel, setNewSubLabel] = useState('');
  const [addingLoading, setAddingLoading] = useState(false);
  const [savingMain, setSavingMain] = useState<string | null>(null);
  const [savingSub, setSavingSub] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true); setError(null);
    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from('finishing_items').select('id,category,label,sort_order').eq('is_active', true).order('category').order('sort_order').order('label'),
      supabase.from('finishing_subitems').select('id,item_id,label,sort_order').order('sort_order').order('label'),
      supabase.from('project_finishings').select('id,project_id,item_id,checked,notes').eq('project_id', projectId),
      supabase.from('project_subfinishings').select('id,project_id,subitem_id,checked,model,color,format,notes').eq('project_id', projectId),
    ]);
    if (r1.error || r2.error) { setError('Impossible de charger les finitions.'); setLoading(false); return; }
    setItems(r1.data || []); setSubitems(r2.data || []); setValues(r3.data || []); setSubvalues(r4.data || []);
    setLoading(false);
  }, [projectId, supabase]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!supabase) return;
    const ch = supabase.channel(`fin_${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_finishings', filter: `project_id=eq.${projectId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_subfinishings', filter: `project_id=eq.${projectId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finishing_subitems' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, supabase, load]);

  const getMainVal = (itemId: string) => values.find(v => v.item_id === itemId);
  const getSubVal = (subitemId: string) => subvalues.find(v => v.subitem_id === subitemId);
  const isOui = (itemId: string) => getMainVal(itemId)?.checked ?? false;

  const toggleMain = async (itemId: string) => {
    if (!canEdit || !supabase) return;
    const newVal = !isOui(itemId);
    setValues(prev => { const ex = prev.find(v => v.item_id === itemId); if (!ex) return [...prev, { id: crypto.randomUUID(), project_id: projectId, item_id: itemId, checked: newVal, notes: '' }]; return prev.map(v => v.item_id === itemId ? { ...v, checked: newVal } : v); });
    setSavingMain(itemId);
    await supabase.from('project_finishings').upsert({ project_id: projectId, item_id: itemId, checked: newVal, notes: getMainVal(itemId)?.notes ?? '' }, { onConflict: 'project_id,item_id' });
    setSavingMain(null);
  };

  const toggleSub = async (subitemId: string) => {
    if (!canEdit || !supabase) return;
    const current = getSubVal(subitemId)?.checked ?? false;
    const newVal = !current;
    setSubvalues(prev => { const ex = prev.find(v => v.subitem_id === subitemId); if (!ex) return [...prev, { id: crypto.randomUUID(), project_id: projectId, subitem_id: subitemId, checked: newVal, model: '', color: '', format: '', notes: '' }]; return prev.map(v => v.subitem_id === subitemId ? { ...v, checked: newVal } : v); });
    setSavingSub(subitemId);
    const ex = getSubVal(subitemId);
    await supabase.from('project_subfinishings').upsert({ project_id: projectId, subitem_id: subitemId, checked: newVal, model: ex?.model ?? '', color: ex?.color ?? '', format: ex?.format ?? '', notes: ex?.notes ?? '' }, { onConflict: 'project_id,subitem_id' });
    setSavingSub(null);
  };

  const saveSubDetail = async (subitemId: string, patch: any) => {
    if (!canEdit || !supabase) return;
    setSubvalues(prev => prev.map(v => v.subitem_id === subitemId ? { ...v, ...patch } : v));
    const ex = getSubVal(subitemId);
    await supabase.from('project_subfinishings').upsert({ project_id: projectId, subitem_id: subitemId, checked: ex?.checked ?? false, model: ex?.model ?? '', color: ex?.color ?? '', format: ex?.format ?? '', notes: ex?.notes ?? '', ...patch }, { onConflict: 'project_id,subitem_id' });
  };

  const addSubitem = async (itemId: string) => {
    if (!canEdit || !supabase || !newSubLabel.trim()) return;
    setAddingLoading(true);
    const maxOrder = Math.max(0, ...subitems.filter(s => s.item_id === itemId).map(s => s.sort_order));
    await supabase.from('finishing_subitems').insert({ item_id: itemId, label: newSubLabel.trim(), sort_order: maxOrder + 10 });
    setNewSubLabel(''); setAddingSubFor(null); setAddingLoading(false);
    await load();
  };

  const deleteSubitem = async (subitemId: string) => {
    if (!canEdit || !supabase) return;
    await supabase.from('finishing_subitems').delete().eq('id', subitemId);
    await load();
  };

  const totalOui = values.filter(v => v.checked).length;
  const pct = items.length > 0 ? Math.round((totalOui / items.length) * 100) : 0;

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const s = search.toLowerCase();
    return items.filter(it => it.label.toLowerCase().includes(s) || it.category.toLowerCase().includes(s));
  }, [items, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, FinishingItem[]>();
    for (const it of filtered) { if (!map.has(it.category)) map.set(it.category, []); map.get(it.category)!.push(it); }
    return Array.from(map.entries());
  }, [filtered]);

  if (!supabase) return <div className="p-6 text-center text-slate-500 flex flex-col items-center gap-2"><WifiOff className="w-8 h-8 text-slate-300" /><p className="text-sm">Connexion Supabase requise.</p></div>;
  if (loading) return <div className="p-6 flex items-center justify-center gap-2 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /> Chargement...</div>;
  if (error) return <div className="p-6 text-center text-red-500 text-sm">{error}</div>;

  return (
    <div>
      {/* Stats */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 bg-slate-50">
        {!canEdit && <div className="mb-3 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-2">Lecture seule — les finitions sont gérées par l'admin.</div>}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">{totalOui} / {items.length} confirmés</span>
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
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-400" />
        </div>
      </div>

      {/* Liste */}
      <div className="p-4 space-y-3">
        {grouped.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">Aucun résultat pour "{search}"</div>}

        {grouped.map(([cat, catItems]) => {
          const catOui = catItems.filter(it => isOui(it.id)).length;
          const isOpen = !collapsed[cat];
          return (
            <div key={cat} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <button onClick={() => setCollapsed(p => ({ ...p, [cat]: !p[cat] }))} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-800">{cat}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${catOui === catItems.length ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>{catOui}/{catItems.length}</span>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {isOpen && (
                <div className="divide-y divide-slate-100">
                  {catItems.map(item => {
                    const oui = isOui(item.id);
                    const itemSubitems = subitems.filter(s => s.item_id === item.id);
                    const checkedSubs = itemSubitems.filter(s => getSubVal(s.id)?.checked).length;

                    return (
                      <div key={item.id} className={`p-3 transition-colors ${oui ? 'bg-green-50' : 'bg-white'}`}>
                        {/* Ligne principale */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-semibold ${oui ? 'text-green-800' : 'text-slate-800'}`}>{item.label}</span>
                            {oui && itemSubitems.length > 0 && <span className="ml-2 text-xs text-green-600 font-medium">{checkedSubs}/{itemSubitems.length}</span>}
                          </div>
                          <div className="flex gap-1 flex-shrink-0 items-center">
                            <button disabled={!canEdit} onClick={() => { if (!oui) toggleMain(item.id); }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors border ${oui ? 'bg-green-600 text-white border-green-600' : canEdit ? 'bg-white text-slate-500 border-slate-200 hover:border-green-400 hover:text-green-600' : 'bg-white text-slate-300 border-slate-100 cursor-default'}`}>
                              ✓ Oui
                            </button>
                            <button disabled={!canEdit} onClick={() => { if (oui) toggleMain(item.id); }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors border ${!oui ? 'bg-slate-400 text-white border-slate-400' : canEdit ? 'bg-white text-slate-500 border-slate-200 hover:border-red-300 hover:text-red-500' : 'bg-white text-slate-300 border-slate-100 cursor-default'}`}>
                              ✗ Non
                            </button>
                            {savingMain === item.id && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
                          </div>
                        </div>

                        {/* Sous-choix (seulement si OUI) */}
                        {oui && (
                          <div className="mt-3 ml-2 space-y-2">
                            {itemSubitems.map(sub => {
                              const subVal = getSubVal(sub.id);
                              const subChecked = subVal?.checked ?? false;
                              return (
                                <div key={sub.id} className={`rounded-xl border transition-colors ${subChecked ? 'bg-white border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                                  <div className="flex items-center gap-2 px-3 py-2">
                                    <button disabled={!canEdit} onClick={() => toggleSub(sub.id)} className={canEdit ? 'cursor-pointer flex-shrink-0' : 'cursor-default flex-shrink-0'}>
                                      {subChecked ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-slate-300" />}
                                    </button>
                                    <span className={`flex-1 text-sm ${subChecked ? 'font-semibold text-blue-800' : 'text-slate-600'}`}>{sub.label}</span>
                                    {savingSub === sub.id && <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />}
                                    {canEdit && <button onClick={() => deleteSubitem(sub.id)} className="p-1 text-slate-300 hover:text-red-400 transition-colors rounded"><X className="w-3.5 h-3.5" /></button>}
                                  </div>
                                  {subChecked && subVal && (
                                    <div className="px-3 pb-3">
                                      <SubDetail value={subVal} canEdit={canEdit} onSave={patch => saveSubDetail(sub.id, patch)} />
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Ajouter sous-choix */}
                            {canEdit && (
                              addingSubFor === item.id ? (
                                <div className="flex gap-2 items-center">
                                  <input autoFocus type="text" value={newSubLabel} onChange={e => setNewSubLabel(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') addSubitem(item.id); if (e.key === 'Escape') { setAddingSubFor(null); setNewSubLabel(''); } }}
                                    placeholder="Ex: Chambre principale"
                                    className="flex-1 p-2 text-sm border border-blue-300 rounded-lg outline-none focus:border-blue-500 bg-white" />
                                  <button onClick={() => addSubitem(item.id)} disabled={addingLoading || !newSubLabel.trim()} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                    {addingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                  </button>
                                  <button onClick={() => { setAddingSubFor(null); setNewSubLabel(''); }} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
                                </div>
                              ) : (
                                <button onClick={() => { setAddingSubFor(item.id); setNewSubLabel(''); }} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                                  <Plus className="w-3.5 h-3.5" /> Ajouter un sous-choix
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {canEdit && <p className="text-center text-xs text-slate-400 pt-2 pb-4">Pour ajouter un item : Supabase → finishing_items → Insert row</p>}
      </div>
    </div>
  );
};
