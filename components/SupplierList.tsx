import React, { useMemo, useState } from 'react';
import { Supplier, TRADES, COLORS } from '../types';
import { Plus, User, Briefcase, Mail, Phone, Pencil, Check, X, Palette, Zap, Droplets, Hammer, Paintbrush, Building2, Home, Flower2, Fan, Utensils, ThermometerSnowflake, Loader2, Eye, EyeOff, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { SwipeToConfirmButton } from './SwipeToConfirmButton';
import { createClient } from '@supabase/supabase-js';
import { getSupabase, getSupabaseConfig } from '../services/supabase';

interface SupplierListProps {
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  canEdit: boolean;
}

export const SupplierList: React.FC<SupplierListProps> = ({ suppliers, setSuppliers, canEdit: canEditProp }) => {
  // canEdit vient de App.tsx qui valide le rôle côté serveur — pas besoin de relire localStorage
  const canEdit = !!canEditProp;

  // Supabase config (url/key seulement — on NE lit PAS le singleton pour ne pas affecter la session admin)
  const { url: supabaseUrl, key: supabaseKey, companyId } = getSupabaseConfig();
  const supabase = getSupabase();

  // State pour l'ajout
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPassword, setNewSupplierPassword] = useState('');
  const [newSupplierPasswordConfirm, setNewSupplierPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [newSupplierTrade, setNewSupplierTrade] = useState(TRADES[0]);
  const [newSupplierEmail, setNewSupplierEmail] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierInitials, setNewSupplierInitials] = useState('');
  const [newSupplierColor, setNewSupplierColor] = useState(COLORS[0]);

  // State pour l'édition
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Supplier>>({});

  // Liste : recherche, filtre par métier, ligne ouverte, formulaire d'ajout
  const [search, setSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState<string>('Tous');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const addSupplier = async () => {
    if (!canEdit) return;
    if (!newSupplierName.trim()) return;

    setCreateError(null);
    setCreateSuccess(null);

    if (newSupplierPasswordConfirm && newSupplierPassword !== newSupplierPasswordConfirm) {
      setCreateError('Les mots de passe ne correspondent pas.');
      return;
    }

    // Si un email + mot de passe sont fournis, créer un compte Supabase Auth
    let newUserId: string | undefined;
    if (newSupplierEmail.trim() && newSupplierPassword.trim()) {
      if (!supabaseUrl || !supabaseKey) {
        setCreateError('Supabase non configuré.');
        return;
      }
      setIsCreating(true);

      try {
        // Client temporaire isolé — NE touche PAS au singleton principal ni à sa session admin
        const tempClient = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        // 1. Créer le compte fournisseur avec timeout 15s
        const signUpPromise = tempClient.auth.signUp({
          email: newSupplierEmail.trim(),
          password: newSupplierPassword.trim(),
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Délai dépassé — réessayez.')), 15_000)
        );
        const { data: signUpData, error: signUpError } = await Promise.race([signUpPromise, timeoutPromise]) as Awaited<typeof signUpPromise>;

        if (signUpError) throw signUpError;

        newUserId = signUpData.user?.id;

        // 2. Insérer la ligne profiles via le client temporaire (session du nouveau compte)
        if (newUserId && companyId) {
          const { error: profileError } = await tempClient
            .from('profiles')
            .upsert({
              id: newUserId,
              company_id: companyId,
              role: 'supplier',
            });
          if (profileError) console.warn('[SupplierList] profiles upsert:', profileError.message);
        }

        setCreateSuccess(`Compte créé pour ${newSupplierEmail.trim()}. Le fournisseur peut maintenant se connecter.`);
      } catch (err: any) {
        setCreateError(err.message ?? 'Erreur lors de la création du compte.');
        return;
      } finally {
        setIsCreating(false);
      }
    }

    // Ajouter le fournisseur dans la liste locale (avec ou sans compte)
    const newSupplier: Supplier = {
      id: crypto.randomUUID(),
      name: newSupplierName,
      trade: newSupplierTrade,
      email: newSupplierEmail.trim() || undefined,
      phone: newSupplierPhone.trim() || undefined,
      customInitials: newSupplierInitials.trim() || undefined,
      color: newSupplierColor,
      supabaseUserId: newUserId,
    };
    setSuppliers([...suppliers, newSupplier]);

    // Reset form
    setNewSupplierName('');
    setNewSupplierEmail('');
    setNewSupplierPhone('');
    setNewSupplierInitials('');
    setNewSupplierPassword('');
    setNewSupplierPasswordConfirm('');
    setShowPassword(false);
    setNewSupplierColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
  };

  const deleteSupplier = async (id: string) => {
    if (!canEdit) return;
    const supplierToDelete = suppliers.find(s => s.id === id);
    setSuppliers(suppliers.filter(s => s.id !== id));

    // Retirer le company_id du profil → fournisseur verra "Profil incomplet" au prochain login
    if (supabase && supplierToDelete?.supabaseUserId) {
      try {
        await supabase
          .from('profiles')
          .update({ company_id: null })
          .eq('id', supplierToDelete.supabaseUserId);
      } catch (e) {
        console.warn('Erreur mise à jour profil:', e);
      }
    }
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
      case 'Isolation': return <ThermometerSnowflake className="w-5 h-5 text-pink-500" />;
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

  // Recherche sans accents sur nom, métier, courriel, téléphone
  const norm = (v?: string) => (v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const tradesPresent = useMemo(
    () => Array.from(new Set(suppliers.map(s => s.trade))).sort((a, b) => a.localeCompare(b, 'fr')),
    [suppliers]
  );
  const grouped = useMemo(() => {
    const q = norm(search.trim());
    const filtered = suppliers.filter(s =>
      (tradeFilter === 'Tous' || s.trade === tradeFilter) &&
      (!q || norm(`${s.name} ${s.trade} ${s.email || ''} ${s.phone || ''}`).includes(q))
    );
    const g: Record<string, Supplier[]> = {};
    filtered.forEach(s => { (g[s.trade] = g[s.trade] || []).push(s); });
    return Object.entries(g)
      .sort(([a], [b]) => a.localeCompare(b, 'fr'))
      .map(([t, list]) => [t, list.sort((a, b) => a.name.trim().localeCompare(b.name.trim(), 'fr'))] as [string, Supplier[]]);
  }, [suppliers, search, tradeFilter]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="p-4 sm:p-6 max-w-6xl mx-auto pb-20 sm:pb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <User className="w-6 h-6 text-blue-600" />
            Fournisseurs
          </h2>
          {canEdit && (
            <button onClick={() => setShowAddForm(v => !v)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 ${showAddForm ? 'bg-slate-200 text-slate-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              {showAddForm ? <><X className="w-4 h-4" /> Fermer</> : <><Plus className="w-4 h-4" /> Ajouter</>}
            </button>
          )}
        </div>

        {/* Formulaire d'ajout (caché derrière « Ajouter ») */}
        {canEdit && showAddForm && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-700">Ajouter un nouveau fournisseur</h3>
          {!canEdit && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Mode fournisseur : vous pouvez consulter la liste, mais vous ne pouvez pas ajouter, modifier ou supprimer des fournisseurs.
            </div>
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Nom */}
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
            {/* Initiales */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-1">Initiales (max 3)</label>
              <input
                type="text"
                maxLength={3}
                value={newSupplierInitials}
                onChange={e => setNewSupplierInitials(e.target.value.toUpperCase())}
                placeholder="ex: PCV"
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
              />
            </div>
            {/* Email */}
            <div className="lg:col-span-4">
              <label className="block text-sm font-medium text-slate-600 mb-1">Email (connexion fournisseur)</label>
              <input
                type="text"
                value={newSupplierEmail}
                onChange={(e) => setNewSupplierEmail(e.target.value)}
                disabled={!canEdit}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                placeholder="ex: contact@abc.com"
              />
            </div>
            {/* Téléphone */}
            <div className="lg:col-span-4">
              <label className="block text-sm font-medium text-slate-600 mb-1">Cellulaire (textos)</label>
              <input
                type="tel"
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
                disabled={!canEdit}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                placeholder="ex: 418 555-1234"
              />
            </div>
            {/* Métier */}
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

            {/* Mot de passe pour compte Supabase */}
            <div className="lg:col-span-12">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Mot de passe <span className="text-slate-400 font-normal normal-case">(optionnel — pour créer un accès)</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newSupplierPassword}
                  onChange={e => setNewSupplierPassword(e.target.value)}
                  disabled={!canEdit}
                  className="w-full p-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900 text-sm"
                  placeholder="Min. 6 caractères"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirmation mot de passe */}
            {newSupplierPassword.length > 0 && (
              <div className="lg:col-span-12">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirmer le mot de passe</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newSupplierPasswordConfirm}
                    onChange={e => setNewSupplierPasswordConfirm(e.target.value)}
                    disabled={!canEdit}
                    className={`w-full p-2 pr-10 border rounded-lg focus:ring-2 outline-none bg-white text-slate-900 text-sm ${
                      newSupplierPasswordConfirm.length > 0 && newSupplierPasswordConfirm !== newSupplierPassword
                        ? 'border-red-300 focus:ring-red-400'
                        : newSupplierPasswordConfirm.length > 0 && newSupplierPasswordConfirm === newSupplierPassword
                        ? 'border-green-300 focus:ring-green-400'
                        : 'border-slate-300 focus:ring-blue-500'
                    }`}
                    placeholder="Répéter le mot de passe"
                  />
                  {newSupplierPasswordConfirm.length > 0 && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2">
                      {newSupplierPasswordConfirm === newSupplierPassword
                        ? <Check className="w-4 h-4 text-green-500" />
                        : <X className="w-4 h-4 text-red-400" />
                      }
                    </span>
                  )}
                </div>
                {newSupplierPasswordConfirm.length > 0 && newSupplierPasswordConfirm !== newSupplierPassword && (
                  <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas.</p>
                )}
              </div>
            )}

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

            {/* Messages succès / erreur */}
            {createSuccess && (
              <div className="lg:col-span-12 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                {createSuccess}
              </div>
            )}
            {createError && (
              <div className="lg:col-span-12 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {createError}
              </div>
            )}

            <div className="lg:col-span-12 flex justify-end mt-2">
              <button
                onClick={canEdit && !isCreating ? addSupplier : undefined}
                disabled={!canEdit || isCreating}
                className={`w-full sm:w-auto px-6 py-2.5 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm ${canEdit && !isCreating ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-200 text-slate-500 cursor-not-allowed"}`}
              >
                {isCreating
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Création du compte...</>
                  : <><Plus className="w-4 h-4" /> Ajouter le fournisseur</>
                }
              </button>
            </div>
          </div>
        </div>
        )}

        {/* Recherche */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un fournisseur, un métier…"
            className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg bg-white text-sm focus:border-blue-500 outline-none" />
        </div>

        {/* Filtres par métier */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 -mx-1 px-1">
          {['Tous', ...tradesPresent].map(t => (
            <button key={t} onClick={() => setTradeFilter(t)}
              className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full border ${tradeFilter === t ? 'bg-blue-600 border-blue-600 text-white font-semibold' : 'bg-white border-slate-300 text-slate-600'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Liste compacte groupée par métier */}
        {grouped.length === 0 && (
          <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300 text-sm">
            {suppliers.length === 0 ? 'Aucun fournisseur configuré.' : 'Aucun fournisseur trouvé.'}
          </div>
        )}
        {grouped.map(([trade, list]) => (
          <div key={trade} className="mb-4">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 px-1">{trade} · {list.length}</p>
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {list.map(supplier => {
                const isEditing = editingId === supplier.id;
                const isOpen = expandedId === supplier.id || isEditing;
                return (
                  <div key={supplier.id}>
                    <button type="button"
                      onClick={() => { if (isEditing) return; setExpandedId(isOpen ? null : supplier.id); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left ${isOpen ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
                      <span className="flex-1 min-w-0 truncate text-sm font-medium text-slate-800">{supplier.name}</span>
                      {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 bg-slate-50">
                        {isEditing ? (
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
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Initiales calendrier (max 3)</label>
                          <input
                            type="text"
                            maxLength={3}
                            value={editForm.customInitials || ''}
                            onChange={e => setEditForm({...editForm, customInitials: e.target.value.toUpperCase().slice(0,3) || undefined})}
                            placeholder="ex: PCV"
                            className="w-full p-1.5 border border-slate-300 rounded text-sm focus:border-blue-500 outline-none bg-white"
                          />
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
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Cellulaire(s) pour textos (séparés par virgule)</label>
                          <input
                            type="tel"
                            value={editForm.phone || ''}
                            onChange={e => setEditForm({...editForm, phone: e.target.value})}
                            placeholder="ex: 418 555-1234"
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
                          <div className="space-y-1.5 mb-3">
                            <div className="flex items-center gap-2 text-slate-600 text-sm">
                              {getTradeIcon(supplier.trade)}
                              <span>{supplier.trade}</span>
                            </div>
                            {supplier.email && (
                              <div className="flex items-center gap-2 text-slate-600 text-sm overflow-hidden" title={supplier.email}>
                                <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <a href={`mailto:${supplier.email}`} className="hover:underline hover:text-blue-600 truncate">{supplier.email}</a>
                              </div>
                            )}
                            {supplier.phone && (
                              <div className="flex items-center gap-2 text-slate-600 text-sm overflow-hidden" title={supplier.phone}>
                                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <a href={`tel:${supplier.phone.split(',')[0].trim()}`} className="hover:underline hover:text-blue-600 truncate">{supplier.phone}</a>
                              </div>
                            )}
                            <div className={`inline-block mt-1 px-2 py-1 rounded text-xs font-semibold ${supplier.color} shadow-sm border`}>
                              {supplier.customInitials || supplier.name} · étiquette
                            </div>
                          </div>
                        )}
                        {isEditing ? (
                          <div className="flex gap-2 justify-end">
                            <button onClick={cancelEditing}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-200 rounded hover:bg-slate-300">
                              <X className="w-3 h-3" /> Annuler
                            </button>
                            <button onClick={saveEditing}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700">
                              <Check className="w-3 h-3" /> Enregistrer
                            </button>
                          </div>
                        ) : canEdit ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => startEditing(supplier)}
                              className="flex items-center gap-1.5 px-3 h-8 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 flex-shrink-0">
                              <Pencil className="w-3.5 h-3.5" /> Modifier
                            </button>
                            <div className="flex-1">
                              <SwipeToConfirmButton onConfirm={() => deleteSupplier(supplier.id)} label="Supprimer" className="h-8 text-[10px]" />
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400">Lecture seule</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};