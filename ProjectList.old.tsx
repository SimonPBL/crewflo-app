import React, { useState } from 'react';
import { Project } from '../types';
import { Plus, Building2, MapPin, Pencil, Check, X } from 'lucide-react';
import { SwipeToConfirmButton } from './SwipeToConfirmButton';

interface ProjectListProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
}

export const ProjectList: React.FC<ProjectListProps> = ({ projects, setProjects }) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  // États pour l'édition
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Project>>({});

  const addProject = () => {
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
    setProjects(projects.filter(p => p.id !== id));
  };

  // Fonctions d'édition
  const startEditing = (project: Project) => {
    setEditingId(project.id);
    setEditForm({ ...project });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEditing = () => {
    if (!editForm.name?.trim()) return;
    
    setProjects(projects.map(p => 
      p.id === editingId ? { ...p, ...editForm } as Project : p
    ));
    setEditingId(null);
    setEditForm({});
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="p-6 max-w-4xl mx-auto pb-20">
        <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-blue-600" />
          Gestion des Chantiers
        </h2>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8">
          <h3 className="text-lg font-semibold mb-4 text-slate-700">Nouveau Chantier</h3>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-slate-600 mb-1">Nom du projet</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
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

        <div className="grid grid-cols-1 gap-4">
          {projects.map(project => {
            const isEditing = editingId === project.id;

            return (
              <div key={project.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-4">
                <div className="flex items-start gap-4 flex-1 w-full">
                  <div className="bg-blue-100 p-3 rounded-full text-blue-600 hidden sm:block">
                    <Building2 className="w-6 h-6" />
                  </div>
                  
                  <div className="flex-1 w-full">
                    {isEditing ? (
                      // Mode Édition
                      <div className="space-y-3 w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nom du projet</label>
                              <input 
                                  type="text" 
                                  value={editForm.name || ''} 
                                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                                  className="w-full p-2 border border-slate-300 rounded text-sm focus:border-blue-500 outline-none bg-white text-slate-900"
                              />
                          </div>
                          <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Adresse</label>
                              <input 
                                  type="text" 
                                  value={editForm.address || ''} 
                                  onChange={e => setEditForm({...editForm, address: e.target.value})}
                                  className="w-full p-2 border border-slate-300 rounded text-sm focus:border-blue-500 outline-none bg-white text-slate-900"
                              />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2 justify-end sm:justify-start">
                            <button 
                              onClick={cancelEditing} 
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200"
                            >
                                <X className="w-3 h-3" /> Annuler
                            </button>
                            <button 
                              onClick={saveEditing} 
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700"
                            >
                                <Check className="w-3 h-3" /> Enregistrer
                            </button>
                        </div>
                      </div>
                    ) : (
                      // Mode Lecture
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-slate-800 text-lg">{project.name}</h4>
                          <button 
                              onClick={() => startEditing(project)} 
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Modifier"
                          >
                              <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {project.address && (
                          <div className="flex items-center gap-1 text-slate-500 text-sm mt-1">
                            <MapPin className="w-4 h-4" />
                            <span>{project.address}</span>
                          </div>
                        )}
                        
                        <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          {project.status === 'planning' ? 'Planification' : project.status === 'active' ? 'En cours' : 'Terminé'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Bouton Supprimer (masqué pendant l'édition pour éviter la confusion) */}
                {!isEditing && (
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
    </div>
  );
};