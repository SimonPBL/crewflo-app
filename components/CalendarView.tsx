import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, Supplier, Task, Conflict } from '../types';
import { ChevronLeft, ChevronRight, Plus, AlertTriangle, Download, Loader2, Mail, Users, Calendar as CalendarIcon, Clock, CheckCircle2, X } from 'lucide-react';
import { ConflictAlert } from './ConflictAlert';
import { SwipeToConfirmButton } from './SwipeToConfirmButton';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface CalendarViewProps {
  projects: Project[];
  suppliers: Supplier[];
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  currentProjectId: string | null; // null means 'all projects' (Master View)
  canEdit: boolean;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  projects,
  suppliers,
  tasks,
  setTasks,
  currentProjectId,
  canEdit
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [monthsToShow, setMonthsToShow] = useState<number>(1); // 1, 3, 6, 12
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);

  // Modale "Détails du jour" (lecture seule pour fournisseurs)
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [dayModalDate, setDayModalDate] = useState<Date | null>(null);

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false); // État pour la modale email
  const [newTask, setNewTask] = useState<Partial<Task>>({});
  const [showNotes, setShowNotes] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

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
  };

  // Helper pour formater le texte
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
    const dayOfWeek = firstDayOfMonth.getDay();
    const diff = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
    
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(firstDayOfMonth.getDate() - diff);
    startDate.setHours(0, 0, 0, 0);

    const days = [];
    const d = new Date(startDate);
    for (let i = 0; i < 42; i++) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
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

        if (t1.supplierId === t2.supplierId) {
          const start1 = new Date(t1.start).getTime();
          const end1 = new Date(t1.end).getTime();
          const start2 = new Date(t2.start).getTime();
          const end2 = new Date(t2.end).getTime();

          if (start1 < end2 && end1 > start2) {
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


  const CalendarGrid = ({ tasksToRender, interactive = true, isPdf = false }: { tasksToRender: Task[], interactive?: boolean, isPdf?: boolean }) => {
    const getTasksForDay = (date: Date) => {
        const dayStart = new Date(date);
        dayStart.setHours(0,0,0,0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23,59,59,999);
        return tasksToRender.filter(t => {
          const tStart = new Date(t.start);
          const tEnd = new Date(t.end);
          return tStart <= dayEnd && tEnd >= dayStart;
        });
    };

    const weekDaysHeader = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

    // Determine grid columns based on monthsToShow
    let gridColsClass = "flex flex-col gap-8";
    if (!isPdf && monthsToShow > 1) {
       gridColsClass = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6";
       if (monthsToShow >= 6) gridColsClass = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4";
    }
    if (isPdf) {
        // PDF Layout: For 12 months, maybe 3x4?
        gridColsClass = "grid grid-cols-3 gap-4";
        if (monthsToShow === 1) gridColsClass = "block";
    }

    return (
        <div className={gridColsClass}>
            {allMonthsData.map((monthData, idx) => (
                <div 
                    key={`${monthData.year}-${monthData.monthIndex}`} 
                    className={`border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm h-fit ${isPdf ? 'break-inside-avoid border-2 border-slate-800' : ''}`}
                >
                    {/* Month Header - Now Inside Each Card */}
                    <div className={`py-2 px-4 border-b border-slate-200 font-bold text-slate-700 text-center ${isPdf ? 'bg-slate-100 text-lg' : 'bg-slate-50'}`}>
                         {monthData.monthLabel}
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
                    {monthData.days.map((day, i) => {
                        const isToday = new Date().toDateString() === day.toDateString();
                        const isCurrentMonth = day.getMonth() === monthData.monthIndex;
                        const dayTasks = getTasksForDay(day);
                        const selected = interactive && isDaySelected(day);

                        return (
                        <div 
                            key={i} 
                            className={`
                                bg-white flex flex-col relative group 
                                ${isPdf ? 'min-h-[100px] p-1 border-r border-b border-slate-200' : 'min-h-[100px] p-1'}
                                ${!isCurrentMonth ? 'bg-slate-50/50' : ''} 
                                ${(interactive || !canEdit) ? 'hover:bg-slate-50 cursor-pointer' : ''} 
                                ${selected ? '!bg-blue-100 ring-inset ring-2 ring-blue-300' : ''}
                                transition-colors
                            `}
                            onClick={(e) => {
                              if (isPdf) return;
                              // En mode fournisseur (lecture seule), clic sur la journée = liste des tâches du jour
                              if (!canEdit) {
                                e.stopPropagation();
                                openDayDetails(day);
                              }
                            }}
                            onMouseDown={(e) => interactive && handleDayMouseDown(day, e)}
                            onMouseEnter={() => interactive && handleDayMouseEnter(day)}
                        >
                            <div className={`text-right text-xs font-medium mb-1 ${isToday ? 'text-blue-600 font-bold' : isCurrentMonth ? 'text-slate-700' : 'text-slate-400'} ${isPdf ? 'text-sm mb-2' : ''}`}>
                            <span className={`${isToday ? 'bg-blue-100 px-1.5 py-0.5 rounded-full' : ''}`}>
                                {day.getDate()}
                            </span>
                            </div>
                            <div className="flex-1 flex flex-col gap-1">
                            {dayTasks.map(task => {
                                const supplier = suppliers.find(s => s.id === task.supplierId);
                                const project = projects.find(p => p.id === task.projectId);
                                const colorClass = supplier?.color || 'bg-gray-200 text-gray-800 border-gray-300';
                                const hasConflict = conflicts.some(c => c.taskA.id === task.id || c.taskB.id === task.id);

                                return (
                                <div 
                                    key={task.id}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); if (isPdf) return; handleEditTask(e, task); }}
                                    className={`
                                    rounded border shadow-sm transition-all relative
                                    ${isPdf ? 'p-1 mb-1 border-l-2' : 'p-1 text-[10px]'}
                                    ${interactive ? 'cursor-pointer hover:brightness-95 hover:scale-[1.02] z-10' : ''}
                                    ${colorClass}
                                    ${hasConflict ? 'ring-2 ring-red-500 ring-offset-0 z-20' : ''}
                                    `}
                                >
                                    {hasConflict && (
                                    <div className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 z-20 shadow-sm border border-white">
                                        <AlertTriangle className="w-2 h-2" />
                                    </div>
                                    )}
                                    <div className="flex flex-col gap-0.5">
                                        <div className={`font-bold leading-tight break-words ${isPdf ? 'text-xs mb-0.5' : ''}`}>
                                            {formatLabel(supplier?.name)}
                                        </div>
                                        <div className={`opacity-90 leading-tight border-black/10 break-words ${isPdf ? 'text-[9px] mt-1 pt-1 border-t uppercase tracking-wide' : 'text-[9px] mt-0.5 pt-0.5 border-t'}`}>
                                            {project?.name}
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
    const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
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
      const { id, ...taskWithoutId } = newTask as Task;
      setTasks([...tasks, { id: crypto.randomUUID(), ...taskWithoutId }]);
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

  const handlePrepareEmail = () => setIsEmailModalOpen(true);

  const confirmSendEmail = () => {
    const supplierEmails = suppliers.filter(s => s.email?.trim()).map(s => s.email).join(',');
    const subject = encodeURIComponent(`Cédule Chantier - ${new Date().toLocaleDateString()}`);
    const body = encodeURIComponent(`Bonjour,\n\nVeuillez trouver ci-joint la cédule de chantier mise à jour.\n\nMerci,\nCrewFlo`);
    const link = document.createElement('a');
    link.href = `mailto:?bcc=${supplierEmails}&subject=${subject}&body=${body}`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => document.body.removeChild(link), 100);
    setIsEmailModalOpen(false);
  };

  const downloadAllPDF = async () => {
    setIsExporting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!pdfContainerRef.current) throw new Error("Container not found");
      
      // Activer la compression dans jsPDF
      const pdf = new jsPDF({ 
          orientation: 'landscape', 
          unit: 'mm', 
          format: 'a4',
          compress: true 
      });

      const pages = pdfContainerRef.current.querySelectorAll('.pdf-page');
      for (let i = 0; i < pages.length; i++) {
          const canvas = await html2canvas(pages[i] as HTMLElement, { 
              scale: 1.5, // 1.5 est un bon compromis qualité/taille
              backgroundColor: '#ffffff' 
          });
          
          if (i > 0) pdf.addPage('a4', 'landscape');
          
          // Conversion en JPEG (image/jpeg) avec qualité 0.75 (75%) au lieu de PNG
          // Le PNG est très lourd pour les images complexes. Le JPEG réduit massivement la taille.
          const imgData = canvas.toDataURL('image/jpeg', 0.75);
          
          // Ajout avec compression FAST
          pdf.addImage(imgData, 'JPEG', 0, 0, 297, (canvas.height * 297) / canvas.width, undefined, 'FAST');
      }
      pdf.save(`Rapport_Chantier_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la génération du PDF");
    } finally {
      setIsExporting(false);
    }
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
    if (currentProjectId) filtered = tasks.filter(t => t.projectId === currentProjectId);
    return filtered;
  }, [tasks, currentProjectId]);

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="flex-none flex flex-col md:flex-row items-center justify-between p-4 bg-white border-b border-slate-200 gap-4 md:gap-0 z-20 shadow-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-xl font-bold text-slate-800 hidden lg:block">
            {currentProjectId ? projects.find(p => p.id === currentProjectId)?.name : "Vue d'ensemble"}
          </h2>
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
            <button onClick={prevPeriod} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronLeft className="w-5 h-5" /></button>
            <span className="px-4 text-sm font-bold capitalize min-w-[140px] text-center">{allMonthsData[0]?.monthLabel}</span>
            <button onClick={nextPeriod} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronRight className="w-5 h-5" /></button>
          </div>
          <button onClick={goToToday} className="text-xs font-medium text-blue-600 hover:text-blue-800 underline">Aujourd'hui</button>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            {/* Navigation Multi-Mois - Visible sur mobile aussi maintenant */}
            <div className="flex bg-slate-100 rounded-lg p-1 overflow-x-auto">
                {[1, 3, 6, 12].map(num => (
                    <button key={num} onClick={() => setMonthsToShow(num)} className={`px-2 sm:px-3 py-1.5 text-xs font-medium rounded transition-all whitespace-nowrap ${monthsToShow === num ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>{num} Mois</button>
                ))}
            </div>
            <div className="flex items-center gap-2">
                <button onClick={handlePrepareEmail} className="p-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 shadow-sm block"><Mail className="w-4 h-4" /></button>
                <button onClick={downloadAllPDF} disabled={isExporting} className="p-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 shadow-sm block">{isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}</button>
                                {canEdit && (
<button 
                    onClick={() => {
                    if (!canEdit) return;

                    if (!canEdit) return;

                    const now = new Date();
                    const start = new Date(now); start.setHours(7,0,0,0);
                    const end = new Date(now); end.setHours(17,0,0,0);
                    const startIso = start.toISOString();
                    const endIso = end.toISOString();
                    setNewTask({ projectId: currentProjectId || (projects.length > 0 ? projects[0].id : ''), start: startIso, end: endIso, supplierId: suppliers.length > 0 ? suppliers[0].id : '' });
                    setSelectedTaskDays(initSelectedDaysFromRange(startIso, endIso));
                    setEditingTaskId(null);
        setIsViewOnly(false);
        setIsModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm shadow-sm"
                >
                    <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Tâche</span>
                </button>
                )}
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-100 relative">
        <div className="p-4 min-h-full select-none">
          <ConflictAlert conflicts={conflicts} />
          <CalendarGrid tasksToRender={visibleTasks} interactive={canEdit} />
        </div>
      </div>

      {isExporting && (
  <div className="fixed top-0 left-0 z-[-50] w-[1300px] pointer-events-none opacity-0 overflow-hidden">
    <div ref={pdfContainerRef}>
      {/* Page 1 — Calendrier global */}
      <div className="pdf-page bg-white p-8 mb-8 min-h-[800px]">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Calendrier Global</h1>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold bg-slate-100 px-3 py-1 rounded">{allMonthsData[0]?.monthLabel}</div>
          </div>
        </div>
        <p className="text-slate-500">CrewFlo - Vue d'ensemble</p>
        <CalendarGrid tasksToRender={tasks} interactive={false} isPdf={true} />
        <div className="mt-4 text-xs text-slate-400 text-center">CrewFlo - Généré le {new Date().toLocaleString()}</div>
      </div>

      {/* Page 2 — Détails des tâches (global) */}
      <div className="pdf-page bg-white p-8 mb-8 min-h-[800px]">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Détails des tâches</h1>
            <div className="text-slate-500 text-sm">Calendrier Global</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold bg-slate-100 px-3 py-1 rounded">{allMonthsData[0]?.monthLabel}</div>
          </div>
        </div>
        <TaskDetailsTable tasksForPage={tasks} />
        <div className="mt-4 text-xs text-slate-400 text-center">CrewFlo - Généré le {new Date().toLocaleString()}</div>
      </div>

      {/* Pages par chantier */}
      {projects.map((project) => (
        <React.Fragment key={project.id}>
          <div className="pdf-page bg-white p-8 mb-8 min-h-[800px]">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">{project.name}</h1>
                <p className="text-slate-500">{project.address}</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold bg-slate-100 px-3 py-1 rounded">{allMonthsData[0]?.monthLabel}</div>
              </div>
            </div>
            <CalendarGrid tasksToRender={tasks.filter(t => t.projectId === project.id)} interactive={false} isPdf={true} />
            <div className="mt-4 text-xs text-slate-400 text-center">CrewFlo - Généré le {new Date().toLocaleString()}</div>
          </div>

          <div className="pdf-page bg-white p-8 mb-8 min-h-[800px]">
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
        </React.Fragment>
      ))}
    </div>
  </div>
)}

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
                            openTaskViewOnly(t);
                          }}
                          className="w-full text-left p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 text-sm truncate">{supplier?.name || 'Fournisseur'}</div>
                              <div className="text-xs text-slate-500 truncate">{project?.name || 'Chantier'}</div>
                              {t.title && <div className="text-xs text-slate-700 mt-1">{t.title}</div>}
                              {t.notes && <div className="text-xs text-slate-500 mt-1 line-clamp-2">{t.notes}</div>}
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
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Titre</label>
                <input
                  type="text"
                  value={newTask.title || ''}
                  disabled={isViewOnly}
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                  placeholder="Ex: Électricité"
                />
              </div>


<div className="border border-slate-200 rounded-xl overflow-hidden">
  <button
    type="button"
    onClick={() => setShowNotes(v => !v)}
    className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100"
  >
    <span className="text-xs font-bold text-slate-600 uppercase">Notes</span>
    <span className="text-xs text-slate-500">{showNotes ? 'Masquer' : 'Afficher'}</span>
  </button>
  {showNotes && (
    <div className="p-3 bg-white">
      <textarea
        value={newTask.notes || ''}
        disabled={isViewOnly}
                  onChange={e => setNewTask({ ...newTask, notes: e.target.value })}
        className="w-full min-h-[90px] p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
        placeholder="Notes internes (non visibles dans la vue globale du calendrier)…"
      />
    </div>
  )}
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
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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

                <div className="grid grid-cols-2 gap-3">
                     <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Début (H)</label>
                        <input 
                            type="time" 
                            className="w-full p-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-center font-mono"
                            value={newTask.start ? new Date(newTask.start).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : '07:00'}
                            onChange={(e) => {
                                if(newTask.start) {
                                    const [h, m] = e.target.value.split(':');
                                    const d = new Date(newTask.start);
                                    d.setHours(parseInt(h), parseInt(m));
                                    setNewTask({...newTask, start: d.toISOString()});
                                }
                            }}
                        />
                     </div>
                     <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fin (H)</label>
                         <input 
                            type="time" 
                            className="w-full p-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-center font-mono"
                            value={newTask.end ? new Date(newTask.end).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : '17:00'}
                            onChange={(e) => {
                                if(newTask.end) {
                                    const [h, m] = e.target.value.split(':');
                                    const d = new Date(newTask.end);
                                    d.setHours(parseInt(h), parseInt(m));
                                    setNewTask({...newTask, end: d.toISOString()});
                                }
                            }}
                        />
                     </div>
                </div>
              </div>
            </div>

            {/* Sticky Footer for Delete */}
            {editingTaskId && (
                <div className="flex-none p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl sm:rounded-b-xl flex justify-center pb-6 sm:pb-4">
                    <div className="w-full max-w-[280px]">
                        <SwipeToConfirmButton onConfirm={deleteTask} />
                    </div>
                </div>
            )}
          </div>
        </div>
      )}

      {/* Email Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
            <button onClick={() => setIsEmailModalOpen(false)} className="absolute top-4 right-4 text-slate-400"><X className="w-5 h-5" /></button>
            <h3 className="text-lg font-bold mb-4">Confirmation d'envoi</h3>
            <p className="text-sm text-slate-600 mb-6">Envoyer la cédule à {suppliers.filter(s => s.email).length} fournisseurs ?</p>
            <div className="flex justify-end gap-3">
                <button onClick={() => setIsEmailModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
                <button onClick={confirmSendEmail} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2"><Mail className="w-4 h-4" /> Envoyer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};