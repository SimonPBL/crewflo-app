import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SCHEDULE_TEMPLATE } from './ScheduleTemplate';
import { Project, Supplier, Task } from '../types';
import { Check, X, ChevronDown, ChevronRight, AlertCircle, Truck, Calendar, Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

type ItemStatus = 'pending' | 'active' | 'na';

interface ScheduleEntry {
  categoryKey: string;
  itemKey: string;
  status: ItemStatus;
  supplierId: string;
  startDate: string;
  endDate: string;
  alreadyInCalendar?: boolean;
}

interface Props {
  project: Project;
  suppliers: Supplier[];
  existingTasks: Task[];
  onGenerateTasks: (tasks: Omit<Task, 'id' | 'createdAt'>[]) => void;
  onRemoveTask: (title: string) => void;
  onClose: () => void;
}

// ── Mini date picker avec position fixed (toujours au-dessus) ──

const MiniDatePicker: React.FC<{
  value: string;
  onChange: (date: string) => void;
  minDate?: string;
}> = ({ value, onChange, minDate }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [viewDate, setViewDate] = useState(() => {
    const d = value ? new Date(value + 'T12:00:00') : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const btnRef = React.useRef<HTMLButtonElement>(null);

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

  const display = value
    ? new Date(value + 'T12:00:00').toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })
    : 'Date...';

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const popupH = 265;
      const spaceBelow = window.innerHeight - r.bottom;
      const topPos = spaceBelow < popupH ? r.top - popupH - 4 : r.bottom + 6;
      setPos({ top: topPos, left: Math.min(r.left, window.innerWidth - 220) });
    }
    setOpen(v => !v);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as Element)?.closest?.('.mini-datepicker-popup')) setOpen(false);
    };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <>
      <button ref={btnRef} type="button" onClick={handleOpen}
        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors
          ${value ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-slate-400 hover:border-slate-400'}`}>
        <Calendar className="w-3 h-3" />
        {display}
      </button>

      {open && (
        <div className="mini-datepicker-popup bg-white border border-slate-200 rounded-xl shadow-2xl p-3" onClick={e => e.stopPropagation()}
          style={{ position:'fixed', top:pos.top, left:pos.left, width:210, zIndex:99999 }}>
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => { const d = new Date(viewDate); d.setMonth(d.getMonth()-1); setViewDate(d); }}
              className="p-1 hover:bg-slate-100 rounded text-slate-600">‹</button>
            <span className="text-xs font-bold text-slate-700 capitalize">
              {viewDate.toLocaleDateString('fr-FR', { month:'long', year:'numeric' })}
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
              const disabled = !!minDate && str < minDate;
              return (
                <button key={i} disabled={disabled}
                  onClick={() => { onChange(str); setOpen(false); }}
                  className={`text-xs rounded py-1 transition-colors font-medium
                    ${disabled ? 'text-slate-200 cursor-not-allowed' :
                      isSelected ? 'bg-blue-600 text-white' :
                      isToday ? 'bg-blue-100 text-blue-700' :
                      'hover:bg-slate-100 text-slate-700'}`}>
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          {value && (
            <button onClick={() => { onChange(''); setOpen(false); }}
              className="mt-1.5 w-full text-[10px] text-slate-400 hover:text-red-500 text-center">Effacer</button>
          )}
        </div>
      )}
    </>
  );
};

// ── Composant principal ───────────────────────────────────────

export const ProjectSchedule: React.FC<Props> = ({
  project, suppliers, existingTasks, onGenerateTasks, onRemoveTask, onClose
}) => {
  const [entries, setEntries] = useState<Record<string, ScheduleEntry>>({});
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>(
    Object.fromEntries(SCHEDULE_TEMPLATE.map(c => [c.key, true]))
  );
  const [generated, setGenerated] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  // Pré-remplir depuis les tâches existantes au chargement
  useEffect(() => {
    const initial: Record<string, ScheduleEntry> = {};
    SCHEDULE_TEMPLATE.forEach(cat => {
      cat.items.forEach(item => {
        const key = `${cat.key}_${item.key}`;
        const match = existingTasks.find(t =>
          t.projectId === project.id && t.title === item.label
        );
        if (match) {
          initial[key] = {
            categoryKey: cat.key, itemKey: item.key, status: 'active',
            supplierId: match.supplierId,
            startDate: match.start.slice(0,10),
            endDate: match.end.slice(0,10),
            alreadyInCalendar: true,
          };
        }
      });
    });
    setEntries(initial);
  }, []); // eslint-disable-line

  const getEntry = (catKey: string, itemKey: string): ScheduleEntry =>
    entries[`${catKey}_${itemKey}`] ?? {
      categoryKey: catKey, itemKey, status:'pending',
      supplierId:'', startDate:'', endDate:'',
    };

  const setEntry = (catKey: string, itemKey: string, patch: Partial<ScheduleEntry>) => {
    const key = `${catKey}_${itemKey}`;
    setEntries(prev => ({ ...prev, [key]: { ...getEntry(catKey, itemKey), ...patch } }));
  };

  const allActive = Object.values(entries).filter(e => e.status === 'active');
  const newActive = allActive.filter(e => !e.alreadyInCalendar);
  const readyToGenerate = newActive.filter(e => e.startDate && e.endDate && e.supplierId);
  const missingInfo = newActive.filter(e => !e.startDate || !e.endDate || !e.supplierId);

  const handleGenerate = () => {
    const newTasks: Omit<Task,'id'|'createdAt'>[] = readyToGenerate.map(entry => {
      const cat = SCHEDULE_TEMPLATE.find(c => c.key === entry.categoryKey)!;
      const item = cat.items.find(i => i.key === entry.itemKey)!;
      return {
        projectId: project.id,
        supplierId: entry.supplierId,
        title: item.label,
        start: new Date(entry.startDate + 'T07:00:00').toISOString(),
        end: new Date(entry.endDate + 'T17:00:00').toISOString(),
        notes: item.type === 'delivery' ? '📦 Livraison' : '',
      };
    });
    onGenerateTasks(newTasks);
    setEntries(prev => {
      const updated = { ...prev };
      readyToGenerate.forEach(e => {
        const key = `${e.categoryKey}_${e.itemKey}`;
        updated[key] = { ...updated[key], alreadyInCalendar: true };
      });
      return updated;
    });
    setGenerated(true);
    setTimeout(() => setGenerated(false), 3000);
  };

  const downloadPDF = async () => {
    if (!pdfRef.current) return;
    setIsExporting(true);
    await new Promise(r => setTimeout(r, 300));
    try {
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        width: 794, // A4-ish width
        windowWidth: 794,
      });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [215.9, 355.6], compress: true }); // legal
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const pW = 215.9;
      const pH = (canvas.height * pW) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pW, pH, undefined, 'FAST');
      const fileName = `Cedule_${project.name.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`;
      pdf.save(fileName);
    } catch(e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
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
              {missingInfo.length} incomplète{missingInfo.length > 1 ? 's' : ''}
            </div>
          )}
          {readyToGenerate.length > 0 && (
            <button onClick={handleGenerate}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm shadow-sm transition-all
                ${generated ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
              {generated
                ? <><Check className="w-4 h-4" /> Générées !</>
                : <>📅 Générer {readyToGenerate.length} tâche{readyToGenerate.length > 1 ? 's' : ''}</>}
            </button>
          )}
          <button onClick={downloadPDF} disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-medium transition-colors">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Légende */}
      <div className="flex items-center gap-4 px-5 py-2 bg-slate-50 border-b border-slate-100 text-xs text-slate-500 flex-shrink-0">
        {[['bg-blue-100 border-blue-300','Tâche'],['bg-yellow-100 border-yellow-400','Livraison'],['bg-green-100 border-green-400','Déjà au calendrier'],['bg-slate-200 border-slate-300','N/A']].map(([cls,lbl])=>(
          <div key={lbl} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded border inline-block ${cls}`} />{lbl}
          </div>
        ))}
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {SCHEDULE_TEMPLATE.map(cat => (
          <div key={cat.key} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
            <button onClick={() => setExpandedCats(p => ({ ...p, [cat.key]: !p[cat.key] }))}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 text-white hover:bg-slate-700 rounded-xl transition-colors">
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
                  const isInCal = !!entry.alreadyInCalendar;

                  return (
                    <div key={item.key}
                      className={`px-4 py-3 transition-colors overflow-visible
                        ${isNA ? 'bg-slate-50 opacity-50' :
                          isInCal ? 'bg-green-50' :
                          isActive ? (isDelivery ? 'bg-yellow-50' : 'bg-blue-50/40') : 'bg-white'}`}>
                      <div className="flex items-center gap-3 flex-wrap overflow-visible">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                          ${isDelivery ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>
                          {isDelivery ? <Truck className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                        </div>

                        <span className={`font-medium text-sm flex-1 min-w-[120px]
                          ${isNA ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {item.label}
                        </span>

                        {isInCal && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-xs text-green-700 bg-green-100 border border-green-300 rounded-full px-2 py-0.5 font-medium">
                              ✓ Au calendrier
                            </span>
                            <button
                              onClick={() => {
                                onRemoveTask(item.label);
                                setEntry(cat.key, item.key, {
                                  status: 'pending', supplierId: '', startDate: '', endDate: '', alreadyInCalendar: false
                                });
                              }}
                              className="w-5 h-5 rounded-full bg-red-100 border border-red-300 text-red-500 hover:bg-red-200 flex items-center justify-center flex-shrink-0"
                              title="Retirer du calendrier et remettre à zéro"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {!isInCal && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button onClick={() => setEntry(cat.key, item.key, { status: isActive ? 'pending' : 'active' })}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors
                                ${isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-300 hover:border-blue-400 hover:text-blue-600'}`}>
                              ✅
                            </button>
                            <button onClick={() => setEntry(cat.key, item.key, { status: isNA ? 'pending' : 'na' })}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors
                                ${isNA ? 'bg-slate-500 text-white border-slate-500' : 'bg-white text-slate-400 border-slate-300 hover:border-slate-500'}`}>
                              N/A
                            </button>
                          </div>
                        )}

                        {isActive && (
                          <>
                            <MiniDatePicker value={entry.startDate}
                              onChange={v => setEntry(cat.key, item.key, {
                                startDate: v,
                                endDate: (!entry.endDate || entry.endDate < v) ? v : entry.endDate,
                              })} />
                            <span className="text-slate-400 text-xs">→</span>
                            <MiniDatePicker value={entry.endDate}
                              minDate={entry.startDate || undefined}
                              onChange={v => setEntry(cat.key, item.key, { endDate: v })} />
                            <select value={entry.supplierId} disabled={isInCal}
                              onChange={e => setEntry(cat.key, item.key, { supplierId: e.target.value })}
                              className={`text-xs border rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500
                                ${entry.supplierId ? 'bg-green-50 border-green-300 text-green-800' : 'bg-white border-slate-300 text-slate-500'}
                                ${isInCal ? 'opacity-60' : ''}`}>
                              <option value="">Entrepreneur...</option>
                              {[...suppliers].sort((a,b)=>a.name.localeCompare(b.name,'fr')).map(s=>(
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                            {!isInCal && (entry.startDate && entry.endDate && entry.supplierId
                              ? <span className="text-green-500 text-xs font-bold">✓</span>
                              : <span className="text-amber-500 text-xs">⚠</span>)}
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

      {/* Footer */}
      <div className="flex-shrink-0 px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <span>
          {allActive.filter(e=>e.alreadyInCalendar).length} au calendrier ·{' '}
          {readyToGenerate.length} à générer ·{' '}
          {Object.values(entries).filter(e=>e.status==='na').length} N/A
        </span>
        {readyToGenerate.length > 0 && (
          <button onClick={handleGenerate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium text-sm">
            📅 Générer {readyToGenerate.length} tâche{readyToGenerate.length > 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
    {/* ── PDF PRINTABLE TEMPLATE (off-screen) ─────────────────── */}
      <div style={{position:'fixed', top:0, left:'-9999px', width:'794px', pointerEvents:'none', zIndex:-1}}>
        <div ref={pdfRef} style={{width:'794px', background:'#fff', fontFamily:'Helvetica, Arial, sans-serif', fontSize:'10px'}}>
          {(() => {
            // Flatten all tasks with their entry data
            const allItems: {label:string, isDelivery:boolean, start:string, end:string, catKey:string}[] = [];
            SCHEDULE_TEMPLATE.filter(cat => cat.key !== 'exterieur').forEach(cat => {
              cat.items.forEach(item => {
                const key = `${cat.key}_${item.key}`;
                const entry = entries[key];
                allItems.push({
                  label: item.label,
                  isDelivery: item.type === 'delivery',
                  start: entry?.startDate || '',
                  end: entry?.endDate || '',
                  catKey: cat.key,
                });
              });
            });
            const extCat = SCHEDULE_TEMPLATE.find(c => c.key === 'exterieur');
            const extItems = extCat ? extCat.items.map(item => {
              const key = `exterieur_${item.key}`;
              const entry = entries[key];
              return { label: item.label, start: entry?.startDate || '', end: entry?.endDate || '' };
            }) : [];

            const SPLIT = Math.ceil(allItems.length / 2);
            const leftItems = allItems.slice(0, SPLIT);
            const rightItems = allItems.slice(SPLIT);
            const ROW_H = 22;
            const COL_W = 375;
            const TW = COL_W * 0.54;
            const DW = COL_W * 0.23;
            const NAVY = '#1a3a5c';
            const HDR_BG = '#2a4a6b';
            const EXT_BG = '#2d4a2d';
            const NOTES_BG = '#3a3a3a';
            const YELLOW = '#fef9c3';
            const YELLOW_D = '#ca8a04';
            const GREY_L = '#f5f7fa';
            const GREY_M = '#d0d0d0';
            const GAP = 18;
            const MARGIN = 18;

            const fmtDate = (d: string) => {
              if (!d) return '';
              const dt = new Date(d + 'T12:00:00');
              return dt.toLocaleDateString('fr-CA', {day:'2-digit', month:'2-digit', year:'2-digit'});
            };

            const renderRow = (label: string, isDelivery: boolean, start: string, end: string, idx: number) => (
              <div key={`${label}-${idx}`} style={{
                display:'flex', height:`${ROW_H}px`,
                background: isDelivery ? YELLOW : idx % 2 === 0 ? GREY_L : '#fff',
                borderBottom:`0.5px solid ${GREY_M}`,
              }}>
                <div style={{width:`${TW}px`, padding:'0 6px', display:'flex', alignItems:'center', borderRight:`0.5px solid ${GREY_M}`, flexShrink:0}}>
                  {isDelivery && (
                    <span style={{width:'8px', height:'8px', borderRadius:'50%', background:YELLOW_D, display:'inline-block', marginRight:'5px', flexShrink:0}} />
                  )}
                  <span style={{fontSize:'8.5px', fontWeight: isDelivery ? 'bold' : 'normal', color: isDelivery ? '#7a5000' : '#1a1a1a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                    {label}
                  </span>
                </div>
                <div style={{width:`${DW}px`, padding:'0 4px', display:'flex', alignItems:'center', justifyContent:'center', borderRight:`0.5px solid ${GREY_M}`, fontSize:'8px', color:'#333', flexShrink:0}}>{fmtDate(start)}</div>
                <div style={{width:`${DW}px`, padding:'0 4px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'8px', color:'#333', flexShrink:0}}>{fmtDate(end)}</div>
              </div>
            );

            const renderColHeader = () => (
              <div style={{display:'flex', height:'22px', background:HDR_BG}}>
                <div style={{width:`${TW}px`, padding:'0 6px', display:'flex', alignItems:'center', color:'#fff', fontSize:'8px', fontWeight:'bold', borderRight:`0.5px solid #456`, flexShrink:0}}>TÂCHE</div>
                <div style={{width:`${DW}px`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'8px', fontWeight:'bold', borderRight:`0.5px solid #456`, flexShrink:0}}>DATE DÉBUT</div>
                <div style={{width:`${DW}px`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'8px', fontWeight:'bold', flexShrink:0}}>DATE FIN</div>
              </div>
            );

            return (
              <div>
                {/* Header */}
                <div style={{background:NAVY, padding:'10px 18px 8px', display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                  <div>
                    <div style={{color:'#fff', fontSize:'17px', fontWeight:'bold', letterSpacing:'0.02em'}}>CÉDULE DE CHANTIER</div>
                    <div style={{color:'#a0b8cc', fontSize:'8.5px', marginTop:'4px', display:'flex', alignItems:'center', gap:'4px'}}>
                      Chantier :
                      <span style={{color:'#fff', borderBottom:'0.5px solid #5a7a9a', paddingBottom:'1px', minWidth:'180px', display:'inline-block', marginLeft:'4px'}}>
                        {project.address || project.name}
                      </span>
                    </div>
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:'5px', marginTop:'2px'}}>
                    <span style={{width:'10px', height:'10px', borderRadius:'50%', background:YELLOW_D, border:`1px solid #a07000`, display:'inline-block'}} />
                    <span style={{color:'#e0c060', fontSize:'7.5px', fontStyle:'italic'}}>= Livraison de matériaux</span>
                  </div>
                </div>

                {/* Two columns */}
                <div style={{display:'flex', margin:`0 ${MARGIN}px`, gap:`${GAP}px`, marginTop:'4px'}}>
                  {/* Left col */}
                  <div style={{width:`${COL_W}px`, border:`0.5px solid ${GREY_M}`, overflow:'hidden'}}>
                    {renderColHeader()}
                    {leftItems.map((item, i) => renderRow(item.label, item.isDelivery, item.start, item.end, i))}
                  </div>
                  {/* Right col */}
                  <div style={{width:`${COL_W}px`, border:`0.5px solid ${GREY_M}`, overflow:'hidden'}}>
                    {renderColHeader()}
                    {rightItems.map((item, i) => renderRow(item.label, item.isDelivery, item.start, item.end, i))}
                  </div>
                </div>

                {/* Travaux extérieurs */}
                {extItems.length > 0 && (
                  <div style={{display:'flex', margin:`6px ${MARGIN}px 0`, gap:`${GAP}px`}}>
                    {[extItems.slice(0, Math.ceil(extItems.length/2)), extItems.slice(Math.ceil(extItems.length/2))].map((half, hi) => (
                      <div key={hi} style={{width:`${COL_W}px`, border:`0.5px solid ${GREY_M}`, overflow:'hidden'}}>
                        <div style={{background:EXT_BG, color:'#fff', fontSize:'7.5px', fontWeight:'bold', padding:'5px 6px'}}>TRAVAUX EXTÉRIEURS — CALENDRIER FLEXIBLE</div>
                        {renderColHeader()}
                        {half.map((item, i) => renderRow(item.label, false, item.start, item.end, i))}
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                <div style={{margin:`6px ${MARGIN}px 0`}}>
                  <div style={{background:NOTES_BG, color:'#fff', fontSize:'7.5px', fontWeight:'bold', padding:'5px 6px'}}>NOTES & TÂCHES SUPPLÉMENTAIRES</div>
                  {[...Array(6)].map((_,i) => (
                    <div key={i} style={{height:'22px', background: i%2===0?GREY_L:'#fff', borderBottom:`0.5px solid ${GREY_M}`, border:`0.5px solid ${GREY_M}`}} />
                  ))}
                </div>

                {/* Footer */}
                <div style={{display:'flex', justifyContent:'space-between', padding:'6px 18px 8px', marginTop:'4px'}}>
                  <span style={{fontSize:'6.5px', color:'#64748b'}}>Habitations PBL  |  CrewFlo  |  Format 8.5×14</span>
                  <span style={{fontSize:'6.5px', color:'#64748b'}}>Fond jaune = Livraison de matériaux</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
};
