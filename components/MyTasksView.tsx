import React, { useState } from 'react';
import { Task, Supplier, Project } from '../types';
import { Check, Pencil, ChevronDown, ChevronUp, X } from 'lucide-react';

interface MyTasksViewProps {
  tasks: Task[];
  suppliers: Supplier[];
  projects: Project[];
  supplierSelf: Supplier | null;
  canEdit: boolean;
  onConfirmTask: (taskId: string) => void;
  onDeclineTask: (taskId: string) => void;
  onResetTask: (taskId: string) => void;
  onUpdateSupplierNote: (taskId: string, note: { text: string; authorName: string; authorId: string; updatedAt: string }) => void;
}

interface TaskCardProps {
  task: Task;
  suppliers: Supplier[];
  projects: Project[];
  supplierSelf: Supplier | null;
  onConfirmTask: (taskId: string) => void;
  onDeclineTask: (taskId: string) => void;
  onResetTask: (taskId: string) => void;
  onUpdateSupplierNote: (taskId: string, note: { text: string; authorName: string; authorId: string; updatedAt: string }) => void;
}

const formatDate = (isoStr: string) =>
  new Date(isoStr).toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'long' });

// ── TaskCard extrait en composant top-level pour éviter le remount à chaque frappe ──
const TaskCard: React.FC<TaskCardProps> = ({
  task,
  suppliers,
  projects,
  supplierSelf,
  onConfirmTask,
  onDeclineTask,
  onResetTask,
  onUpdateSupplierNote,
}) => {
  // State LOCAL au card — stable entre les re-renders du parent
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState('');
  const [isDeclining, setIsDeclining] = useState(false);
  const [declineNoteValue, setDeclineNoteValue] = useState('');

  const supplier = suppliers.find(s => s.id === task.supplierId);
  const project = projects.find(p => p.id === task.projectId);

  const sameDay = task.start.slice(0, 10) === task.end.slice(0, 10);
  const dateDisplay = sameDay
    ? formatDate(task.start)
    : `${formatDate(task.start)} → ${formatDate(task.end)}`;

  const isNewTask = !!task.createdAt && Date.now() - new Date(task.createdAt).getTime() < 48 * 60 * 60 * 1000;

  // Statut effectif (taskStatus prioritaire, confirmedBySupplier pour compat)
  const effectiveStatus = task.taskStatus ?? (task.confirmedBySupplier ? 'confirmed' : 'pending');

  const startEditNote = () => {
    setNoteValue(task.supplierNotes?.text || '');
    setIsEditingNote(true);
  };

  const saveNote = () => {
    onUpdateSupplierNote(task.id, {
      text: noteValue,
      authorName: supplierSelf?.name ?? 'Fournisseur',
      authorId: supplierSelf?.id ?? '',
      updatedAt: new Date().toISOString(),
    });
    setIsEditingNote(false);
  };

  const handleDeclineConfirm = () => {
    if (declineNoteValue.trim()) {
      onUpdateSupplierNote(task.id, {
        text: declineNoteValue.trim(),
        authorName: supplierSelf?.name ?? 'Fournisseur',
        authorId: supplierSelf?.id ?? '',
        updatedAt: new Date().toISOString(),
      });
    }
    onDeclineTask(task.id);
    setIsDeclining(false);
    setDeclineNoteValue('');
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
      {/* Top row */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {supplier && (
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${supplier.color}`}>
            {supplier.name}
          </span>
        )}
        <span className="text-xs text-slate-500 truncate flex-1">{project?.name}</span>
        {isNewTask && (
          <span className="bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            Nouveau
          </span>
        )}
      </div>

      {/* Title */}
      <div className="font-bold text-slate-800 mb-1">{task.title}</div>

      {/* Date range */}
      <div className="text-xs text-slate-500 mb-3">{dateDisplay}</div>

      {/* Notes internes admin (champ notes) */}
      {task.notes && (
        <div className="bg-slate-50 rounded-lg p-2 mb-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Note interne</div>
          <div className="text-sm text-slate-600">{task.notes}</div>
        </div>
      )}

      {/* Note admin — visible par le fournisseur, lecture seule */}
      {task.adminNote?.text && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Message de l'administrateur</span>
            {task.adminNote.updatedAt && (
              <span className="text-xs text-blue-400">
                {new Date(task.adminNote.updatedAt).toLocaleDateString('fr-CA', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                })}
              </span>
            )}
          </div>
          <p className="text-sm text-blue-900">{task.adminNote.text}</p>
        </div>
      )}

      {/* Supplier notes display */}
      {task.supplierNotes?.text && !isEditingNote && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Ma note</span>
            <span className="text-xs text-amber-600">
              {new Date(task.supplierNotes.updatedAt).toLocaleDateString('fr-CA', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })}
            </span>
          </div>
          <p className="text-sm text-amber-900">{task.supplierNotes.text}</p>
        </div>
      )}

      {/* Edit note inline */}
      {isEditingNote && (
        <div className="mb-2">
          <textarea
            value={noteValue}
            onChange={e => setNoteValue(e.target.value)}
            className="w-full p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 outline-none focus:ring-2 focus:ring-amber-400 min-h-[80px]"
            placeholder="Ajouter une note..."
            autoFocus
          />
          <div className="flex gap-2 mt-1 justify-end">
            <button
              onClick={() => setIsEditingNote(false)}
              className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
            >
              Annuler
            </button>
            <button
              onClick={saveNote}
              className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* Bottom row — statut 3 états */}
      <div className="mt-3 pt-2 border-t border-slate-100">
        {effectiveStatus === 'declined' ? (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-red-600">
              <X className="w-3.5 h-3.5" /> Refusé
            </span>
            <button
              onClick={() => onResetTask(task.id)}
              className="text-xs px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Annuler le refus
            </button>
          </div>
        ) : effectiveStatus === 'confirmed' ? (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs font-bold text-green-600">
              <Check className="w-3.5 h-3.5" /> Confirmé
            </span>
            <button
              onClick={() => onResetTask(task.id)}
              className="text-xs px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Annuler
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <button
                onClick={() => onConfirmTask(task.id)}
                className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Confirmer
              </button>
              <button
                onClick={() => { setIsDeclining(true); setDeclineNoteValue(''); }}
                className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" /> Refuser
              </button>
            </div>

            {/* Étape de confirmation du refus */}
            {isDeclining && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
                <p className="text-xs text-red-700 font-medium">Laisser une note de disponibilité (optionnel) :</p>
                <textarea
                  value={declineNoteValue}
                  onChange={e => setDeclineNoteValue(e.target.value)}
                  className="w-full p-2 text-sm border border-red-200 rounded-lg bg-white focus:ring-2 focus:ring-red-300 outline-none min-h-[60px]"
                  placeholder="Ex: Non disponible cette semaine, retour le 23 juin..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setIsDeclining(false); setDeclineNoteValue(''); }}
                    className="flex-1 py-1.5 text-sm text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleDeclineConfirm}
                    className="flex-1 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg font-medium"
                  >
                    Confirmer le refus
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Bouton note — visible quand pas en mode édition ni refusé */}
        {!isEditingNote && effectiveStatus !== 'declined' && (
          <div className="flex justify-end mt-2">
            <button
              onClick={startEditNote}
              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
              title="Ajouter / modifier ma note"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── MyTasksView ──────────────────────────────────────────────────────────────
export const MyTasksView: React.FC<MyTasksViewProps> = ({
  tasks,
  suppliers,
  projects,
  supplierSelf,
  onConfirmTask,
  onDeclineTask,
  onResetTask,
  onUpdateSupplierNote,
}) => {
  const [showPast, setShowPast] = useState(false);

  const filtered = supplierSelf
    ? tasks.filter(t => t.supplierId === supplierSelf.id)
    : tasks;

  const sorted = [...filtered].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in14days = new Date(today); in14days.setDate(in14days.getDate() + 14);

  const upcomingGroup = sorted.filter(
    t => new Date(t.end) >= today && new Date(t.start) <= in14days
  );
  const futureGroup = sorted.filter(
    t => new Date(t.end) >= today && new Date(t.start) > in14days
  );
  const pastGroup = [...sorted]
    .filter(t => new Date(t.end) < today)
    .reverse();

  const cardProps = { suppliers, projects, supplierSelf, onConfirmTask, onDeclineTask, onResetTask, onUpdateSupplierNote };

  const SectionHeader = ({ title }: { title: string }) => (
    <div className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">{title}</div>
  );

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="p-4 sm:p-6 max-w-2xl mx-auto pb-20 sm:pb-6">
        <h2 className="text-2xl font-bold mb-6 text-slate-800">Mes Tâches</h2>

        {upcomingGroup.length === 0 && futureGroup.length === 0 && pastGroup.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-lg">
            Aucune tâche à venir 🎉
          </div>
        )}

        {upcomingGroup.length > 0 && (
          <div className="mb-6">
            <SectionHeader title="Cette semaine & semaine prochaine" />
            <div className="space-y-3">
              {upcomingGroup.map(task => <TaskCard key={task.id} task={task} {...cardProps} />)}
            </div>
          </div>
        )}

        {futureGroup.length > 0 && (
          <div className="mb-6">
            <SectionHeader title="À venir" />
            <div className="space-y-3">
              {futureGroup.map(task => <TaskCard key={task.id} task={task} {...cardProps} />)}
            </div>
          </div>
        )}

        {pastGroup.length > 0 && (
          <div>
            <button
              onClick={() => setShowPast(!showPast)}
              className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 hover:text-slate-700 transition-colors"
            >
              {showPast ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Passées ({pastGroup.length})
            </button>
            {showPast && (
              <div className="space-y-3">
                {pastGroup.map(task => <TaskCard key={task.id} task={task} {...cardProps} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
