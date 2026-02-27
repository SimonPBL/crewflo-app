import React, { useState } from 'react';
import { Project } from '../types';
import { Plus, Building2, MapPin, Pencil, Check, X, ClipboardList, Info } from 'lucide-react';
import { SwipeToConfirmButton } from './SwipeToConfirmButton';
import { ProjectFinishingsPanel } from './ProjectFinishingsPanel';

interface ProjectListProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  canEdit?: boolean;
}

type ModalTab = 'infos' | 'finitions';

export const ProjectList: React.FC<ProjectListProps> = ({ projects, setProjects, canEdit = true }) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Project>>({});

  // Modal
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<ModalTab>('infos');

  const addProject = () => {
    if (!canEdit) return;
    if (!name.trim()) return;
    const newProject: Project = {
      id: crypto.randomUUID(),
      name,
      address,
      status: 'planning'
    };
    setProjects([...projects, newProject]);
    setName('');
    setAddress('');
  };

  const deleteProject = (id: string) => {
    if (!canEdit) return;
    setProjects(projects.filter(p => p.id !== id));
  };

  const startEditing = (project: Project) => {
    if (!canEdit) return;
    setEditingId(project.id);
    setEditForm({ ...project });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEditing = () => {
    if (!canEdit) return;
    if (!editForm.name?.trim()) return;
    setProjects(projects.map(p =>
      p.id === editingId ? { ...p, ...editForm } as Project : p
    ));
    // Mettre à jour le projet dans la modal si ouvert
    if (selectedProject?.id === editingId) {
      setSelectedProject({ ...selectedProject, ...editForm } as Project);
    }
    setEditingId(null);
    setEditForm({});
  };

  const openModal = (project: Project) => {
    setSelectedProject(project);
    setActiveTab('infos');
  };

  const closeModal = () => {
    setSelectedProject(null);
  };

  const statusLabel = (status: Project['status']) => {
    if (status === 'planning') return { label: 'Planification', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
    if (status === 'active') return { label: 'En cours', cls: 'bg-green-100 text-green-700 border-green-200' };
    return { label: 'Terminé', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="p-6 max-w-4xl mx-auto pb-20">
        <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-blue-600" />
          Gestion des Chantiers
        </h2>

        {/* Formulaire nouveau chantier */}
        {canEdit && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8">
            <h3 className="text-lg font-semibold mb-4 text-slate-700">Nouveau Chantier</h3>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-slate-600 mb-1">Nom du projet</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addProject()}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900"
                  placeholder="Ex: Résidence Belle-Vue Phase 1"
                />
              </div>
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-slate-600 mb-1">Adresse</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addProject()}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900"
                  placeholder="Ex: 123 Rue Principale"
                />
              </div>
              <button
                onClick={addProject}
                className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Créer
              </button>
            </div>
          </div>
        )}

        {/* Liste des chantiers */}
        <div className="grid grid-cols-1 gap-4">
          {projects.map(project => {
            const isEditing = editingId === project.id;
            const st = statusLabel(project.status);

            return (
              <div key={project.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-4">
                <div className="flex items-start gap-4 flex-1 w-full">
                  <div className="bg-blue-100 p-3 rounded-full text-blue-600 hidden sm:block flex-shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>

                  <div className="flex-1 w-full">
                    {isEditing ? (
                      <div className="space-y-3 w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nom du projet</label>
                            <input
                              type="text"
                              value={editForm.name || ''}
                              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                              className="w-full p-2 border border-slate-300 rounded text-sm focus:border-blue-500 outline-none bg-white text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Adresse</label>
                            <input
                              type="text"
                              value={editForm.address || ''}
                              onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                              className="w-full p-2 border border-slate-300 rounded text-sm focus:border-blue-500 outline-none bg-white text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Statut</label>
                            <select
                              value={editForm.status || 'planning'}
                              onChange={e => setEditForm({ ...editForm, status: e.target.value as Project['status'] })}
                              className="w-full p-2 border border-slate-300 rounded text-sm focus:border-blue-500 outline-none bg-white text-slate-900"
                            >
                              <option value="planning">Planification</option>
                              <option value="active">En cours</option>
                              <option value="completed">Terminé</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2 justify-end sm:justify-start">
                          <button onClick={cancelEditing} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200">
                            <X className="w-3 h-3" /> Annuler
                          </button>
                          <button onClick={saveEditing} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700">
                            <Check className="w-3 h-3" /> Enregistrer
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="font-bold text-slate-800 text-lg">{project.name}</h4>
                          {canEdit && (
                            <button
                              onClick={() => startEditing(project)}
                              className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Modifier"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {project.address && (
                          <div className="flex items-center gap-1 text-slate-500 text-sm mt-1">
                            <MapPin className="w-4 h-4" />
                            <span>{project.address}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${st.cls}`}>
                            {st.label}
                          </span>
                          {/* Bouton Finitions */}
                          <button
                            onClick={() => openModal(project)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          >
                            <ClipboardList className="w-3.5 h-3.5" />
                            Finitions & Notes
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {!isEditing && canEdit && (
                  <div className="w-full lg:w-auto min-w-[200px] flex justify-end">
                    <SwipeToConfirmButton onConfirm={() => deleteProject(project.id)} className="lg:max-w-[220px]" />
                  </div>
                )}
              </div>
            );
          })}

          {projects.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              Aucun chantier actif. Créez votre premier projet.
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL FINITIONS ─────────────────────────────────────── */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[85vh] overflow-hidden">

            {/* Header modal */}
            <div className="flex items-start justify-between p-4 border-b border-slate-200 flex-shrink-0">
              <div>
                <h3 className="font-bold text-lg text-slate-900">{selectedProject.name}</h3>
                {selectedProject.address && (
                  <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" /> {selectedProject.address}
                  </p>
                )}
              </div>
              <button onClick={closeModal} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Onglets */}
            <div className="flex border-b border-slate-200 flex-shrink-0">
              <button
                onClick={() => setActiveTab('infos')}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'infos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Info className="w-4 h-4" /> Infos
              </button>
              <button
                onClick={() => setActiveTab('finitions')}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'finitions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <ClipboardList className="w-4 h-4" /> Finitions & Notes
              </button>
            </div>

            {/* Contenu onglets */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {activeTab === 'infos' && (
                <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Nom du projet</p>
                      <p className="font-semibold text-slate-800">{selectedProject.name}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Adresse</p>
                      <p className="font-semibold text-slate-800">{selectedProject.address || '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Statut</p>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${statusLabel(selectedProject.status).cls}`}>
                        {statusLabel(selectedProject.status).label}
                      </span>
                    </div>
                  </div>
                  <div className="text-center pt-4">
                    <button
                      onClick={() => setActiveTab('finitions')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      <ClipboardList className="w-4 h-4" />
                      Voir les Finitions & Notes
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'finitions' && (
                <ProjectFinishingsPanel
                  projectId={selectedProject.id}
                  canEdit={canEdit}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
