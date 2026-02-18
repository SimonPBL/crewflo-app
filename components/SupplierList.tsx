import React, { useState } from 'react';
import { Supplier, TRADES, COLORS } from '../types';
import { Plus, User, Briefcase, Mail, Pencil, Check, X, Palette, Zap, Droplets, Hammer, Paintbrush, Building2, Home, Flower2, Fan, Utensils } from 'lucide-react';
import { SwipeToConfirmButton } from './SwipeToConfirmButton';

interface SupplierListProps {
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  canEdit: boolean;
}

export const SupplierList: React.FC<SupplierListProps> = ({ suppliers, setSuppliers, canEdit: canEditProp }) => {
  // Enforce role-based read-only (defense-in-depth)
  const role = (localStorage.getItem("crewflo_role") || "").toLowerCase();
  const canEdit = !!canEditProp && role === "admin";
  // State pour l'ajout
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierTrade, setNewSupplierTrade] = useState(TRADES[0]);
  const [newSupplierEmail, setNewSupplierEmail] = useState('');
  const [newSupplierColor, setNewSupplierColor] = useState(COLORS[0]);

  // State pour l'édition
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Supplier>>({});

  const addSupplier = () => {
    if (!canEdit) return;
    if (!newSupplierName.trim()) return;
    
    const newSupplier: Supplier = {
      id: crypto.randomUUID(),
      name: newSupplierName,
      trade: newSupplierTrade,
      email: newSupplierEmail,
      color: newSupplierColor,
    };
    setSuppliers([...suppliers, newSupplier]);
    
    // Reset form
    setNewSupplierName('');
    setNewSupplierEmail('');
    setNewSupplierColor(COLORS[Math.floor(Math.random() * COLORS.length)]); // Pick random for next one
  };

  const deleteSupplier = (id: string) => {
    if (!canEdit) return;
    setSuppliers(suppliers.filter(s => s.id !== id));
  };

  const startEditing = (supplier: Supplier) => {
    if (!canEdit) return;
    setEditingId(supplier.id);
    setEditForm({ ...supplier });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEditing = () => {
    if (!canEdit) return;
    if (!editForm.name?.trim()) return;
    
    setSuppliers(suppliers.map(s => 
      s.id === editingId ? { ...s, ...editForm } as Supplier : s
    ));
    setEditingId(null);
    setEditForm({});
  };

  // Helper pour les icônes de métier
  const getTradeIcon = (trade: string) => {
    switch (trade) {
      case 'Électricien': return <Zap className="w-5 h-5 text-yellow-500" />;
      case 'Plombier': return <Droplets className="w-5 h-5 text-blue-500" />;
      case 'Ventilation': return <Fan className="w-5 h-5 text-cyan-600" />;
      case 'Charpentier': return <Hammer className="w-5 h-5 text-amber-700" />;
      case 'Peintre': return <Paintbrush className="w-5 h-5 text-purple-500" />;
      case 'Maçon': return <Building2 className="w-5 h-5 text-red-700" />;
      case 'Couvreur': return <Home className="w-5 h-5 text-slate-600" />;
      case 'Paysagiste': return <Flower2 className="w-5 h-5 text-green-600" />;
      case 'Cuisiniste': return <Utensils className="w-5 h-5 text-orange-500" />;
      default: return <Briefcase className="w-5 h-5 text-slate-400" />;
    }
  };

  // Composant helper pour le choix de couleur
  const ColorPicker = ({ selected, onSelect }: { selected: string, onSelect: (c: string) => void }) => (
    <div className="flex flex-wrap gap-2 mt-2">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onSelect(c)}
          className={`
            w-6 h-6 rounded-full border transition-all flex items-center justify-center
            ${c.split(' ')[0]} ${c.split(' ')[2]} 
            ${selected === c ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'}
          `}
          title="Choisir cette couleur"
        >
          {selected === c && <Check className={`w-3 h-3 ${c.includes('bg-slate') || c.includes('bg-gray') ? 'text-black' : 'text-slate-900'}`} />}
        </button>
      ))}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="p-4 sm:p-6 max-w-6xl mx-auto pb-20 sm:pb-6">
        <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
          <User className="w-6 h-6 text-blue-600" />
          Gestion des Fournisseurs
        </h2>

        {/* Formulaire d'ajout */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8">
          <h3 className="text-lg font-semibold mb-4 text-slate-700">Ajouter un nouveau fournisseur</h3>
          {!canEdit && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Mode fournisseur : vous pouvez consulter la liste, mais vous ne pouvez pas ajouter, modifier ou supprimer des fournisseurs.
            </div>
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Champs texte */}
            <div className="lg:col-span-4">
              <label className="block text-sm font-medium text-slate-600 mb-1">Nom de l'entreprise</label>
              <input
  type="text"
  value={newSupplierName}
  disabled={!canEdit}
  onChange={(e) => setNewSupplierName(e.target.value)}
  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
  placeholder="Ex: Plomberie Tremblay Inc."
/>

            </div>
            
            <div className="lg:col-span-4">
              <label className="block text-sm font-medium text-slate-600 mb-1">Emails (séparés par virgule)</label>
              <input
                type="text"
                value={newSupplierEmail}
                onChange={(e) => setNewSupplierEmail(e.target.value)}
                disabled={!canEdit}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                placeholder="ex: contact@abc.com, comptabilite@abc.com"
              />
            </div>

            <div className="lg:col-span-4">
              <label className="block text-sm font-medium text-slate-600 mb-1">Corps de métier</label>
              <select
                value={newSupplierTrade}
                onChange={(e) => setNewSupplierTrade(e.target.value)}
                disabled={!canEdit}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
              >
                {TRADES.map(trade => (
                  <option key={trade} value={trade}>{trade}</option>
                ))}
              </select>
            </div>

            {/* Sélecteur de couleur */}
            <div className="lg:col-span-12">
              <label className="block text-sm font-medium text-slate-600 mb-1 flex items-center gap-2">
                <Palette className="w-4 h-4" /> Code Couleur
              </label>
              {canEdit ? (
              <ColorPicker selected={newSupplierColor} onSelect={setNewSupplierColor} />
            ) : (
              <div className={`h-10 rounded-lg border border-slate-200 ${newSupplierColor}`} />
            )}
            </div>

            <div className="lg:col-span-12 flex justify-end mt-2">
              <button
                  onClick={canEdit ? addSupplier : undefined}
                  disabled={!canEdit}
                  className={`w-full sm:w-auto px-6 py-2.5 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm ${canEdit ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-200 text-slate-500 cursor-not-allowed"}`}
              >
                  <Plus className="w-4 h-4" /> Ajouter le fournisseur
              </button>
            </div>
          </div>
        </div>

        {/* Liste des cartes */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers.map(supplier => {
              const isEditing = editingId === supplier.id;

              return (
                <div key={supplier.id} className={`p-4 rounded-xl border border-slate-200 shadow-sm relative group bg-white flex flex-col justify-between min-h-[200px]`}>
                  {/* Bande latérale de couleur */}
                  <div className={`absolute top-0 left-0 w-1.5 h-full rounded-l-xl ${isEditing && editForm.color ? editForm.color.split(' ')[0] : supplier.color.split(' ')[0]}`}></div>
                  
                  <div className="pl-3 w-full">
                    {isEditing ? (
                      // Mode Édition
                      <div className="space-y-3 mb-4">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Nom</label>
                              <input 
                              type="text" 
                              value={editForm.name || ''} 
                              onChange={e => setEditForm({...editForm, name: e.target.value})}
                              className="w-full p-1.5 border border-slate-300 rounded text-sm focus:border-blue-500 outline-none bg-white"
                              />
                          </div>
                          <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Métier</label>
                              <select
                              value={editForm.trade || ''}
                              onChange={e => setEditForm({...editForm, trade: e.target.value})}
                              className="w-full p-1.5 border border-slate-300 rounded text-sm focus:border-blue-500 outline-none bg-white"
                              >
                              {TRADES.map(trade => (
                                  <option key={trade} value={trade}>{trade}</option>
                              ))}
                              </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Emails (séparés par virgule)</label>
                          <input 
                            type="text" 
                            value={editForm.email || ''} 
                            onChange={e => setEditForm({...editForm, email: e.target.value})}
                            className="w-full p-1.5 border border-slate-300 rounded text-sm focus:border-blue-500 outline-none bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Couleur</label>
                          <ColorPicker 
                              selected={editForm.color || COLORS[0]} 
                              onSelect={(c) => setEditForm({...editForm, color: c})} 
                          />
                        </div>
                      </div>
                    ) : (
                      // Mode Lecture
                      <>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3 truncate pr-2 w-full">
                            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex-shrink-0">
                                {getTradeIcon(supplier.trade)}
                            </div>
                            <h4 className="font-bold text-slate-800 text-lg truncate">{supplier.name}</h4>
                          </div>
                          <button 
                            onClick={canEdit ? () => startEditing(supplier) : undefined}
                            disabled={!canEdit}
                            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${canEdit ? "text-slate-400 hover:text-blue-600 hover:bg-blue-50" : "text-slate-300 cursor-not-allowed"}`}
                            title={canEdit ? "Modifier" : "Lecture seule"}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2 text-slate-600 text-sm mt-1">
                          <Briefcase className="w-4 h-4 text-slate-400" />
                          <span>{supplier.trade}</span>
                        </div>

                        {supplier.email && (
                          <div className="flex items-center gap-2 text-slate-600 text-sm mt-1 overflow-hidden" title={supplier.email}>
                            <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <a href={`mailto:${supplier.email}`} className="hover:underline hover:text-blue-600 truncate block w-full">
                              {supplier.email}
                            </a>
                          </div>
                        )}

                        <div className={`mt-3 inline-block px-2 py-1 rounded text-xs font-semibold ${supplier.color} shadow-sm border`}>
                          Aperçu Étiquette
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 pl-3">
                      {isEditing ? (
                        <div className="flex gap-2 justify-end">
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
                      ) : (
                        <>
                          {canEdit ? (
                            <SwipeToConfirmButton onConfirm={() => deleteSupplier(supplier.id)} label="Supprimer" className="h-8 text-[10px]" />
                          ) : (
                            <div className="text-xs text-slate-400">Lecture seule</div>
                          )}
                        </>
                      )}
                  </div>
                </div>
              );
          })}
          {suppliers.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              Aucun fournisseur configuré. Ajoutez-en un ci-dessus pour commencer.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};