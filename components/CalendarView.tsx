import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, Supplier, Task, Conflict } from '../types';
import { ChevronLeft, ChevronRight, Plus, AlertTriangle, Download, Loader2, Mail, Users, Calendar as CalendarIcon, Clock, CheckCircle2, X, MapPin, List, CalendarDays } from 'lucide-react';
import { ConflictAlert } from './ConflictAlert';
import { ProjectSchedule } from './ProjectSchedule';
import { SCHEDULE_TEMPLATE } from './ScheduleTemplate';
import { SwipeToConfirmButton } from './SwipeToConfirmButton';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getSupabase, getSupabaseConfig } from '../services/supabase';
import { FINISHING_TEMPLATE } from './finishingTemplate';

interface CalendarViewProps {
  projects: Project[];
  suppliers: Supplier[];
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  currentProjectId: string | null;
  canEdit: boolean;
  onUpdateSupplierNote?: (taskId: string, note: { text: string; authorName: string; authorId: string; updatedAt: string }) => void;
  supplierSelf?: { id: string; name: string } | null;
  userEmail?: string;
  userRole?: string;
}

// ── Congés CCQ ─────────────────────────────────────────────────
// METTRE À JOUR CHAQUE ANNÉE — Source : https://www.ccq.org/calendrier
// Congés annuels de la construction (industrie de la construction, Québec)
const CCQ_HOLIDAYS: Record<string, string> = {
  // 2026
  '2026-01-01': "Jour de l'An",
  '2026-01-02': "Lendemain du Jour de l'An",
  '2026-04-03': "Vendredi Saint",
  '2026-04-06': "Lundi de Pâques",
  '2026-05-18': "Journée nationale des Patriotes",
  '2026-06-24': "Fête nationale du Québec",
  '2026-07-01': "Fête du Canada",
  '2026-07-20': "Congé CCQ — début vacances construction",
  '2026-07-21': "Congé CCQ",
  '2026-07-22': "Congé CCQ",
  '2026-07-23': "Congé CCQ",
  '2026-07-24': "Congé CCQ",
  '2026-07-27': "Congé CCQ",
  '2026-07-28': "Congé CCQ",
  '2026-07-29': "Congé CCQ",
  '2026-07-30': "Congé CCQ",
  '2026-07-31': "Congé CCQ — fin vacances construction",
  '2026-09-07': "Fête du Travail",
  '2026-10-12': "Action de grâce",
  '2026-12-24': "Veille de Noël",
  '2026-12-25': "Noël",
  '2026-12-26': "Lendemain de Noël",
  '2026-12-27': "Congé CCQ",
  '2026-12-28': "Congé CCQ",
  '2026-12-29': "Congé CCQ",
  '2026-12-30': "Congé CCQ",
  '2026-12-31': "Congé CCQ — fin congés hiver",
  // 2027
  '2027-01-01': "Jour de l'An",
  '2027-03-26': "Vendredi Saint",
  '2027-03-29': "Lundi de Pâques",
  '2027-05-24': "Journée nationale des Patriotes",
  '2027-06-24': "Fête nationale du Québec",
  '2027-07-01': "Fête du Canada",
  '2027-07-19': "Congé CCQ — début vacances construction",
  '2027-07-20': "Congé CCQ",
  '2027-07-21': "Congé CCQ",
  '2027-07-22': "Congé CCQ",
  '2027-07-23': "Congé CCQ",
  '2027-07-26': "Congé CCQ",
  '2027-07-27': "Congé CCQ",
  '2027-07-28': "Congé CCQ",
  '2027-07-29': "Congé CCQ",
  '2027-07-30': "Congé CCQ — fin vacances construction",
  '2027-09-06': "Fête du Travail",
  '2027-10-11': "Action de grâce",
  '2027-12-24': "Veille de Noël",
  '2027-12-25': "Noël",
  '2027-12-26': "Lendemain de Noël",
  '2027-12-27': "Congé CCQ",
  '2027-12-28': "Congé CCQ",
  '2027-12-29': "Congé CCQ",
  '2027-12-30': "Congé CCQ",
  '2027-12-31': "Congé CCQ — fin congés hiver",
};

const getCCQHoliday = (date: Date): string | null => {
  const key = date.toISOString().slice(0, 10);
  return CCQ_HOLIDAYS[key] ?? null;
};
// ────────────────────────────────────────────────────────────────

export const CalendarView: React.FC<CalendarViewProps> = ({
  projects,
  suppliers,
  tasks,
  setTasks,
  currentProjectId,
  canEdit,
  onUpdateSupplierNote,
  supplierSelf,
  userEmail,
  userRole,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [monthsToShow, setMonthsToShow] = useState<number>(1); // 1, 3, 6, 12
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);

  // Modale "Détails du jour" (lecture seule pour fournisseurs)
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [dayModalDate, setDayModalDate] = useState<Date | null>(null);

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedEmailSuppliers, setSelectedEmailSuppliers] = useState<string[]>([]);
  const [isAllDay, setIsAllDay] = useState(true);
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [showNotesSuggestions, setShowNotesSuggestions] = useState(false);
  const [newTask, setNewTask] = useState<Partial<Task>>({});
  const [showNotes, setShowNotes] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [pdfSelectedProject, setPdfSelectedProject] = useState<string>('all');
  const [pdfIncludeTasks, setPdfIncludeTasks] = useState(true);
  const [pdfIncludeFinitions, setPdfIncludeFinitions] = useState(false);
  const [pdfIncludeTaskList, setPdfIncludeTaskList] = useState(true);
  const [finishingsMap, setFinishingsMap] = useState<Record<string, any>>({});
  const [filterSupplierId, setFilterSupplierId] = useState<string>('all');
  const [calendarViewMode, setCalendarViewMode] = useState<'calendar'|'agenda'>('calendar');
  const [weekZoomDate, setWeekZoomDate] = useState<Date | null>(null); // null = mois normal

  // États pour le Drag & Drop de sélection de date (Main View)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Date | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Date | null>(null);

  // État pour le mini-calendrier dans la modale
  const [miniCalendarMonth, setMiniCalendarMonth] = useState(new Date());
  const [selectedTaskDays, setSelectedTaskDays] = useState<Set<number>>(new Set());

  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // Helper pour initialiser la sélection visuelle à partir d'une plage
  const initSelectedDaysFromRange = (startStr?: string, endStr?: string) => {
    const days = new Set<number>();
    if (startStr && endStr) {
        const s = new Date(startStr); s.setHours(0,0,0,0);
        const e = new Date(endStr); e.setHours(0,0,0,0);
        let current = new Date(s);
        while (current <= e) {
            days.add(current.getTime());
            current.setDate(current.getDate() + 1);
        }
    }
    return days;
  };

  // Synchroniser le mini calendrier avec la date de la tâche quand on ouvre la modale
  useEffect(() => {
    if (isModalOpen) setShowNotes(false);
    if (isModalOpen && newTask.start) {
        setMiniCalendarMonth(new Date(newTask.start));
    } else {
        setMiniCalendarMonth(new Date());
    }
  }, [isModalOpen]);

  // Gestion de la fin du drag au niveau global
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (!canEdit) {
        setIsDragging(false);
        setDragStart(null);
        setDragCurrent(null);
        return;
      }
      if (isDragging && dragStart && dragCurrent) {
        setIsDragging(false);
        
        // Calculer la plage finale
        const start = new Date(Math.min(dragStart.getTime(), dragCurrent.getTime()));
        const end = new Date(Math.max(dragStart.getTime(), dragCurrent.getTime()));
        
        // Définir les heures par défaut (07:00 - 17:00)
        start.setHours(7, 0, 0, 0); 
        end.setHours(17, 0, 0, 0); 
        
        const startIso = start.toISOString();
        const endIso = end.toISOString();

        setNewTask({
            projectId: currentProjectId || (projects.length > 0 ? projects[0].id : ''),
            start: startIso,
            end: endIso,
            supplierId: suppliers.length > 0 ? suppliers[0].id : ''
        });
        
        setSelectedTaskDays(initSelectedDaysFromRange(startIso, endIso));
        setEditingTaskId(null);
        setIsViewOnly(false);
        setIsAllDay(true);
        setIsModalOpen(true);
        
        setDragStart(null);
        setDragCurrent(null);
      } else if (isDragging) {
         setIsDragging(false);
         setDragStart(null);
         setDragCurrent(null);
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, dragStart, dragCurrent, currentProjectId, projects, suppliers]);


  // Navigation
  const prevPeriod = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };
  const nextPeriod = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setTimeout(() => scrollToTodayMonth(true), 80);
  };

  // Scroll vers le mois d'aujourd'hui en ciblant SPÉCIFIQUEMENT le conteneur
  // scrollable parent (pas le document) — évite que le header de l'app sorte du viewport.
  function scrollToTodayMonth(smooth: boolean) {
    const today = new Date();
    const key = `${today.getFullYear()}-${today.getMonth()}`;
    const el = document.querySelector(`[data-month-key="${key}"]`) as HTMLElement | null;
    if (!el) return;

    // Trouver le premier ancêtre scrollable (overflow-y: auto/scroll)
    let scrollParent: HTMLElement | null = el.parentElement;
    while (scrollParent && scrollParent !== document.body) {
      const style = window.getComputedStyle(scrollParent);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') break;
      scrollParent = scrollParent.parentElement;
    }
    if (!scrollParent || scrollParent === document.body) {
      // Pas de conteneur scrollable identifié — on ne fait RIEN (ne scrolle pas window/document)
      return;
    }

    const elRect = el.getBoundingClientRect();
    const parentRect = scrollParent.getBoundingClientRect();
    const targetScrollTop = scrollParent.scrollTop + (elRect.top - parentRect.top);
    scrollParent.scrollTo({ top: targetScrollTop, behavior: smooth ? 'smooth' : 'auto' });
  }

  // Helper pour formater le texte
  // Initiales à partir du nom (max 3 lettres)
  const getInitials = (name: string) => {
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return name.slice(0, 3).toUpperCase();
    return words.slice(0, 3).map(w => w[0]).join('').toUpperCase();
  };

  // Détection mobile pour affichage calendrier
  const [isMobileScreen, setIsMobileScreen] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobileScreen(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Historique autocomplete : titres et notes déjà utilisés
  const titleHistory = React.useMemo(() =>
    [...new Set(tasks.map((t: any) => t.title).filter(Boolean))].sort() as string[],
    [tasks]
  );
  const notesHistory = React.useMemo(() =>
    [...new Set(tasks.map((t: any) => t.notes).filter(Boolean))].sort() as string[],
    [tasks]
  );

  const formatLabel = (text: string | undefined) => {
    if (!text) return '';
    return text;
  };

  const formatDisplayDate = (isoString: string) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  // Tâches pour une date (chevauchement jour)
  const getTasksForDate = (date: Date, list: Task[]) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return list.filter(t => {
      const tStart = new Date(t.start);
      const tEnd = new Date(t.end);
      return tStart <= dayEnd && tEnd >= dayStart;
    });
  };

  const openDayDetails = (date: Date) => {
    setDayModalDate(new Date(date));
    setIsDayModalOpen(true);
  };

  const openTaskViewOnly = (task: Task) => {
    setIsViewOnly(true);
    setNewTask({ ...task, start: task.start, end: task.end });
    setSelectedTaskDays(initSelectedDaysFromRange(task.start, task.end));
    setEditingTaskId(task.id);
    setIsModalOpen(true);
  };


  // Génération de la grille (logique de dates)
  const generateMonthGrid = (baseDate: Date, monthOffset: number) => {
    const targetDate = new Date(baseDate);
    targetDate.setMonth(baseDate.getMonth() + monthOffset);
    
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const dayOfWeek = firstDayOfMonth.getDay(); // used for offset in week header
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Only include actual days of the month (no padding from prev/next month)
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }
    return {
        monthLabel: targetDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        year: year,
        monthIndex: month,
        days: days
    };
  };

  const allMonthsData = useMemo(() => {
    const grids = [];
    for (let i = 0; i < monthsToShow; i++) {
        grids.push(generateMonthGrid(currentDate, i));
    }
    return grids;
  }, [currentDate, monthsToShow]);


  // Détection des conflits (Global)
  const conflicts = useMemo(() => {
    const foundConflicts: Conflict[] = [];
    const tasksToCheck = tasks; 

    for (let i = 0; i < tasksToCheck.length; i++) {
      for (let j = i + 1; j < tasksToCheck.length; j++) {
        const t1 = tasksToCheck[i];
        const t2 = tasksToCheck[j];

        // Conflit = même fournisseur + chantiers DIFFÉRENTS + dates qui se chevauchent
        if (t1.supplierId === t2.supplierId && t1.projectId !== t2.projectId) {
          const start1 = new Date(t1.start).getTime();
          const end1 = new Date(t1.end).getTime();
          const start2 = new Date(t2.start).getTime();
          const end2 = new Date(t2.end).getTime();

          if (start1 < end2 && end1 > start2) {
            const overlapEnd = Math.min(end1, end2);
            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
            if (overlapEnd < todayStart.getTime()) continue;

            const supplier = suppliers.find(s => s.id === t1.supplierId);
            const p1 = projects.find(p => p.id === t1.projectId);
            const p2 = projects.find(p => p.id === t2.projectId);

            foundConflicts.push({
              taskA: t1,
              taskB: t2,
              supplierName: supplier?.name || 'Inconnu',
              message: `Conflit entre "${p1?.name}" et "${p2?.name}" le ${new Date(start1).toLocaleDateString('fr-FR')}`
            });
          }
        }
      }
    }
    return foundConflicts;
  }, [tasks, suppliers, projects]);

  // --- Handlers de Drag ---
  const handleDayMouseDown = (date: Date, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      setIsDragging(true);
      setDragStart(date);
      setDragCurrent(date);
  };

  const handleDayMouseEnter = (date: Date) => {
      if (isDragging) {
          setDragCurrent(date);
      }
  };

  const isDaySelected = (date: Date) => {
      if (!isDragging || !dragStart || !dragCurrent) return false;
      const s = dragStart.getTime();
      const e = dragCurrent.getTime();
      const d = date.getTime();
      const min = Math.min(s, e);
      const max = Math.max(s, e);
      const dayTime = new Date(date).setHours(0,0,0,0);
      const minTime = new Date(min).setHours(0,0,0,0);
      const maxTime = new Date(max).setHours(0,0,0,0);
      return dayTime >= minTime && dayTime <= maxTime;
  };


  // ── AgendaView component (Option 4) ──────────────────────────
  const AgendaView: React.FC<{ tasksToRender: Task[] }> = ({ tasksToRender }) => {
    const sorted = [...tasksToRender].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const groups: Record<string, Task[]> = {};
    sorted.forEach(task => {
      const tStart = new Date(task.start); tStart.setHours(0,0,0,0);
      const tEnd = new Date(task.end); tEnd.setHours(23,59,59,999);
      const cur = new Date(tStart);
      while (cur <= tEnd) {
        const key = cur.toISOString().slice(0,10);
        if (!groups[key]) groups[key] = [];
        if (!groups[key].find(t => t.id === task.id)) groups[key].push(task);
        cur.setDate(cur.getDate() + 1);
      }
    });
    const today = new Date().toISOString().slice(0,10);
    const keys = Object.keys(groups).sort();
    if (keys.length === 0) return (
      <div className="text-center text-slate-400 text-sm py-12">Aucune tâche à afficher.</div>
    );
    // Tailwind bg → hex (inline styles to avoid purge issues)
    const BG: Record<string,string> = {
      'bg-red-200':'#fecaca','bg-orange-200':'#fed7aa','bg-amber-200':'#fde68a',
      'bg-yellow-200':'#fef08a','bg-lime-200':'#d9f99d','bg-green-200':'#bbf7d0',
      'bg-emerald-200':'#a7f3d0','bg-teal-200':'#99f6e4','bg-cyan-200':'#a5f3fc',
      'bg-sky-200':'#bae6fd','bg-blue-200':'#bfdbfe','bg-indigo-200':'#c7d2fe',
      'bg-violet-200':'#ddd6fe','bg-purple-200':'#e9d5ff','bg-fuchsia-200':'#f5d0fe',
      'bg-pink-200':'#fbcfe8','bg-rose-200':'#fecdd3',
      'bg-red-400':'#f87171','bg-orange-400':'#fb923c','bg-amber-400':'#fbbf24',
      'bg-lime-400':'#a3e635','bg-green-500':'#22c55e','bg-teal-500':'#14b8a6',
      'bg-cyan-500':'#06b6d4','bg-blue-500':'#3b82f6','bg-indigo-500':'#6366f1',
      'bg-purple-500':'#a855f7','bg-pink-500':'#ec4899',
    };
    const TC: Record<string,string> = {
      'text-red-800':'#991b1b','text-orange-800':'#9a3412','text-amber-800':'#92400e',
      'text-yellow-800':'#854d0e','text-lime-800':'#3f6212','text-green-800':'#166534',
      'text-emerald-800':'#065f46','text-teal-800':'#115e59','text-cyan-800':'#155e75',
      'text-sky-800':'#075985','text-blue-800':'#1e40af','text-indigo-800':'#3730a3',
      'text-violet-800':'#5b21b6','text-purple-800':'#6b21a8','text-fuchsia-800':'#86198f',
      'text-pink-800':'#9d174d','text-rose-800':'#9f1239','text-white':'#ffffff',
    };
    return (
      <div className="space-y-2 pb-8">
        {keys.map(dateKey => {
          const date = new Date(dateKey + 'T12:00:00');
          const isToday = dateKey === today;
          const ccq = CCQ_HOLIDAYS[dateKey];
          const isWE = date.getDay() === 0 || date.getDay() === 6;
          const dayLabel = date.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
          const headerBg = isToday ? '#1e40af' : isWE ? '#eff6ff' : ccq ? '#fff7ed' : '#f1f5f9';
          const headerTc = isToday ? '#ffffff' : isWE ? '#1e40af' : ccq ? '#c2410c' : '#475569';
          return (
            <div key={dateKey} className="mb-3">
              {/* Day header — sticky */}
              <div style={{background: headerBg}} className="flex items-center gap-3 px-3 py-2 rounded-lg mb-2 sticky top-0 z-10">
                <span style={{color: headerTc}} className="text-sm font-bold capitalize">{dayLabel}</span>
                {isToday && <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">Aujourd'hui</span>}
                {ccq && !isToday && <span style={{color:headerTc}} className="text-xs opacity-80">{ccq}</span>}
                <span style={{color: headerTc, opacity: 0.5}} className="ml-auto text-xs">{groups[dateKey].length} tâche{groups[dateKey].length > 1 ? 's' : ''}</span>
              </div>
              {/* Tasks */}
              <div className="space-y-1.5 pl-1">
                {groups[dateKey].map(task => {
                  const supplier = suppliers.find(s => s.id === task.supplierId);
                  const project = projects.find(p => p.id === task.projectId);
                  const isDelivery = task.notes?.startsWith('📦 Livraison');
                  const parts = (supplier?.color || 'bg-slate-300 text-slate-800 border-slate-400').split(' ');
                  const chipBg = isDelivery ? '#fef9c3' : (BG[parts[0]] ?? '#e2e8f0');
                  const chipTc = isDelivery ? '#92400e' : (TC[parts[1]] ?? '#1e293b');
                  const init = supplier ? getInitials(supplier.name) : '?';
                  const startStr = new Date(task.start).toLocaleDateString('fr-FR', {day:'numeric', month:'short'});
                  const endStr = new Date(task.end).toLocaleDateString('fr-FR', {day:'numeric', month:'short'});
                  const sameDay = task.start.slice(0,10) === task.end.slice(0,10);
                  return (
                    <div key={task.id}
                      onClick={() => { if (canEdit) { handleEditTask(new MouseEvent('click') as any, task); } else { openTaskViewOnly(task); } }}
                      className="bg-white rounded-xl border border-slate-200 p-3 cursor-pointer hover:shadow-sm hover:border-slate-300 transition-all">
                      <div className="flex items-center gap-3">
                        {/* Supplier color chip */}
                        <div style={{background: chipBg, color: chipTc, minWidth: '2.5rem'}}
                          className="rounded-lg px-2 py-1 text-center font-bold text-xs flex-shrink-0">
                          {isDelivery ? '📦' : init}
                        </div>
                        {/* Main content + dates inline */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">{task.title}</span>
                            {supplier && (
                              <span style={{background: chipBg, color: chipTc}}
                                className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                {supplier.name}
                              </span>
                            )}
                            {/* Date inline right after supplier */}
                            {sameDay ? (
                              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex-shrink-0">{startStr}</span>
                            ) : (
                              <span className="text-xs text-slate-400 flex-shrink-0">{startStr} → {endStr}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {!currentProjectId && project && (
                              <span className="text-xs text-slate-400 flex items-center gap-0.5">
                                <MapPin className="w-3 h-3" />{project.name}
                              </span>
                            )}
                            {task.notes && !isDelivery && (
                              <span className="text-xs text-slate-400 truncate max-w-xs">{task.notes}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── WeekZoomView component (Option 2) ─────────────────────
  const WeekZoomView: React.FC<{ weekDate: Date, tasksToRender: Task[], onBack: () => void, interactive: boolean }> = ({ weekDate, tasksToRender, onBack, interactive }) => {
    // Get Monday of the week
    const monday = new Date(weekDate);
    const dow = monday.getDay();
    monday.setDate(monday.getDate() - (dow === 0 ? 6 : dow - 1));
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    const weekLabel = `${monday.toLocaleDateString('fr-FR', {day:'numeric', month:'long'})} – ${days[6].toLocaleDateString('fr-FR', {day:'numeric', month:'long', year:'numeric'})}`;
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline">
            <ChevronLeft className="w-4 h-4" /> Retour au mois
          </button>
          <span className="text-sm font-bold text-slate-700 capitalize">{weekLabel}</span>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {days.map(day => {
            const dayStr = day.toISOString().slice(0,10);
            const isToday = new Date().toISOString().slice(0,10) === dayStr;
            const ccq = CCQ_HOLIDAYS[dayStr];
            const isWE = day.getDay() === 0 || day.getDay() === 6;
            const dayStart = new Date(day); dayStart.setHours(0,0,0,0);
            const dayEnd = new Date(day); dayEnd.setHours(23,59,59,999);
            const dayTasks = tasksToRender.filter(t => {
              const ts = new Date(t.start); const te = new Date(t.end);
              return ts <= dayEnd && te >= dayStart;
            });
            const dayLabel = day.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
            return (
              <div key={dayStr} className={`rounded-xl border overflow-hidden ${isWE ? 'border-blue-200' : ccq ? 'border-orange-200' : 'border-slate-200'}`}>
                <div
                  onClick={() => { setDayModalDate(day); setIsDayModalOpen(true); }}
                  className={`px-3 py-2 flex items-center gap-2 cursor-pointer ${isWE ? 'bg-blue-50 hover:bg-blue-100' : ccq ? 'bg-orange-50' : isToday ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-50 hover:bg-slate-100'}`}>
                  <span className={`text-sm font-bold capitalize ${isToday ? 'text-white' : 'text-slate-700'}`}>{dayLabel}</span>
                  {ccq && <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">{ccq}</span>}
                  {isToday && <span className="text-xs bg-white/30 text-white px-2 py-0.5 rounded-full">Aujourd'hui</span>}
                </div>
                {dayTasks.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-slate-400 italic">Aucune tâche</div>
                ) : (
                  <div className="p-2 space-y-1.5">
                    {dayTasks.map(task => {
                      const supplier = suppliers.find(s => s.id === task.supplierId);
                      const isDelivery = task.notes?.startsWith('📦 Livraison');
                      const colorClass = isDelivery ? 'bg-amber-200 text-amber-900 border-amber-400' : (supplier?.color || 'bg-slate-200 text-slate-800 border-slate-300');
                      return (
                        <div key={task.id}
                          onClick={() => interactive ? handleEditTask(new MouseEvent('click') as any, task) : openTaskViewOnly(task)}
                          className={`rounded-lg px-3 py-2 text-sm font-medium cursor-pointer ${colorClass} border flex items-center gap-2`}>
                          {isDelivery && <span className="text-base">📦</span>}
                          <div className="min-w-0 flex-1">
                            <div className="font-bold truncate">{supplier ? getInitials(supplier.name) : '?'} <span className="font-normal">{task.title}</span></div>
                            {supplier && <div className="text-xs opacity-75 truncate">{supplier.name}</div>}
                          </div>
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

  const CalendarGrid = ({ tasksToRender, interactive = true, isPdf = false, isMobile = false, onWeekClick  }: { tasksToRender: Task[], interactive?: boolean, isPdf?: boolean, isMobile?: boolean, onWeekClick?: (d: Date) => void }) => {
    const getTasksForDay = (date: Date) => {
        const dayStart = new Date(date);
        dayStart.setHours(0,0,0,0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23,59,59,999);
        const matched = tasksToRender.filter(t => {
          const tStart = new Date(t.start);
          const tEnd = new Date(t.end);
          return tStart <= dayEnd && tEnd >= dayStart;
        });
        // Vue globale (pas de chantier sélectionné) : 1 seul badge par fournisseur par jour
        if (!currentProjectId) {
          const seen = new Set<string>();
          return matched.filter(t => {
            if (seen.has(t.supplierId)) return false;
            seen.add(t.supplierId);
            return true;
          });
        }
        return matched;
    };

    const weekDaysHeader = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

    // Determine grid columns based on monthsToShow
    let gridColsClass = "flex flex-col gap-8";
    if (!isPdf && monthsToShow === 4) {
      gridColsClass = "grid grid-cols-1 md:grid-cols-2 gap-6";
    } else if (!isPdf && monthsToShow > 1) {
      gridColsClass = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6";
    }
    if (isPdf) {
        gridColsClass = "grid grid-cols-3 gap-4";
        if (monthsToShow === 1) gridColsClass = "block";
    }

    return (
        <div className={gridColsClass}>
            {(isMobile ? autoMonthsData : (!canEdit && !isMobileScreen) ? (() => {
              // Fournisseur desktop : auto-plage ou monthsToShow selon toggle
              if (monthsToShow > 1) return allMonthsData; // toggle pressed by supplier
              return autoMonthsData; // default: show all assigned months
            })() : allMonthsData).map((monthData, idx) => (
                <div 
                    key={`${monthData.year}-${monthData.monthIndex}`}
                    data-month-key={`${monthData.year}-${monthData.monthIndex}`}
                    className={`border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm h-fit scroll-mt-4 ${isPdf ? 'break-inside-avoid border-2 border-slate-800' : ''}`}
                >
                    {/* Month Header — cliquable en vue 4 mois */}
                    <div
                      className={`py-2 px-4 border-b border-slate-200 font-bold text-slate-700 text-center ${isPdf ? 'bg-slate-100 text-lg' : 'bg-slate-50'} ${monthsToShow === 4 && !isPdf ? 'cursor-pointer hover:bg-blue-50 hover:text-blue-700 transition-colors select-none' : ''}`}
                      onClick={() => {
                        if (monthsToShow === 4 && !isPdf) {
                          setCurrentDate(new Date(monthData.year, monthData.monthIndex, 1));
                          setMonthsToShow(1);
                        }
                      }}
                    >
                      {monthData.monthLabel}
                      {monthsToShow === 4 && !isPdf && <span className="ml-1 text-xs text-slate-400 font-normal">↗</span>}
                    </div>

                    {/* Week Header */}
                    <div className={`grid grid-cols-7 border-b border-slate-200 ${isPdf ? 'bg-slate-100' : 'bg-slate-50/50'}`}>
                        {weekDaysHeader.map(day => (
                            <div key={day} className={`text-center font-semibold text-slate-400 uppercase tracking-wide ${isPdf ? 'py-1 text-xs text-slate-900 font-bold border-r border-slate-300 last:border-0' : 'py-1.5 text-[10px]'}`}>
                            {day.charAt(0)}
                            </div>
                        ))}
                    </div>


                    {/* Days Grid */}
                    <div className={`grid grid-cols-7 bg-slate-200 gap-px ${isPdf ? 'gap-0.5 bg-slate-800 border-b border-slate-800' : ''}`}>
                    {/* Padding empty cells for first week */}
                    {Array.from({length: new Date(monthData.year, monthData.monthIndex, 1).getDay()}).map((_,pi) => (
                      <div key={`pad-${pi}`} className={`bg-white ${isPdf ? 'min-h-[100px] p-1 border-r border-b border-slate-200' : 'min-h-[100px] p-1'}`} />
                    ))}
                    {monthData.days.map((day, i) => {
                        // Option 2: week row click indicator — tap week label on mobile
                        const isToday = new Date().toDateString() === day.toDateString();
                        const isCurrentMonth = true; // all days are now current month only
                        const dayTasks = getTasksForDay(day);
                        const selected = interactive && isDaySelected(day);

                        return (
                        <div 
                            key={i} 
                            className={`
                                bg-white flex flex-col relative group 
                                ${isPdf ? 'min-h-[100px] p-1 border-r border-b border-slate-200' : isMobile && monthsToShow === 1 ? 'min-h-[90px] p-1.5' : 'min-h-[100px] p-1'}
                                ${!isCurrentMonth ? 'bg-slate-50/50' : ''} 
                                ${isCurrentMonth && getCCQHoliday(day) ? '!bg-orange-50' : ''}
                                ${isCurrentMonth && !getCCQHoliday(day) && (day.getDay() === 0 || day.getDay() === 6) ? '!bg-blue-50' : ''}
                                ${(interactive || !canEdit) ? 'hover:bg-slate-50 cursor-pointer' : ''} 
                                ${selected ? '!bg-blue-100 ring-inset ring-2 ring-blue-300' : ''}
                                transition-colors
                            `}
                            onClick={(e) => {
                              if (isPdf) return;
                              if (!canEdit) {
                                // Fournisseur : voir les tâches du jour
                                e.stopPropagation();
                                openDayDetails(day);
                              } else if (!isDragging) {
                                // Admin : tap sur une case = ouvrir modale avec date pré-remplie
                                e.stopPropagation();
                                const start = new Date(day);
                                const end = new Date(day);
                                start.setHours(7, 0, 0, 0);
                                end.setHours(17, 0, 0, 0);
                                const startIso = start.toISOString();
                                const endIso = end.toISOString();
                                setNewTask({
                                  projectId: currentProjectId || (projects.length > 0 ? projects[0].id : ''),
                                  start: startIso,
                                  end: endIso,
                                  supplierId: suppliers.length > 0 ? suppliers[0].id : '',
                                });
                                setSelectedTaskDays(initSelectedDaysFromRange(startIso, endIso));
                                setEditingTaskId(null);
                                setIsViewOnly(false);
                                setIsAllDay(true);
                                setIsModalOpen(true);
                              }
                            }}
                            onMouseDown={(e) => interactive && handleDayMouseDown(day, e)}
                            onMouseEnter={() => interactive && handleDayMouseEnter(day)}
                        >
                            <div className={`text-right font-medium mb-0.5 ${isToday ? 'text-blue-600 font-bold' : isCurrentMonth ? 'text-slate-700' : 'text-slate-400'} ${isPdf ? 'text-sm mb-2' : ''} ${isMobile && monthsToShow === 1 ? 'text-sm' : 'text-xs'}`}>
                            <span className={`${isToday ? 'bg-blue-100 px-1.5 py-0.5 rounded-full' : ''}`}>
                                {day.getDate()}
                            </span>
                            </div>
                            {/* Congé CCQ */}
                            {isCurrentMonth && !isPdf && getCCQHoliday(day) && (
                              <div className="w-full mb-0.5 px-0.5 py-px rounded text-center leading-tight bg-orange-100 border border-orange-300 truncate" style={{fontSize:'6px', color:'#c2410c'}} title={getCCQHoliday(day) ?? ''}>
                                {getCCQHoliday(day)}
                              </div>
                            )}
                            {isPdf && getCCQHoliday(day) && (
                              <div className="w-full mb-1 px-1 py-0.5 rounded text-center text-[8px] leading-tight bg-orange-100 border border-orange-300 text-orange-700 font-medium">
                                {getCCQHoliday(day)}
                              </div>
                            )}
                            <div className="flex-1 flex flex-col gap-1">
                            {dayTasks.map(task => {
                                const supplier = suppliers.find(s => s.id === task.supplierId);
                                const project = projects.find(p => p.id === task.projectId);
                                const isDelivery = task.notes?.startsWith('📦 Livraison');
                                const colorClass = isDelivery
                                  ? 'bg-amber-200 text-amber-900 border-amber-400'
                                  : supplier?.color || 'bg-gray-200 text-gray-800 border-gray-300';
                                // Conflit seulement sur les jours précis où les tâches se chevauchent
                                const hasConflict = conflicts.some(c => {
                                  if (c.taskA.id !== task.id && c.taskB.id !== task.id) return false;
                                  // L'autre tâche du conflit
                                  const other = c.taskA.id === task.id ? c.taskB : c.taskA;
                                  // Vérifier si CE jour précis est dans la plage de l'autre tâche
                                  const otherStart = new Date(other.start); otherStart.setHours(0,0,0,0);
                                  const otherEnd = new Date(other.end); otherEnd.setHours(23,59,59,999);
                                  const dayStart = new Date(day); dayStart.setHours(0,0,0,0);
                                  const dayEnd = new Date(day); dayEnd.setHours(23,59,59,999);
                                  return dayStart <= otherEnd && dayEnd >= otherStart;
                                });

                                const isNew = !isPdf && task.createdAt
                                  ? (Date.now() - new Date(task.createdAt).getTime()) < 48 * 60 * 60 * 1000
                                  : false;

                                return (
                                <div
                                    key={task.id}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); if (isPdf) return; handleEditTask(e, task); }}
                                    className={`
                                    rounded border shadow-sm transition-all relative flex gap-0.5
                                    ${isPdf ? 'p-1 mb-1 border-l-2' : 'p-1 text-[10px]'}
                                    ${interactive ? 'cursor-pointer hover:brightness-95 hover:scale-[1.02] z-10' : ''}
                                    ${colorClass}
                                    ${hasConflict ? 'ring-2 ring-red-500 ring-offset-0 z-20' : ''}
                                    ${!isPdf && isNew ? 'border-l-[3px] border-l-blue-500' : ''}
                                    `}
                                >
                                    {/* Icône livraison */}
                                    {isDelivery && !isPdf && (
                                      <span className="flex-shrink-0 leading-none" style={{fontSize:'8px'}}>📦</span>
                                    )}
                                    {/* Seul badge absolu : conflit */}
                                    {hasConflict && (
                                    <div className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 z-20 shadow-sm border border-white">
                                        <AlertTriangle className="w-2 h-2" />
                                    </div>
                                    )}

                                    {/* Texte — complet sur desktop/PDF, initiales sur mobile */}
                                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                        {isPdf ? (
                                          // PDF : texte complet
                                          currentProjectId ? (
                                            <>
                                              <div className="font-bold leading-tight break-words text-xs mb-0.5">{formatLabel(task.title)}</div>
                                              <div className="opacity-90 leading-tight text-[9px] mt-1 pt-1 border-t border-black/10 uppercase tracking-wide">{formatLabel(supplier?.name)}</div>
                                            </>
                                          ) : (
                                            <>
                                              <div className="font-bold leading-tight break-words text-xs mb-0.5">{formatLabel(supplier?.name)}</div>
                                              <div className="opacity-90 leading-tight text-[9px] mt-1 pt-1 border-t border-black/10 uppercase tracking-wide">{project?.name}</div>
                                              {project?.address && <div className="opacity-75 leading-tight text-[9px]">📍 {project.address}</div>}
                                            </>
                                          )
                                        ) : (!isMobile && monthsToShow === 1) ? (
                                          // Desktop 1 mois : texte complet
                                          currentProjectId ? (
                                            <>
                                              <div className="font-bold leading-tight break-words">{formatLabel(task.title)}</div>
                                              <div className="opacity-90 leading-tight text-[9px] mt-0.5 pt-0.5 border-t border-black/10">{formatLabel(supplier?.name)}</div>
                                            </>
                                          ) : (
                                            <>
                                              <div className="font-bold leading-tight break-words">{formatLabel(supplier?.name)}</div>
                                              <div className="opacity-90 leading-tight text-[9px] mt-0.5 pt-0.5 border-t border-black/10">{project?.name}</div>
                                              {project?.address && <div className="opacity-75 leading-tight text-[9px] mt-0.5">📍 {project.address}</div>}
                                            </>
                                          )
                                        ) : (
                                          // Mobile ou vue 4 mois : initiales + adresse courte
                                          <>
                                            <div className="font-bold leading-tight truncate" style={{fontSize:'8px'}}>
                                              {supplier ? getInitials(supplier.name) : '?'}
                                            </div>
                                            {!currentProjectId && project?.address && (
                                              <div className="leading-tight truncate opacity-75" style={{fontSize:'7px'}}>
                                                {project.address.split(',')[0].trim()}
                                              </div>
                                            )}
                                            {currentProjectId && task.title && (
                                              <div className="leading-tight truncate opacity-90" style={{fontSize:'7px'}}>
                                                {task.title}
                                              </div>
                                            )}
                                          </>
                                        )}
                                    </div>

                                    {/* Icônes statut — points absolus en haut à droite sur mobile/4mois, colonne sur desktop */}
                                    {!isPdf && (task.taskStatus === 'confirmed' || task.confirmedBySupplier || task.taskStatus === 'declined' || task.supplierNotes?.text || task.adminNote?.text) && (
                                      (isMobile || monthsToShow > 1) ? (
                                        // Mobile / 4 mois : petits points absolus top-right
                                        <div className="absolute top-0.5 right-0.5 flex flex-col gap-px">
                                          {(task.taskStatus === 'confirmed' || task.confirmedBySupplier) && task.taskStatus !== 'declined' && (
                                            <span className="w-2 h-2 bg-green-500 rounded-full block" title="Confirmé" />
                                          )}
                                          {task.taskStatus === 'declined' && (
                                            <span className="w-2 h-2 bg-red-500 rounded-full block" title="Refusé" />
                                          )}
                                          {(task.adminNote?.text || task.supplierNotes?.text) && (
                                            <span className="w-2 h-2 bg-amber-400 rounded-full block" title="Note" />
                                          )}
                                        </div>
                                      ) : (
                                        // Desktop 1 mois : colonne droite avec icônes lisibles
                                        <div className="flex flex-col items-center gap-0.5 justify-start pl-0.5 border-l border-black/10 flex-shrink-0">
                                          {(task.taskStatus === 'confirmed' || task.confirmedBySupplier) && task.taskStatus !== 'declined' && (
                                            <span className="w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center" title="Confirmé">
                                              <svg viewBox="0 0 10 10" className="w-2 h-2 text-white fill-none stroke-current stroke-2">
                                                <polyline points="1.5,5 4,7.5 8.5,2.5" />
                                              </svg>
                                            </span>
                                          )}
                                          {task.taskStatus === 'declined' && (
                                            <span className="w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center" title="Refusé">
                                              <svg viewBox="0 0 10 10" className="w-2 h-2 stroke-white fill-none stroke-2">
                                                <line x1="2.5" y1="2.5" x2="7.5" y2="7.5"/>
                                                <line x1="7.5" y1="2.5" x2="2.5" y2="7.5"/>
                                              </svg>
                                            </span>
                                          )}
                                          {task.adminNote?.text && (
                                            <span className="w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold leading-none" style={{fontSize:'8px'}} title={task.adminNote.text}>!</span>
                                          )}
                                          {task.supplierNotes?.text && (
                                            <span className="w-3.5 h-3.5 bg-amber-400 rounded-full flex items-center justify-center text-white font-bold leading-none" style={{fontSize:'8px'}} title={task.supplierNotes.text}>!</span>
                                          )}
                                        </div>
                                      )
                                    )}
                                </div>
                                );
                            })}
                            </div>
                        </div>
                        );
                    })}
                    </div>
                </div>
            ))}
        </div>
    );
  };

  // --- Mini Calendar Logic ---
  const handleMiniCalendarClick = (day: Date) => {
      const time = day.setHours(0,0,0,0);
      const newSelection = new Set(selectedTaskDays);
      if (newSelection.has(time)) {
          newSelection.delete(time);
      } else {
          newSelection.add(time);
      }
      setSelectedTaskDays(newSelection);
      
      if (newSelection.size > 0) {
          const timestamps = (Array.from(newSelection) as number[]).sort((a,b) => a - b);
          const minDate = new Date(timestamps[0]);
          const maxDate = new Date(timestamps[timestamps.length - 1]);
          const currentStartHour = newTask.start ? new Date(newTask.start).getHours() : 7;
          const currentEndHour = newTask.end ? new Date(newTask.end).getHours() : 17;
          minDate.setHours(currentStartHour, 0,0,0);
          maxDate.setHours(currentEndHour, 0,0,0);
          setNewTask(prev => ({...prev, start: minDate.toISOString(), end: maxDate.toISOString()}));
      } else {
          setNewTask(prev => ({...prev, start: undefined, end: undefined}));
      }
  };

  const MiniCalendarSelector = () => {
    const grid = generateMonthGrid(miniCalendarMonth, 0);
    const weekDays = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    const isSelected = (date: Date) => selectedTaskDays.has(date.setHours(0,0,0,0));

    return (
        <div className="select-none">
            <div className="flex justify-between items-center mb-2 px-1">
                <button 
                    onClick={() => setMiniCalendarMonth(new Date(miniCalendarMonth.setMonth(miniCalendarMonth.getMonth() - 1)))}
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-500"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-bold text-slate-800 capitalize">{grid.monthLabel}</span>
                <button 
                    onClick={() => setMiniCalendarMonth(new Date(miniCalendarMonth.setMonth(miniCalendarMonth.getMonth() + 1)))}
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-500"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {weekDays.map(d => <div key={d} className="text-[10px] font-bold text-slate-400 uppercase">{d}</div>)}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
                {/* Cellules vides pour aligner le 1er du mois avec le bon jour */}
                {Array.from({length: new Date(grid.year, grid.monthIndex, 1).getDay()}).map((_,pi) => (
                  <div key={`pad-${pi}`} />
                ))}
                {grid.days.map((day, i) => {
                    const isCurrentMonth = day.getMonth() === grid.monthIndex;
                    const selected = isSelected(day);
                    
                    let bgClass = "bg-transparent hover:bg-slate-100 text-slate-700 border border-slate-100";
                    if (selected) {
                        bgClass = "bg-blue-600 text-white font-bold shadow-sm border-blue-600";
                    } else if (!isCurrentMonth) {
                        bgClass = "text-slate-300 border-transparent";
                    }

                    return (
                        <div 
                            key={i}
                            onClick={() => handleMiniCalendarClick(day)}
                            className={`
                                h-8 w-full flex items-center justify-center text-xs rounded cursor-pointer transition-all duration-100
                                ${bgClass}
                            `}
                        >
                            {day.getDate()}
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };


  // Actions
  const handleEditTask = (e: React.MouseEvent, task: Task) => {
    if (isDragging) return;
    e.stopPropagation();
    setIsViewOnly(!canEdit);
    setNewTask({ ...task, start: task.start, end: task.end });
    setSelectedTaskDays(initSelectedDaysFromRange(task.start, task.end));
    setEditingTaskId(task.id);
    setIsModalOpen(true);
  };

  const saveTask = () => {
    if (isViewOnly) return;
    if (!newTask.projectId || !newTask.supplierId || !newTask.start || !newTask.end || !newTask.title) {
      alert("Champs manquants");
      return;
    }
    if (new Date(newTask.end) < new Date(newTask.start)) {
      alert("Erreur date fin < date début");
      return;
    }

    if (editingTaskId) {
      setTasks(tasks.map(t => t.id === editingTaskId ? { ...t, ...newTask } as Task : t));
    } else {
      setTasks([...tasks, { ...newTask as Task, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]);
    }
    setIsModalOpen(false);
                setIsViewOnly(false);
  };

  const deleteTask = () => {
    if (editingTaskId) {
      setTasks(tasks.filter(t => t.id !== editingTaskId));
      setIsModalOpen(false);
    }
  };

  const handlePrepareEmail = () => {
    setSelectedEmailSuppliers([]);
    setIsEmailModalOpen(true);
  };

  const confirmSendEmail = () => {
    const supplierEmails = suppliers.filter(s => s.email?.trim() && selectedEmailSuppliers.includes(s.id)).map(s => s.email).join(',');
    const subject = encodeURIComponent(`Cédule Chantier - ${new Date().toLocaleDateString()}`);
    const body = encodeURIComponent(`Bonjour,\n\nVeuillez prendre notes que la cédule a été mise à jour pour un de vos chantiers en cours.\n\nMerci,\nCrewFlo`);
    const link = document.createElement('a');
    link.href = `mailto:?bcc=${supplierEmails}&subject=${subject}&body=${body}`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => document.body.removeChild(link), 100);
    setIsEmailModalOpen(false);
  };

  const downloadAllPDF = async (filterProjectId?: string, includeTasks = true, includeFinitions = false, includeTaskList = true) => {
    try {
      // Récupérer les finitions de tous les chantiers depuis Supabase
      const supabase = getSupabase();
      const { companyId } = getSupabaseConfig();
      const finMap: Record<string, any> = {};
      if (supabase && companyId) {
        const { data: finRows } = await supabase
          .from('project_finishing_data')
          .select('project_id, data')
          .eq('company_id', companyId);
        if (finRows) {
          for (const row of finRows) finMap[row.project_id] = row.data;
        }
      }
      setFinishingsMap(finMap);
      setIsExporting(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      if (!pdfContainerRef.current) throw new Error("Container not found");
      
      // Activer la compression dans jsPDF
      const pdf = new jsPDF({ 
          orientation: 'landscape', 
          unit: 'mm', 
          format: 'a4',
          compress: true 
      });

      // Filtrer selon les sélections
      const allPages = Array.from(pdfContainerRef.current.querySelectorAll('.pdf-page'));
      const pages = allPages.filter(page => {
        const el = page as HTMLElement;
        const pdfType = el.dataset.pdfType;
        const isCalendarPage = pdfType === 'tasks' || !pdfType;
        const isTaskListPage = pdfType === 'tasklist';
        const isFinPage = pdfType === 'finitions';
        const pageProject = el.dataset.projectId;
        if (filterProjectId && pageProject && pageProject !== 'all' && pageProject !== filterProjectId) return false;
        if (isFinPage && !includeFinitions) return false;
        if (isCalendarPage && !includeTasks) return false;
        if (isTaskListPage && !includeTaskList) return false;
        return true;
      });
      for (let i = 0; i < pages.length; i++) {
          const el = pages[i] as HTMLElement;
          const isLandscape = el.style.width === '1400px' || el.dataset.pdfType === 'tasks';
          const canvas = await html2canvas(el, {
              scale: 1.2,
              backgroundColor: '#ffffff',
              width: isLandscape ? 1400 : undefined,
              windowWidth: isLandscape ? 1400 : undefined,
          });

          if (i > 0) pdf.addPage('a4', isLandscape ? 'landscape' : 'portrait');

          const pageW = isLandscape ? 297 : 210;
          const pageH = isLandscape ? 210 : 297;
          const imgData = canvas.toDataURL('image/jpeg', 0.80);
          const ratio = Math.min(pageW / (canvas.width / 3.7795), pageH / (canvas.height / 3.7795));
          const w = (canvas.width / 3.7795) * ratio;
          const h = (canvas.height / 3.7795) * ratio;
          pdf.addImage(imgData, 'JPEG', (pageW-w)/2, 0, w, h, undefined, 'FAST');
      }
      pdf.save(`Rapport_Chantier_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la génération du PDF");
    } finally {
      setIsExporting(false);
    }
  };


const FinishingsPdfPage: React.FC<{ project: Project; finData: any }> = ({ project, finData }) => {
  if (!finData) return <div className="text-slate-400 text-sm italic mt-4">Aucune finition enregistrée pour ce chantier.</div>;

  const catsWithData = FINISHING_TEMPLATE.flatMap(cat => {
    const catData = finData[cat.key];
    if (!catData) return [];
    const roomsWithData = cat.rooms.flatMap(room => {
      const roomData = catData[room.key];
      if (!roomData) return [];
      const areasWithData = room.areas.flatMap(area => {
        const av = roomData.areas?.[area.key];
        if (!av) return [];
        const lines: string[] = [];
        if (area.materialChoices) {
          area.materialChoices.forEach(mat => {
            const mp = av.materialPresets?.[mat.key];
            if (mp?.length) lines.push(`${mat.label}: ${mp.join(', ')}`);
          });
        }
        if (av.presets?.length) lines.push(av.presets.join(' · '));
        if (av.selectedMaterial) lines.push(`Matériau: ${av.selectedMaterial}`);
        if (av.selectedMaterials?.length) lines.push(av.selectedMaterials.join(' · '));
        if (av.model) lines.push(`Modèle: ${av.model}`);
        if (av.color) lines.push(`Couleur: ${av.color}`);
        if (av.notes) lines.push(`Note: ${av.notes}`);
        if (!lines.length) return [];
        return [{ label: area.label, lines, confirmed: av.confirmed }];
      });
      if (!areasWithData.length) return [];
      return [{ label: room.label, areas: areasWithData, confirmed: roomData.confirmed }];
    });
    if (!roomsWithData.length) return [];
    return [{ label: cat.label, emoji: cat.emoji, rooms: roomsWithData }];
  });

  if (!catsWithData.length) return <div className="text-slate-400 text-sm italic mt-4">Aucune finition enregistrée pour ce chantier.</div>;

  return (
    <div className="grid grid-cols-2 gap-4 mt-2">
      {catsWithData.map(cat => (
        <div key={cat.label} className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-800 text-white px-3 py-1.5 text-xs font-bold">{cat.emoji} {cat.label}</div>
          {cat.rooms.map(room => (
            <div key={room.label} className="px-3 py-2 border-b border-slate-100 last:border-0">
              <div className={`text-xs font-bold mb-1 ${room.confirmed ? 'text-green-700' : 'text-slate-700'}`}>
                {room.confirmed ? '✓ ' : ''}{room.label}
              </div>
              {room.areas.map(area => (
                <div key={area.label} className="ml-2 mb-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{area.label}</span>
                  {area.lines.map((line, i) => (
                    <div key={i} className="text-xs text-slate-800 ml-2">→ {line}</div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

const TaskDetailsTable: React.FC<{ tasksForPage: Task[] }> = ({ tasksForPage }) => {
  const sorted = [...tasksForPage].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  if (sorted.length === 0) return null;

  const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || id;
  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || id;

  return (
    <div className="mt-6">
      <div className="text-sm font-bold text-slate-800 mb-2">Détails des tâches</div>
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-100">
            <tr>
              <th className="text-left p-2">Date</th>
              <th className="text-left p-2">Chantier</th>
              <th className="text-left p-2">Fournisseur</th>
              <th className="text-left p-2">Titre</th>
              <th className="text-left p-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(t => (
              <tr key={t.id} className="border-t">
                <td className="p-2 whitespace-nowrap">{new Date(t.start).toLocaleDateString('fr-FR')}</td>
                <td className="p-2">{getProjectName(t.projectId)}</td>
                <td className="p-2">{getSupplierName(t.supplierId)}</td>
                <td className="p-2">{t.title}</td>
                <td className="p-2">{t.notes || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

  const visibleTasks = useMemo(() => {
    let filtered = tasks;
    if (currentProjectId) {
      // Vue par chantier — montre tout (même les projets cachés du global)
      filtered = filtered.filter(t => t.projectId === currentProjectId);
    } else {
      // Vue globale — exclure les chantiers marqués 'hiddenFromGlobalCalendar'
      const hiddenIds = new Set(
        projects.filter(p => p.hiddenFromGlobalCalendar).map(p => p.id)
      );
      if (hiddenIds.size > 0) {
        filtered = filtered.filter(t => !hiddenIds.has(t.projectId));
      }
    }
    if (filterSupplierId !== 'all') filtered = filtered.filter(t => t.supplierId === filterSupplierId);
    return filtered;
  }, [tasks, currentProjectId, filterSupplierId, projects]);

  // Fournisseurs ET mobile : afficher mois couverts par les tâches + mois d'aujourd'hui
  const autoMonthsData = useMemo(() => {
    const useAuto = isMobileScreen || !canEdit; // mobile OU fournisseur
    if (!useAuto) return allMonthsData;
    try {
      const today = new Date();
      const todayMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const dates = visibleTasks
        .flatMap((t: any) => [new Date(t.start), new Date(t.end)])
        .filter(d => !isNaN(d.getTime()));

      let start: Date;
      let end: Date;

      if (dates.length === 0) {
        start = new Date(todayMonth); start.setMonth(start.getMonth() - 1);
        end = new Date(todayMonth); end.setMonth(end.getMonth() + 1);
      } else {
        const minTs = Math.min(...dates.map(d => d.getTime()));
        const maxTs = Math.max(...dates.map(d => d.getTime()));
        if (isNaN(minTs) || isNaN(maxTs)) return [generateMonthGrid(today, 0)];
        const minD = new Date(minTs);
        const maxD = new Date(maxTs);
        start = new Date(minD.getFullYear(), minD.getMonth(), 1);
        end = new Date(maxD.getFullYear(), maxD.getMonth(), 1);

        if (todayMonth.getTime() < start.getTime()) start = new Date(todayMonth);
        if (todayMonth.getTime() > end.getTime()) end = new Date(todayMonth);
      }

      const grids = [];
      const cur = new Date(start);
      let safety = 0;
      while (cur.getTime() <= end.getTime() && safety < 60) {
        grids.push(generateMonthGrid(cur, 0));
        cur.setMonth(cur.getMonth() + 1);
        safety++;
      }
      return grids.length > 0 ? grids : [generateMonthGrid(today, 0)];
    } catch {
      return [generateMonthGrid(new Date(), 0)];
    }
  }, [isMobileScreen, canEdit, visibleTasks, allMonthsData]);

  // ── Scroll automatique vers le mois d'aujourd'hui (mobile + fournisseur) ──
  // Utilise scrollToTodayMonth qui scroll un conteneur SPÉCIFIQUE et pas le document.
  // Placé APRÈS autoMonthsData pour éviter le TDZ.
  const initialScrollDoneRef = useRef(false);
  useEffect(() => {
    if (initialScrollDoneRef.current) return;
    if (!autoMonthsData || autoMonthsData.length === 0) return;
    const t = setTimeout(() => {
      if (initialScrollDoneRef.current) return;
      scrollToTodayMonth(false);
      initialScrollDoneRef.current = true;
    }, 250);
    return () => clearTimeout(t);
  }, [autoMonthsData]);

  // Reset le flag quand on change de projet — re-scroll vers aujourd'hui au prochain rendu
  useEffect(() => {
    initialScrollDoneRef.current = false;
  }, [currentProjectId]);

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="flex-none bg-white border-b border-slate-200 z-20 shadow-sm">
        {/* Ligne 1 : nom calendrier + compte connecté */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1 gap-2">
          {/* Nom chantier + adresse */}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-slate-800 leading-tight truncate">
              {currentProjectId ? projects.find(p => p.id === currentProjectId)?.name : "Vue d'ensemble"}
            </h2>
            {currentProjectId && projects.find(p => p.id === currentProjectId)?.address && (
              <p className="text-xs text-slate-400 flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                {projects.find(p => p.id === currentProjectId)?.address}
              </p>
            )}
          </div>
          {/* Pastille compte connecté */}
          {(() => {
            const selfSupplier = supplierSelf ? suppliers.find(s => s.id === supplierSelf.id) : null;
            const supplierColorBg = selfSupplier?.color?.split(' ')[0] ?? 'bg-slate-300';
            const displayName = canEdit ? 'Admin' : (selfSupplier?.name ?? supplierSelf?.name ?? 'Fournisseur');
            return (
              <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-medium border flex-shrink-0
                ${canEdit ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {canEdit
                  ? <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  : <span className={`w-4 h-4 rounded flex-shrink-0 border border-black/10 ${supplierColorBg}`} />
                }
                {displayName} · {userEmail ?? ''}
              </span>
            );
          })()}
        </div>
        {/* Ligne 2 : navigation + controls */}
        <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
          {/* Navigation mois */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button onClick={prevPeriod} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-3 text-sm font-bold capitalize min-w-[130px] text-center">
              {(isMobileScreen || !canEdit) && autoMonthsData.length > 1
                ? `${autoMonthsData[0]?.monthLabel} — ${autoMonthsData[autoMonthsData.length-1]?.monthLabel}`
                : allMonthsData[0]?.monthLabel}
            </span>
            <button onClick={nextPeriod} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <button onClick={goToToday} className="text-xs font-medium text-blue-600 hover:text-blue-800 underline">Aujourd'hui</button>
          {/* Filtre fournisseur */}
          <select value={filterSupplierId} onChange={e => setFilterSupplierId(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none max-w-[140px] truncate">
            <option value="all">Tous les fournisseurs</option>
            {[...suppliers].sort((a,b) => a.name.localeCompare(b.name,'fr',{sensitivity:'base'})).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {/* Toggle 1/4 mois — desktop */}
          {!isMobileScreen && calendarViewMode === 'calendar' && (
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button onClick={() => { setMonthsToShow(1); setWeekZoomDate(null); }} className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${monthsToShow === 1 && !weekZoomDate ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>1 mois</button>
              <button onClick={() => { setMonthsToShow(4); setWeekZoomDate(null); }} className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${monthsToShow === 4 && !weekZoomDate ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>4 mois</button>
              <button onClick={() => { setMonthsToShow(12); setWeekZoomDate(null); }} className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${monthsToShow === 12 && !weekZoomDate ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Tout</button>
            </div>
          )}
          {/* Toggle Calendrier / Liste */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button onClick={() => { setCalendarViewMode('calendar'); setWeekZoomDate(null); }}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition-all ${calendarViewMode === 'calendar' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              title="Vue calendrier">
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Calendrier</span>
            </button>
            <button onClick={() => setCalendarViewMode('agenda')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition-all ${calendarViewMode === 'agenda' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              title="Vue liste">
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Liste</span>
            </button>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={handlePrepareEmail} className="p-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 shadow-sm hidden sm:block"><Mail className="w-4 h-4" /></button>
            <button onClick={() => setIsPdfModalOpen(true)} disabled={isExporting} className="p-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 shadow-sm" title="Télécharger PDF">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            </button>
            {canEdit && (
              <>
                <button onClick={() => {
                  const now = new Date();
                  const start = new Date(now); start.setHours(7,0,0,0);
                  const end = new Date(now); end.setHours(17,0,0,0);
                  const startIso = start.toISOString();
                  const endIso = end.toISOString();
                  setNewTask({ projectId: currentProjectId || (projects.length > 0 ? projects[0].id : ''), start: startIso, end: endIso, supplierId: suppliers.length > 0 ? suppliers[0].id : '' });
                  setSelectedTaskDays(initSelectedDaysFromRange(startIso, endIso));
                  setEditingTaskId(null);
                  setIsViewOnly(false);
                  setIsAllDay(true);
                  setIsModalOpen(true);
                }} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm shadow-sm">
                  <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Tâche</span>
                </button>
                <button onClick={() => setIsScheduleOpen(true)}
                  disabled={!currentProjectId}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm shadow-sm transition-colors
                    ${currentProjectId ? 'bg-slate-700 text-white hover:bg-slate-800' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                  title={currentProjectId ? 'Cédule de chantier' : 'Sélectionner un chantier d\'abord'}>
                  <span className="hidden sm:inline">📋 Cédule</span>
                  <span className="sm:hidden">📋</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-100 relative">
        <div className={`${calendarViewMode === 'agenda' ? 'p-4' : 'p-4'} min-h-full select-none`}>
          <ConflictAlert conflicts={conflicts} />
          {calendarViewMode === 'agenda' ? (
            <AgendaView tasksToRender={visibleTasks} />
          ) : weekZoomDate ? (
            <WeekZoomView weekDate={weekZoomDate} tasksToRender={visibleTasks} onBack={() => setWeekZoomDate(null)} interactive={canEdit} />
          ) : (
            <CalendarGrid tasksToRender={visibleTasks} interactive={canEdit} isMobile={isMobileScreen} onWeekClick={isMobileScreen ? (d: Date) => setWeekZoomDate(d) : undefined} />
          )}
        </div>
      </div>

      {/* Conteneur PDF — toujours rendu mais hors écran pour html2canvas */}
      <div style={{position:'fixed', top:0, left:'-9999px', width:'1400px', pointerEvents:'none', zIndex:-100}}>
        <div ref={pdfContainerRef}>
      {/* Pages par chantier — pas de vue globale, toujours par chantier */}
      {projects.map((project) => (
        <React.Fragment key={project.id}>
          <div className="pdf-page bg-white" data-pdf-type="tasks" data-project-id={project.id}
            style={{width:'1400px', padding:'24px', boxSizing:'border-box'}}>
            {(() => {
              const projectTasks = tasks.filter(t => t.projectId === project.id);
              const validDates = projectTasks.flatMap(t => [new Date(t.start), new Date(t.end)]).filter(d => !isNaN(d.getTime()));
              const minD = validDates.length > 0 ? new Date(Math.min(...validDates.map(d => d.getTime()))) : new Date();
              const maxD = validDates.length > 0 ? new Date(Math.max(...validDates.map(d => d.getTime()))) : new Date();
              const startMonth = new Date(minD.getFullYear(), minD.getMonth(), 1);
              const endMonth = new Date(maxD.getFullYear(), maxD.getMonth(), 1);
              const months: Date[] = [];
              const cur = new Date(startMonth);
              let s = 0;
              while (cur <= endMonth && s < 24) { months.push(new Date(cur)); cur.setMonth(cur.getMonth()+1); s++; }
              const cols = months.length <= 2 ? months.length : months.length <= 4 ? 2 : months.length <= 6 ? 3 : 4;
              const rangeLabel = months.length > 1
                ? `${startMonth.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})} — ${endMonth.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}`
                : startMonth.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
              // Initiales fournisseur (max 3 lettres)
              const getInit = (name: string) => name.trim().split(/\s+/).slice(0,3).map((w:string)=>w[0]).join('').toUpperCase();
              const CELL_H = months.length <= 2 ? 100 : months.length <= 4 ? 80 : months.length <= 6 ? 62 : 50;
              const FONT = months.length <= 4 ? 10 : 8;
              const TASK_FONT = months.length <= 4 ? 10 : 8;
              return (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'12px',borderBottom:'2px solid #1e293b',paddingBottom:'8px'}}>
                    <div>
                      <div style={{fontSize:'20px',fontWeight:'bold',color:'#0f172a'}}>{project.name}</div>
                      {project.address && <div style={{fontSize:'11px',color:'#64748b',marginTop:'2px'}}>{project.address}</div>}
                    </div>
                    <div style={{fontSize:'11px',fontWeight:'bold',background:'#f1f5f9',padding:'4px 10px',borderRadius:'6px',color:'#475569'}}>{rangeLabel}</div>
                  </div>
                  <div style={{display:'grid', gridTemplateColumns:`repeat(${cols}, 1fr)`, gap:'8px'}}>
                    {months.map((monthDate) => {
                      const yr = monthDate.getFullYear();
                      const mo = monthDate.getMonth();
                      const firstDay = new Date(yr, mo, 1);
                      const offset = firstDay.getDay();
                      const startD = new Date(firstDay); startD.setDate(1 - offset);
                      const days: Date[] = [];
                      const dd = new Date(startD);
                      for (let i=0;i<42;i++){days.push(new Date(dd));dd.setDate(dd.getDate()+1);}
                      const ml = monthDate.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
                      return (
                        <div key={`${yr}-${mo}`} style={{border:'1px solid #cbd5e1',borderRadius:'6px',overflow:'hidden'}}>
                          <div style={{background:'#1e293b',color:'white',textAlign:'center',padding:'5px 0',fontSize:'11px',fontWeight:'bold',textTransform:'capitalize'}}>{ml}</div>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',background:'#f8fafc'}}>
                            {['D','L','M','M','J','V','S'].map((d,i)=>(
                              <div key={i} style={{textAlign:'center',fontSize:'8px',fontWeight:'bold',color:'#94a3b8',padding:'3px 0'}}>{d}</div>
                            ))}
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)'}}>
                            {days.map((day,i) => {
                              const isCurrent = day.getMonth()===mo;
                              const dayStr = day.toISOString().slice(0,10);
                              const isWE = day.getDay()===0||day.getDay()===6;
                              const ccq = CCQ_HOLIDAYS[dayStr];
                              const dayTasks = projectTasks.filter(t=>{
                                const ts=new Date(t.start);ts.setHours(0,0,0,0);
                                const te=new Date(t.end);te.setHours(23,59,59,999);
                                const dc=new Date(day);dc.setHours(12,0,0,0);
                                return dc>=ts&&dc<=te;
                              });
                              const bg = !isCurrent?'#f8fafc':ccq?'#fff7ed':isWE?'#eff6ff':'#ffffff';
                              return (
                                <div key={i} style={{borderRight:'1px solid #f1f5f9',borderBottom:'1px solid #f1f5f9',minHeight:`${CELL_H}px`,background:bg,padding:'2px'}}>
                                  <div style={{textAlign:'right',fontSize:`${FONT}px`,fontWeight:'bold',color:isCurrent?'#334155':'#cbd5e1',lineHeight:1,marginBottom:'2px',background:'rgba(255,255,255,0.85)',borderRadius:'2px',padding:'0 1px',display:'inline-block',float:'right'}}>{day.getDate()}</div>
                                  <div style={{clear:'both'}}/>
                                  {isCurrent&&ccq&&<div style={{fontSize:'5px',color:'#c2410c',background:'#ffedd5',borderRadius:'2px',padding:'0 2px',overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',marginBottom:'1px'}}>CCQ</div>}
                                  {isCurrent&&dayTasks.map(t=>{
                                    const sup=suppliers.find(s=>s.id===t.supplierId);
                                    const colorStr = sup?.color || 'bg-gray-200 text-gray-800 border-gray-300';
                                    const parts = colorStr.split(' ');
                                    const bg2 = parts[0] || 'bg-gray-200';
                                    const tc = parts[1] || 'text-gray-800';
                                    // Mapping complet de toutes les couleurs CrewFlo
                                    const bgMap: Record<string,string> = {
                                      // Teintes claires -200
                                      'bg-red-200':'#fecaca','bg-orange-200':'#fed7aa','bg-amber-200':'#fde68a',
                                      'bg-yellow-200':'#fef08a','bg-lime-200':'#d9f99d','bg-green-200':'#bbf7d0',
                                      'bg-emerald-200':'#a7f3d0','bg-teal-200':'#99f6e4','bg-cyan-200':'#a5f3fc',
                                      'bg-sky-200':'#bae6fd','bg-blue-200':'#bfdbfe','bg-indigo-200':'#c7d2fe',
                                      'bg-violet-200':'#ddd6fe','bg-purple-200':'#e9d5ff','bg-fuchsia-200':'#f5d0fe',
                                      'bg-pink-200':'#fbcfe8','bg-rose-200':'#fecdd3','bg-slate-200':'#e2e8f0',
                                      'bg-gray-200':'#e5e7eb',
                                      // Teintes saturées -400 / -500
                                      'bg-red-400':'#f87171','bg-orange-400':'#fb923c','bg-amber-400':'#fbbf24',
                                      'bg-lime-400':'#a3e635','bg-green-500':'#22c55e','bg-teal-500':'#14b8a6',
                                      'bg-cyan-500':'#06b6d4','bg-blue-500':'#3b82f6','bg-indigo-500':'#6366f1',
                                      'bg-purple-500':'#a855f7','bg-pink-500':'#ec4899',
                                    };
                                    const tcMap: Record<string,string> = {
                                      'text-red-800':'#991b1b','text-orange-800':'#9a3412','text-amber-800':'#92400e',
                                      'text-yellow-800':'#854d0e','text-lime-800':'#3f6212','text-green-800':'#166534',
                                      'text-emerald-800':'#065f46','text-teal-800':'#115e59','text-cyan-800':'#155e75',
                                      'text-sky-800':'#075985','text-blue-800':'#1e40af','text-indigo-800':'#3730a3',
                                      'text-violet-800':'#5b21b6','text-purple-800':'#6b21a8','text-fuchsia-800':'#86198f',
                                      'text-pink-800':'#9d174d','text-rose-800':'#9f1239',
                                      'text-slate-800':'#1e293b','text-gray-800':'#1f2937',
                                      'text-white':'#ffffff',
                                    };
                                    const cellBg = bgMap[bg2] ?? '#ddd6fe';
                                    const cellTc = tcMap[tc] ?? '#5b21b6';
                                    // Bordure légèrement plus foncée pour démarquer du fond weekend
                                    const borderMap: Record<string,string> = {
                                      'bg-red-200':'#fca5a5','bg-orange-200':'#fdba74','bg-amber-200':'#fcd34d',
                                      'bg-yellow-200':'#fde047','bg-lime-200':'#bef264','bg-green-200':'#86efac',
                                      'bg-emerald-200':'#6ee7b7','bg-teal-200':'#5eead4','bg-cyan-200':'#67e8f9',
                                      'bg-sky-200':'#7dd3fc','bg-blue-200':'#93c5fd','bg-indigo-200':'#a5b4fc',
                                      'bg-violet-200':'#c4b5fd','bg-purple-200':'#d8b4fe','bg-fuchsia-200':'#e879f9',
                                      'bg-pink-200':'#f9a8d4','bg-rose-200':'#fda4af',
                                      'bg-red-400':'#ef4444','bg-orange-400':'#f97316','bg-amber-400':'#f59e0b',
                                      'bg-lime-400':'#84cc16','bg-green-500':'#16a34a','bg-teal-500':'#0d9488',
                                      'bg-cyan-500':'#0891b2','bg-blue-500':'#2563eb','bg-indigo-500':'#4f46e5',
                                      'bg-purple-500':'#9333ea','bg-pink-500':'#db2777',
                                    };
                                    const cellBorder = borderMap[bg2] ?? '#a78bfa';
                                    const init = sup ? getInit(sup.name) : '?';
                                    const taskFontSize = months.length <= 4 ? '10px' : '8px';
                                    const taskPadH = months.length <= 4 ? '2px 4px' : '1px 2px';
                                    const taskMinH = months.length <= 4 ? '18px' : '14px';
                                    return (
                                      <div key={t.id} style={{
                                        background:cellBg, color:cellTc,
                                        border:`1.5px solid ${cellBorder}`,
                                        borderRadius:'3px', padding:taskPadH,
                                        marginBottom:'2px', fontSize:taskFontSize,
                                        fontWeight:'bold', overflow:'hidden',
                                        whiteSpace:'nowrap', textOverflow:'ellipsis',
                                        lineHeight:1.4, minHeight:taskMinH,
                                        display:'flex', alignItems:'center',
                                      }}>
                                        {init}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Légende des fournisseurs */}
                  {(() => {
                    const supplierIds = [...new Set(projectTasks.map(t => t.supplierId))];
                    const legendSuppliers = supplierIds.map(id => suppliers.find(s => s.id === id)).filter(Boolean);
                    if (legendSuppliers.length === 0) return null;
                    return (
                      <div style={{marginTop:'10px',padding:'8px 12px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:'6px',display:'flex',flexWrap:'wrap',gap:'12px',alignItems:'center'}}>
                        <div style={{fontSize:'10px',fontWeight:'bold',color:'#475569',marginRight:'4px'}}>Légende :</div>
                        {legendSuppliers.map((sup: any) => {
                          const parts = (sup.color || 'bg-gray-200 text-gray-800').split(' ');
                          const bg2 = parts[0];
                          const bgMap: Record<string,string> = {
                            'bg-red-200':'#fecaca','bg-orange-200':'#fed7aa','bg-amber-200':'#fde68a',
                            'bg-yellow-200':'#fef08a','bg-lime-200':'#d9f99d','bg-green-200':'#bbf7d0',
                            'bg-emerald-200':'#a7f3d0','bg-teal-200':'#99f6e4','bg-cyan-200':'#a5f3fc',
                            'bg-sky-200':'#bae6fd','bg-blue-200':'#bfdbfe','bg-indigo-200':'#c7d2fe',
                            'bg-violet-200':'#ddd6fe','bg-purple-200':'#e9d5ff','bg-fuchsia-200':'#f5d0fe',
                            'bg-pink-200':'#fbcfe8','bg-rose-200':'#fecdd3','bg-slate-200':'#e2e8f0',
                            'bg-gray-200':'#e5e7eb',
                            'bg-red-400':'#f87171','bg-orange-400':'#fb923c','bg-amber-400':'#fbbf24',
                            'bg-lime-400':'#a3e635','bg-green-500':'#22c55e','bg-teal-500':'#14b8a6',
                            'bg-cyan-500':'#06b6d4','bg-blue-500':'#3b82f6','bg-indigo-500':'#6366f1',
                            'bg-purple-500':'#a855f7','bg-pink-500':'#ec4899',
                          };
                          const borderMap: Record<string,string> = {
                            'bg-red-200':'#fca5a5','bg-orange-200':'#fdba74','bg-amber-200':'#fcd34d',
                            'bg-yellow-200':'#fde047','bg-lime-200':'#bef264','bg-green-200':'#86efac',
                            'bg-emerald-200':'#6ee7b7','bg-teal-200':'#5eead4','bg-cyan-200':'#67e8f9',
                            'bg-sky-200':'#7dd3fc','bg-blue-200':'#93c5fd','bg-indigo-200':'#a5b4fc',
                            'bg-violet-200':'#c4b5fd','bg-purple-200':'#d8b4fe','bg-fuchsia-200':'#e879f9',
                            'bg-pink-200':'#f9a8d4','bg-rose-200':'#fda4af',
                            'bg-red-400':'#ef4444','bg-orange-400':'#f97316','bg-amber-400':'#f59e0b',
                            'bg-lime-400':'#84cc16','bg-green-500':'#16a34a','bg-teal-500':'#0d9488',
                            'bg-cyan-500':'#0891b2','bg-blue-500':'#2563eb','bg-indigo-500':'#4f46e5',
                            'bg-purple-500':'#9333ea','bg-pink-500':'#db2777',
                          };
                          const init = sup.name.trim().split(/\s+/).slice(0,3).map((w:string)=>w[0]).join('').toUpperCase();
                          const cellBg = bgMap[bg2] ?? '#ddd6fe';
                          const cellBorder = borderMap[bg2] ?? '#a78bfa';
                          return (
                            <div key={sup.id} style={{display:'flex',alignItems:'center',gap:'5px'}}>
                              <div style={{width:'18px',height:'18px',borderRadius:'3px',background:cellBg,border:`1.5px solid ${cellBorder}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px',fontWeight:'bold',color:'#1e293b',flexShrink:0}}>
                                {init}
                              </div>
                              <span style={{fontSize:'10px',color:'#334155',fontWeight:'500'}}>{sup.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <div style={{fontSize:'10px',color:'#94a3b8',textAlign:'center',marginTop:'8px'}}>CrewFlo — Généré le {new Date().toLocaleString()}</div>
                </>
              );
            })()}
          </div>

          <div className="pdf-page bg-white p-8 mb-8 min-h-[800px]" data-pdf-type="tasklist" data-project-id={project.id}>
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Détails des tâches</h1>
                <div className="text-slate-500 text-sm">{project.name}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold bg-slate-100 px-3 py-1 rounded">{allMonthsData[0]?.monthLabel}</div>
              </div>
            </div>
            <TaskDetailsTable tasksForPage={tasks.filter(t => t.projectId === project.id)} />
            <div className="mt-4 text-xs text-slate-400 text-center">CrewFlo - Généré le {new Date().toLocaleString()}</div>
          </div>

          <div className="pdf-page bg-white p-8 mb-8 min-h-[800px]" data-pdf-type="finitions" data-project-id={project.id}>
            <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Finitions choisies</h1>
                <div className="text-slate-500 text-sm">{project.name}{project.address ? ` — ${project.address}` : ''}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold bg-slate-100 px-3 py-1 rounded">{allMonthsData[0]?.monthLabel}</div>
              </div>
            </div>
            <FinishingsPdfPage project={project} finData={finishingsMap[project.id]} />
            <div className="mt-6 text-xs text-slate-400 text-center">CrewFlo - Généré le {new Date().toLocaleString()}</div>
          </div>
        </React.Fragment>
      ))}
    </div>
      </div>

      {/* Day Details Modal (Supplier) */}
      {isDayModalOpen && dayModalDate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] transition-all transform animate-in slide-in-from-bottom duration-300">
            <div className="flex-none px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-2xl sm:rounded-t-xl">
              <button onClick={() => setIsDayModalOpen(false)} className="text-slate-500 font-medium text-sm hover:text-slate-800 px-2 py-1">Fermer</button>
              <h3 className="text-base font-bold text-slate-800">
                Tâches du {dayModalDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <div className="w-16" />
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {(() => {
                const dayTasks = getTasksForDate(dayModalDate, visibleTasks);
                if (dayTasks.length === 0) {
                  return <div className="text-sm text-slate-500">Aucune tâche cette journée.</div>;
                }

                const sorted = [...dayTasks].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

                return (
                  <div className="space-y-2">
                    {sorted.map(t => {
                      const supplier = suppliers.find(s => s.id === t.supplierId);
                      const project = projects.find(p => p.id === t.projectId);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setIsDayModalOpen(false);
                            if (canEdit) {
                              setNewTask({ ...t });
                              setSelectedTaskDays(initSelectedDaysFromRange(t.start, t.end));
                              setEditingTaskId(t.id);
                              setIsViewOnly(false);
                              setIsAllDay(new Date(t.start).getHours() === 7 || new Date(t.start).getHours() === 0);
                              setIsModalOpen(true);
                            } else {
                              openTaskViewOnly(t);
                            }
                          }}
                          className="w-full text-left p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 text-sm truncate">{supplier?.name || 'Fournisseur'}</div>
                              <div className="text-xs text-slate-500 truncate">{project?.name || 'Chantier'}</div>
                              {t.title && <div className="text-xs text-slate-700 mt-1">{t.title}</div>}
                              {t.taskStatus === 'declined' && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 mt-1">
                                  <X className="w-3 h-3" /> Refusé
                                  {t.supplierNotes?.text && <span className="font-normal">— {t.supplierNotes.text}</span>}
                                </span>
                              )}
                              {t.notes && <div className="text-xs text-slate-500 mt-1 line-clamp-2">{t.notes}</div>}
                              {t.adminNote?.text && (
                                <div className="mt-1 text-xs bg-blue-50 border border-blue-100 rounded px-2 py-1 text-blue-800">
                                  <span className="font-bold">Admin</span>: {t.adminNote.text}
                                </div>
                              )}
                              {t.supplierNotes?.text && (
                                <div className="mt-1 text-xs bg-amber-50 border border-amber-100 rounded px-2 py-1 text-amber-800">
                                  <span className="font-bold">{t.supplierNotes.authorName}</span>: {t.supplierNotes.text}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 whitespace-nowrap">
                              {new Date(t.start).toLocaleDateString('fr-FR')}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Task Modal - OPTIMIZED FOR MOBILE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] transition-all transform animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="flex-none px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-2xl sm:rounded-t-xl z-10">
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 font-medium text-sm hover:text-slate-800 px-2 py-1">{isViewOnly ? 'Fermer' : 'Annuler'}</button>
              <h3 className="text-base font-bold text-slate-800">{isViewOnly ? 'Détails' : (editingTaskId ? 'Modifier' : 'Nouveau')}</h3>
              {isViewOnly ? (
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-1.5 bg-slate-200 text-slate-700 font-medium rounded-full hover:bg-slate-300 shadow-sm text-sm">Fermer</button>
              ) : (
                <button onClick={saveTask} className="px-4 py-1.5 bg-blue-600 text-white font-medium rounded-full hover:bg-blue-700 shadow-sm text-sm">Sauvegarder</button>
              )}
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Bannière refus fournisseur — visible admin uniquement */}
              {newTask.taskStatus === 'declined' && !isViewOnly && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <X className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-700">Ce fournisseur a refusé cette tâche</p>
                    {newTask.supplierNotes?.text && (
                      <p className="text-sm text-red-600 mt-1">"{newTask.supplierNotes.text}"</p>
                    )}
                    {newTask.supplierNotes?.updatedAt && (
                      <p className="text-xs text-red-400 mt-1">
                        — {newTask.supplierNotes.authorName} · {new Date(newTask.supplierNotes.updatedAt).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Titre</label>
                <div className="relative">
                  <input
                    type="text"
                    value={newTask.title || ''}
                    disabled={isViewOnly}
                    onChange={e => { setNewTask({...newTask, title: e.target.value}); setShowTitleSuggestions(true); }}
                    onFocus={() => setShowTitleSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowTitleSuggestions(false), 200)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                    placeholder="Ex: Électricité ou choisir dans la cédule ↓"
                    autoComplete="off"
                  />
                  {showTitleSuggestions && !isViewOnly && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                      {/* Suggestions from history */}
                      {titleHistory.filter((h: string) => h.toLowerCase().includes((newTask.title || '').toLowerCase()) && h !== newTask.title).slice(0, 4).map((suggestion: string) => (
                        <button key={`hist-${suggestion}`} type="button"
                          onMouseDown={() => { setNewTask({...newTask, title: suggestion}); setShowTitleSuggestions(false); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 border-b border-slate-100 flex items-center gap-2">
                          <span className="text-slate-400 text-xs">↩</span>{suggestion}
                        </button>
                      ))}
                      {/* Predefined titles from cédule grouped by category */}
                      {(newTask.title || '').length === 0 && SCHEDULE_TEMPLATE.map(cat => {
                        const filtered = cat.items.filter(item =>
                          !titleHistory.includes(item.label)
                        );
                        if (filtered.length === 0) return null;
                        return (
                          <div key={cat.key}>
                            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                              {cat.emoji} {cat.label}
                            </div>
                            {filtered.map(item => (
                              <button key={item.key} type="button"
                                onMouseDown={() => { setNewTask({...newTask, title: item.label}); setShowTitleSuggestions(false); }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 border-b border-slate-100 flex items-center gap-2">
                                <span>{item.type === 'delivery' ? '📦' : '📅'}</span>{item.label}
                              </button>
                            ))}
                          </div>
                        );
                      })}
                      {/* Filtered predefined titles when typing */}
                      {(newTask.title || '').length > 0 && SCHEDULE_TEMPLATE.flatMap(cat =>
                        cat.items.filter(item =>
                          item.label.toLowerCase().includes((newTask.title || '').toLowerCase()) &&
                          item.label !== newTask.title
                        ).map(item => (
                          <button key={`sched-${item.key}`} type="button"
                            onMouseDown={() => { setNewTask({...newTask, title: item.label}); setShowTitleSuggestions(false); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 border-b border-slate-100 flex items-center gap-2">
                            <span>{item.type === 'delivery' ? '📦' : '📅'}</span>{item.label}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>


<div className="border border-slate-200 rounded-xl overflow-hidden">
  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
    <span className="text-xs font-bold text-slate-600 uppercase">Notes</span>
  </div>
  <div className="p-3 bg-white">
    <div className="relative">
      <textarea
        value={newTask.notes || ''}
        disabled={isViewOnly}
        onChange={e => { setNewTask({ ...newTask, notes: e.target.value }); setShowNotesSuggestions(true); }}
        onFocus={() => setShowNotesSuggestions(true)}
        onBlur={() => setTimeout(() => setShowNotesSuggestions(false), 150)}
        className="w-full min-h-[90px] p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
        placeholder="Notes internes…"
      />
      {showNotesSuggestions && !isViewOnly && (newTask.notes || '').length > 0 && notesHistory.filter((h: string) => h.toLowerCase().includes((newTask.notes || '').toLowerCase()) && h !== newTask.notes).length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-32 overflow-y-auto">
          {notesHistory.filter((h: string) => h.toLowerCase().includes((newTask.notes || '').toLowerCase()) && h !== newTask.notes).slice(0, 5).map((suggestion: string) => (
            <button key={suggestion} type="button"
              onMouseDown={() => { setNewTask({...newTask, notes: suggestion}); setShowNotesSuggestions(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 border-b border-slate-100 last:border-0 truncate">
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
</div>

{/* Note admin — bleue, éditable par admin, lecture seule pour fournisseur */}
<div className="border border-blue-200 rounded-xl overflow-hidden">
  <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
    <span className="text-xs font-bold text-blue-700 uppercase">Note de l'administrateur</span>
    {newTask.adminNote?.updatedAt && (
      <span className="text-xs text-blue-400">
        {new Date(newTask.adminNote.updatedAt).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </span>
    )}
  </div>
  <div className="p-3 bg-blue-50/40">
    {!isViewOnly ? (
      // Admin — peut écrire sa note
      <textarea
        value={newTask.adminNote?.text || ''}
        onChange={e => setNewTask({
          ...newTask,
          adminNote: {
            text: e.target.value,
            updatedAt: new Date().toISOString(),
          }
        })}
        className="w-full min-h-[70px] p-2 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm"
        placeholder="Note interne visible par le fournisseur…"
      />
    ) : (
      // Fournisseur — lecture seule
      newTask.adminNote?.text ? (
        <p className="text-sm text-blue-900 whitespace-pre-wrap">{newTask.adminNote.text}</p>
      ) : (
        <p className="text-xs text-blue-300 italic">Aucune note de l'administrateur.</p>
      )
    )}
  </div>
</div>

{/* Note du fournisseur — ambre, éditable par fournisseur, lecture seule pour admin */}
<div className="border border-amber-200 rounded-xl overflow-hidden">
  <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
    <span className="text-xs font-bold text-amber-700 uppercase">Note du fournisseur</span>
    {newTask.supplierNotes?.updatedAt && (
      <span className="text-xs text-amber-500">
        {newTask.supplierNotes.authorName} · {new Date(newTask.supplierNotes.updatedAt).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </span>
    )}
  </div>
  <div className="p-3 bg-amber-50/40">
    {isViewOnly ? (
      // Fournisseur — peut écrire sa note
      <div className="space-y-2">
        <textarea
          value={newTask.supplierNotes?.text || ''}
          onChange={e => setNewTask({
            ...newTask,
            supplierNotes: {
              text: e.target.value,
              authorName: newTask.supplierNotes?.authorName || (supplierSelf?.name ?? 'Fournisseur'),
              authorId: newTask.supplierNotes?.authorId || (supplierSelf?.id ?? ''),
              updatedAt: new Date().toISOString(),
            }
          })}
          className="w-full min-h-[70px] p-2 bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none text-sm"
          placeholder="Laisser une note sur cette tâche…"
        />
        <button
          onClick={() => {
            if (!newTask.supplierNotes?.text?.trim() || !editingTaskId) return;
            onUpdateSupplierNote?.(editingTaskId, {
              text: newTask.supplierNotes.text,
              authorName: supplierSelf?.name ?? 'Fournisseur',
              authorId: supplierSelf?.id ?? '',
              updatedAt: new Date().toISOString(),
            });
            setIsModalOpen(false);
          }}
          className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Enregistrer ma note
        </button>
      </div>
    ) : (
      // Admin — lecture seule
      newTask.supplierNotes?.text ? (
        <p className="text-sm text-amber-900 whitespace-pre-wrap">{newTask.supplierNotes.text}</p>
      ) : (
        <p className="text-xs text-amber-400 italic">Aucune note laissée par le fournisseur.</p>
      )
    )}
  </div>
</div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Chantier</label>
                    <select
                    value={newTask.projectId || ''}
                    disabled={isViewOnly || (!!currentProjectId && !editingTaskId)}
                    onChange={e => setNewTask({...newTask, projectId: e.target.value})}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none truncate"
                    >
                    <option value="" disabled>Choisir...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fournisseur</label>
                    <select
                    value={newTask.supplierId || ''}
                    disabled={isViewOnly}
                  onChange={e => setNewTask({...newTask, supplierId: e.target.value})}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none truncate"
                    >
                    <option value="" disabled>Choisir...</option>
                    {[...suppliers].sort((a,b) => a.name.localeCompare(b.name, 'fr', {sensitivity:'base'})).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex justify-between items-center mb-2">
                     <span className="text-xs font-bold text-slate-500 uppercase">Dates</span>
                     <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        {newTask.start ? formatDisplayDate(newTask.start) : '...'} → {newTask.end ? formatDisplayDate(newTask.end) : '...'}
                     </span>
                </div>
                
                {/* Compact Calendar Wrapper */}
                <div className="border border-slate-200 rounded-xl p-2 mb-3">
                   <MiniCalendarSelector />
                </div>

                {/* Toggle Jour entier */}
                <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg border border-slate-200 mb-2">
                  <span className="text-sm font-medium text-slate-700">Jour entier</span>
                  <button type="button" onClick={() => setIsAllDay(v => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isAllDay ? 'bg-blue-600' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isAllDay ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                {!isAllDay && (
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Début (H)</label>
                      <input type="time" className="w-full p-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-center font-mono"
                        value={newTask.start ? new Date(newTask.start).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : '07:00'}
                        onChange={(e) => { if (newTask.start) { const [h,m] = e.target.value.split(':'); const d = new Date(newTask.start); d.setHours(parseInt(h),parseInt(m)); setNewTask({...newTask, start: d.toISOString()}); }}} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fin (H)</label>
                      <input type="time" className="w-full p-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-center font-mono"
                        value={newTask.end ? new Date(newTask.end).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : '17:00'}
                        onChange={(e) => { if (newTask.end) { const [h,m] = e.target.value.split(':'); const d = new Date(newTask.end); d.setHours(parseInt(h),parseInt(m)); setNewTask({...newTask, end: d.toISOString()}); }}} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Footer for Delete */}
            {editingTaskId && canEdit && (
                <div className="flex-none p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl sm:rounded-b-xl flex justify-center pb-6 sm:pb-4">
                    <div className="w-full max-w-[280px]">
                        <SwipeToConfirmButton onConfirm={deleteTask} />
                    </div>
                </div>
            )}
          </div>
        </div>
      )}

      {/* PDF Export Modal */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">Télécharger PDF</h3>
              <button onClick={() => setIsPdfModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              {/* Chantier */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Chantier</label>
                <select
                  value={pdfSelectedProject}
                  onChange={e => setPdfSelectedProject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="all">Tous les chantiers</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {/* Contenu */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Contenu à inclure</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={pdfIncludeTasks} onChange={e => setPdfIncludeTasks(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                    <div>
                      <div className="text-sm font-medium text-slate-700">Calendrier visuel</div>
                      <div className="text-xs text-slate-400">Grille mensuelle avec les tâches planifiées</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={pdfIncludeTaskList ?? true} onChange={e => setPdfIncludeTaskList(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                    <div>
                      <div className="text-sm font-medium text-slate-700">Liste des tâches</div>
                      <div className="text-xs text-slate-400">Tableau détaillé : fournisseur, dates, titre, notes</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={pdfIncludeFinitions} onChange={e => setPdfIncludeFinitions(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                    <div>
                      <div className="text-sm font-medium text-slate-700">Finitions & matériaux</div>
                      <div className="text-xs text-slate-400">Spécifications confirmées par catégorie</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            <div className="px-4 pb-4 pt-2 flex gap-2">
              <button onClick={() => setIsPdfModalOpen(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50">Annuler</button>
              <button
                disabled={!pdfIncludeTasks && !pdfIncludeFinitions && !(pdfIncludeTaskList ?? true)}
                onClick={async () => {
                  setIsPdfModalOpen(false);
                  await downloadAllPDF(pdfSelectedProject === 'all' ? undefined : pdfSelectedProject, pdfIncludeTasks, pdfIncludeFinitions, pdfIncludeTaskList ?? true);
                }}
                className="flex-1 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Télécharger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cédule Modal */}
      {isScheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div style={{height:'92vh', maxHeight:'92vh'}} className="bg-white w-full sm:max-w-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-visible">
            <ProjectSchedule
              project={currentProjectId ? projects.find(p => p.id === currentProjectId) || projects[0] : projects[0]}
              suppliers={suppliers}
              existingTasks={tasks.filter(t => currentProjectId ? t.projectId === currentProjectId : true)}
              onGenerateTasks={(newTasks) => {
                const withIds = newTasks.map(t => ({
                  ...t,
                  id: crypto.randomUUID(),
                  createdAt: new Date().toISOString(),
                }));
                setTasks((prev: any) => [...prev, ...withIds]);
              }}
              onRemoveTask={(title) => {
                setTasks((prev: any) => prev.filter((t: any) =>
                  !(t.projectId === (currentProjectId || projects[0]?.id) && t.title === title)
                ));
              }}
              onClose={() => setIsScheduleOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Email Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Envoyer la cédule</h3>
              <button onClick={() => setIsEmailModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-5 py-2 flex-shrink-0">
              <p className="text-sm text-slate-500 mb-2">Sélectionner les fournisseurs à notifier :</p>
              <div className="flex gap-2">
                <button onClick={() => setSelectedEmailSuppliers(suppliers.filter(s => s.email?.trim()).map(s => s.id))}
                  className="text-xs text-blue-600 hover:underline">Tout sélectionner</button>
                <span className="text-slate-300">|</span>
                <button onClick={() => setSelectedEmailSuppliers([])}
                  className="text-xs text-slate-500 hover:underline">Tout désélectionner</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2">
              {[...suppliers].filter(s => s.email?.trim()).sort((a,b) => a.name.localeCompare(b.name,'fr',{sensitivity:'base'})).map(s => (
                <label key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selectedEmailSuppliers.includes(s.id)}
                    onChange={e => setSelectedEmailSuppliers(prev =>
                      e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id)
                    )}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`w-3 h-3 rounded-sm flex-shrink-0 ${s.color?.split(' ')[0] || 'bg-slate-300'}`} />
                    <span className="text-sm font-medium text-slate-800 truncate">{s.name}</span>
                    <span className="text-xs text-slate-400 truncate">{s.email}</span>
                  </div>
                </label>
              ))}
              {suppliers.filter(s => s.email?.trim()).length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">Aucun fournisseur avec une adresse email.</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={() => setIsEmailModalOpen(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50">Annuler</button>
              <button
                onClick={confirmSendEmail}
                disabled={selectedEmailSuppliers.length === 0}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Envoyer ({selectedEmailSuppliers.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};