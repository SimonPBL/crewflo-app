import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabase, getSupabaseConfig } from '../services/supabase';
import { FINISHING_TEMPLATE, CategoryDef, AreaDef } from './finishingTemplate';
import {
  ChevronDown, ChevronUp, Loader2, WifiOff,
  Check, X, Plus, Search,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type AreaValue = {
  confirmed: boolean;
  selectedMaterial: string;
  selectedMaterials: string[];              // multi-select matériaux
  materialPresets: Record<string, string[]>;
  customMatPresets: Record<string, string[]>; // options custom par matériau
  presets: string[];
  customPresets: string[];
  model: string;
  color: string;
  notes: string;
};

type RoomValue = {
  confirmed: boolean;
  areas: Record<string, AreaValue>;
};

type FinishingData = Record<string, Record<string, RoomValue>>;

const defaultArea = (): AreaValue => ({
  confirmed: false,
  selectedMaterial: '',
  selectedMaterials: [],
  materialPresets: {},
  customMatPresets: {},
  presets: [],
  customPresets: [],
  model: '',
  color: '',
  notes: '',
});

const defaultRoom = (): RoomValue => ({ confirmed: false, areas: {} });

// ── Helpers ──────────────────────────────────────────────────────────────────

function getRoom(data: FinishingData, cat: string, room: string): RoomValue {
  return data[cat]?.[room] ?? defaultRoom();
}
function getArea(data: FinishingData, cat: string, room: string, area: string): AreaValue {
  return data[cat]?.[room]?.areas?.[area] ?? defaultArea();
}
function setRoom(data: FinishingData, cat: string, room: string, val: RoomValue): FinishingData {
  return { ...data, [cat]: { ...data[cat], [room]: val } };
}
function setArea(data: FinishingData, cat: string, room: string, area: string, val: AreaValue): FinishingData {
  const r = getRoom(data, cat, room);
  return setRoom(data, cat, room, { ...r, areas: { ...r.areas, [area]: val } });
}

// ── Types mis à jour ─────────────────────────────────────────────────────────

// Composant inline pour ajouter une option custom
interface AddCustomProps {
  onAdd: (val: string) => void;
  placeholder?: string;
}
const AddCustomInline: React.FC<AddCustomProps> = ({ onAdd, placeholder = 'Ex: option personnalisée...' }) => {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState('');
  const confirm = () => { if (val.trim()) { onAdd(val.trim()); setVal(''); setOpen(false); } };
  if (!open) return (
    <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium mt-1">
      <Plus className="w-3 h-3" /> Ajouter une option
    </button>
  );
  return (
    <div className="flex gap-2 items-center mt-1">
      <input autoFocus type="text" value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') { setOpen(false); setVal(''); } }}
        placeholder={placeholder}
        className="flex-1 p-1.5 text-xs border border-blue-300 rounded-lg outline-none focus:border-blue-500 bg-white"
      />
      <button onClick={confirm} disabled={!val.trim()} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => { setOpen(false); setVal(''); }} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// ── Composant détails d'une zone ─────────────────────────────────────────────

interface AreaDetailProps {
  area: AreaDef;
  value: AreaValue;
  canEdit: boolean;
  onChange: (v: AreaValue) => void;
}

const AreaDetail: React.FC<AreaDetailProps> = ({ area, value, canEdit, onChange }) => {

  const togglePreset = (preset: string) => {
    if (!canEdit) return;
    const next = value.presets.includes(preset)
      ? value.presets.filter(p => p !== preset)
      : [...value.presets, preset];
    onChange({ ...value, presets: next });
  };

  const toggleMatPreset = (matKey: string, preset: string) => {
    if (!canEdit) return;
    const current = value.materialPresets[matKey] ?? [];
    const next = current.includes(preset)
      ? current.filter(p => p !== preset)
      : [...current, preset];
    onChange({ ...value, materialPresets: { ...value.materialPresets, [matKey]: next } });
  };

  const toggleMaterial = (matKey: string) => {
    if (!canEdit) return;
    const current = value.selectedMaterials ?? [];
    const next = current.includes(matKey)
      ? current.filter(k => k !== matKey)
      : [...current, matKey];
    onChange({ ...value, selectedMaterials: next, selectedMaterial: next[0] ?? '' });
  };

  const selectedMaterials = value.selectedMaterials ?? [];
  const customMatPresets  = value.customMatPresets ?? {};

  const addCustomMatPreset = (matKey: string, preset: string) => {
    const current = customMatPresets[matKey] ?? [];
    onChange({ ...value, customMatPresets: { ...customMatPresets, [matKey]: [...current, preset] } });
  };

  const removeCustomMatPreset = (matKey: string, preset: string) => {
    const nextCustom = (customMatPresets[matKey] ?? []).filter(p => p !== preset);
    const nextSelected = (value.materialPresets[matKey] ?? []).filter(p => p !== preset);
    onChange({
      ...value,
      customMatPresets: { ...customMatPresets, [matKey]: nextCustom },
      materialPresets: { ...value.materialPresets, [matKey]: nextSelected },
    });
  };

  const addCustomPreset = (preset: string) => {
    onChange({ ...value, customPresets: [...(value.customPresets ?? []), preset] });
  };

  const removeCustomPreset = (preset: string) => {
    onChange({
      ...value,
      customPresets: (value.customPresets ?? []).filter(p => p !== preset),
      presets: value.presets.filter(p => p !== preset),
    });
  };

  const allSimplePresets = [...(area.presets ?? []), ...(value.customPresets ?? [])];

  return (
    <div className="pl-2 space-y-3">
      {/* Cas 1 : Choix de matériau */}
      {area.materialChoices && area.materialChoices.length > 0 && (
        <div className="space-y-2">
          {area.materialChoices.map(mat => {
            const isSelected = selectedMaterials.includes(mat.key);
            const matPresets = value.materialPresets[mat.key] ?? [];
            const allMatPresets = [...mat.presets, ...(customMatPresets[mat.key] ?? [])];

            return (
              <div key={mat.key} className={`rounded-xl border transition-all ${isSelected ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                {/* Bouton sélection matériau */}
                <button
                  disabled={!canEdit}
                  onClick={() => toggleMaterial(mat.key)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-xl transition-colors ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </span>
                  {mat.label}
                </button>

                {/* Presets + custom si matériau sélectionné */}
                {isSelected && (
                  <div className="px-3 pb-3 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {allMatPresets.map(p => (
                        <div key={p} className="relative group">
                          <button
                            disabled={!canEdit}
                            onClick={() => toggleMatPreset(mat.key, p)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                              ${matPresets.includes(p) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}
                          >
                            {matPresets.includes(p) && '✓ '}{p}
                          </button>
                          {/* Supprimer custom */}
                          {canEdit && (customMatPresets[mat.key] ?? []).includes(p) && (
                            <button
                              onClick={() => removeCustomMatPreset(mat.key, p)}
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full hidden group-hover:flex items-center justify-center"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Bouton + pour ce matériau */}
                    {canEdit && (
                      <AddCustomInline
                        onAdd={p => addCustomMatPreset(mat.key, p)}
                        placeholder="Ex: Acacia, Chêne fumé..."
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cas 2 : Presets simples */}
      {!area.materialChoices && allSimplePresets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allSimplePresets.map(p => (
            <div key={p} className="relative group">
              <button
                disabled={!canEdit}
                onClick={() => togglePreset(p)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                  ${value.presets.includes(p) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}
              >
                {value.presets.includes(p) && '✓ '}{p}
              </button>
              {canEdit && (value.customPresets ?? []).includes(p) && (
                <button
                  onClick={() => removeCustomPreset(p)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full hidden group-hover:flex items-center justify-center"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bouton + Ajouter option pour presets simples */}
      {canEdit && !area.materialChoices && (
        <AddCustomInline onAdd={addCustomPreset} placeholder="Ex: 18x18, Travertin..." />
      )}

      {/* Champs Modèle / Couleur / Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
        {[
          { key: 'model', label: 'Modèle / No produit', placeholder: 'Ex: MSI-2241-R' },
          { key: 'color', label: 'Couleur / Fini',      placeholder: 'Ex: Blanc mat' },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{f.label}</label>
            <input
              type="text" disabled={!canEdit}
              defaultValue={(value as any)[f.key]}
              placeholder={canEdit ? f.placeholder : '—'}
              onBlur={e => onChange({ ...value, [f.key]: e.target.value })}
              className={`w-full p-1.5 text-sm border rounded-lg outline-none transition-colors ${canEdit ? 'bg-white border-slate-200 focus:border-blue-400' : 'bg-transparent border-transparent text-slate-600 cursor-default'}`}
            />
          </div>
        ))}
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Notes</label>
          <input
            type="text" disabled={!canEdit}
            defaultValue={value.notes}
            placeholder={canEdit ? 'Informations supplémentaires...' : '—'}
            onBlur={e => onChange({ ...value, notes: e.target.value })}
            className={`w-full p-1.5 text-sm border rounded-lg outline-none transition-colors ${canEdit ? 'bg-white border-slate-200 focus:border-blue-400' : 'bg-transparent border-transparent text-slate-600 cursor-default'}`}
          />
        </div>
      </div>
    </div>
  );
};

// ── Composant principal ───────────────────────────────────────────────────────

interface Props {
  projectId: string;
  canEdit: boolean;
}

export const ProjectFinishingsPanel: React.FC<Props> = ({ projectId, canEdit }) => {
  const supabase = getSupabase();
  const { companyId } = getSupabaseConfig();

  const [data, setData] = useState<FinishingData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Charger ────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data: row, error: err } = await supabase
      .from('project_finishing_data')
      .select('data')
      .eq('project_id', projectId)
      .eq('company_id', companyId || 'default')
      .single();

    if (err && err.code !== 'PGRST116') { setError('Erreur de chargement.'); }
    else if (row?.data) { setData(row.data as FinishingData); }
    setLoading(false);
  }, [projectId, companyId, supabase]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase.channel(`fin_v2_${projectId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'project_finishing_data',
        filter: `project_id=eq.${projectId}`,
      }, payload => {
        if ((payload.new as any)?.data) setData((payload.new as any).data);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, supabase]);

  // ── Sauvegarder (debounce 800ms) ───────────────────────────────────────────

  const save = useCallback(async (newData: FinishingData) => {
    if (!supabase || !canEdit) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      await supabase.from('project_finishing_data').upsert({
        project_id: projectId,
        company_id: companyId || 'default',
        data: newData,
      }, { onConflict: 'project_id,company_id' });
      setSaving(false);
    }, 800);
  }, [supabase, canEdit, projectId, companyId]);

  const update = (newData: FinishingData) => {
    setData(newData);
    save(newData);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalRooms = FINISHING_TEMPLATE.reduce((s, cat) => s + cat.rooms.length, 0);
  const confirmedRooms = FINISHING_TEMPLATE.reduce((s, cat) =>
    s + cat.rooms.filter(r => getRoom(data, cat.key, r.key).confirmed).length, 0);
  const pct = totalRooms > 0 ? Math.round((confirmedRooms / totalRooms) * 100) : 0;

  // ── Recherche ──────────────────────────────────────────────────────────────

  const filterCats = (cats: CategoryDef[]): CategoryDef[] => {
    if (!search.trim()) return cats;
    const s = search.toLowerCase();
    return cats.map(cat => ({
      ...cat,
      rooms: cat.rooms.filter(r =>
        cat.label.toLowerCase().includes(s) ||
        r.label.toLowerCase().includes(s) ||
        r.areas.some(a => a.label.toLowerCase().includes(s))
      ),
    })).filter(c => c.rooms.length > 0);
  };

  const visibleCats = filterCats(FINISHING_TEMPLATE);

  // ── Rendu ──────────────────────────────────────────────────────────────────

  if (!supabase) return (
    <div className="p-6 text-center text-slate-500 flex flex-col items-center gap-2">
      <WifiOff className="w-8 h-8 text-slate-300" />
      <p className="text-sm">Connexion Supabase requise.</p>
    </div>
  );

  if (loading) return (
    <div className="p-6 flex items-center justify-center gap-2 text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin" /> Chargement...
    </div>
  );

  return (
    <div>
      {/* Barre de progression */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 bg-slate-50">
        {!canEdit && (
          <div className="mb-3 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-2">
            Lecture seule
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">{confirmedRooms} / {totalRooms} sections confirmées</span>
          <div className="flex items-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
            <span className="text-sm font-bold text-blue-600">{pct}%</span>
          </div>
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
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une section..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-400"
          />
        </div>
      </div>

      {/* Catégories */}
      <div className="p-4 space-y-3">
        {error && <div className="text-red-500 text-sm text-center">{error}</div>}

        {visibleCats.map(cat => {
          const isOpen = !collapsed[cat.key];
          const catConfirmed = cat.rooms.filter(r => getRoom(data, cat.key, r.key).confirmed).length;

          return (
            <div key={cat.key} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">

              {/* Header catégorie */}
              <button
                onClick={() => setCollapsed(p => ({ ...p, [cat.key]: !p[cat.key] }))}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-200"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{cat.emoji}</span>
                  <span className="font-bold text-sm text-slate-800">{cat.label}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${catConfirmed === cat.rooms.length ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                    {catConfirmed}/{cat.rooms.length}
                  </span>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {/* Rooms de la catégorie */}
              {isOpen && (
                <div className="divide-y divide-slate-100">
                  {cat.rooms.map(room => {
                    const roomVal = getRoom(data, cat.key, room.key);

                    return (
                      <div key={room.key} className={`p-3 ${roomVal.confirmed ? 'bg-green-50' : 'bg-white'}`}>

                        {/* Ligne room : label + OUI/NON */}
                        <div className="flex items-center justify-between gap-3">
                          <span className={`text-sm font-bold ${roomVal.confirmed ? 'text-green-800' : 'text-slate-800'}`}>
                            {room.label}
                          </span>
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              disabled={!canEdit}
                              onClick={() => {
                                if (!roomVal.confirmed) {
                                  update(setRoom(data, cat.key, room.key, { ...roomVal, confirmed: true }));
                                }
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors
                                ${roomVal.confirmed ? 'bg-green-600 text-white border-green-600'
                                  : canEdit ? 'bg-white text-slate-500 border-slate-200 hover:border-green-400 hover:text-green-600'
                                  : 'bg-white text-slate-300 border-slate-100 cursor-default'}`}
                            >
                              ✓ Oui
                            </button>
                            <button
                              disabled={!canEdit}
                              onClick={() => {
                                if (roomVal.confirmed) {
                                  update(setRoom(data, cat.key, room.key, { ...roomVal, confirmed: false }));
                                }
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors
                                ${!roomVal.confirmed ? 'bg-slate-400 text-white border-slate-400'
                                  : canEdit ? 'bg-white text-slate-500 border-slate-200 hover:border-red-300 hover:text-red-500'
                                  : 'bg-white text-slate-300 border-slate-100 cursor-default'}`}
                            >
                              ✗ Non
                            </button>
                          </div>
                        </div>

                        {/* Areas (visibles si room = OUI) */}
                        {roomVal.confirmed && (
                          <div className="mt-3 ml-2 space-y-2">
                            {room.areas.map(area => {
                              const areaVal = getArea(data, cat.key, room.key, area.key);

                              // Cas noYesNo : juste un champ texte
                              if (area.noYesNo) {
                                return (
                                  <div key={area.key} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                    <label className="block text-xs font-bold text-slate-600 mb-2">{area.label}</label>
                                    <textarea
                                      disabled={!canEdit}
                                      rows={2}
                                      defaultValue={areaVal.notes}
                                      placeholder={canEdit ? 'Écrire ici...' : '—'}
                                      onBlur={e => update(setArea(data, cat.key, room.key, area.key, { ...areaVal, notes: e.target.value }))}
                                      className={`w-full p-2 text-sm border rounded-lg outline-none resize-none transition-colors ${canEdit ? 'bg-white border-slate-200 focus:border-blue-400' : 'bg-transparent border-transparent text-slate-600 cursor-default'}`}
                                    />
                                  </div>
                                );
                              }

                              // Cas normal : OUI/NON + détails
                              return (
                                <div key={area.key} className={`rounded-xl border transition-all ${areaVal.confirmed ? 'bg-white border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                                  {/* Header area */}
                                  <div className="flex items-center justify-between px-3 py-2">
                                    <span className={`text-sm font-semibold ${areaVal.confirmed ? 'text-blue-800' : 'text-slate-600'}`}>
                                      {area.label}
                                    </span>
                                    <div className="flex gap-1 flex-shrink-0">
                                      <button
                                        disabled={!canEdit}
                                        onClick={() => { if (!areaVal.confirmed) update(setArea(data, cat.key, room.key, area.key, { ...areaVal, confirmed: true })); }}
                                        className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border transition-colors
                                          ${areaVal.confirmed ? 'bg-blue-600 text-white border-blue-600'
                                            : canEdit ? 'bg-white text-slate-500 border-slate-200 hover:border-blue-400 hover:text-blue-600'
                                            : 'bg-white text-slate-300 border-slate-100 cursor-default'}`}
                                      >
                                        ✓ Oui
                                      </button>
                                      <button
                                        disabled={!canEdit}
                                        onClick={() => { if (areaVal.confirmed) update(setArea(data, cat.key, room.key, area.key, { ...areaVal, confirmed: false })); }}
                                        className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border transition-colors
                                          ${!areaVal.confirmed ? 'bg-slate-400 text-white border-slate-400'
                                            : canEdit ? 'bg-white text-slate-500 border-slate-200 hover:border-red-300 hover:text-red-500'
                                            : 'bg-white text-slate-300 border-slate-100 cursor-default'}`}
                                      >
                                        ✗ Non
                                      </button>
                                    </div>
                                  </div>

                                  {/* Détails area (si OUI) */}
                                  {areaVal.confirmed && (
                                    <div className="px-3 pb-3">
                                      <AreaDetail
                                        area={area}
                                        value={areaVal}
                                        canEdit={canEdit}
                                        onChange={v => update(setArea(data, cat.key, room.key, area.key, v))}
                                      />
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
