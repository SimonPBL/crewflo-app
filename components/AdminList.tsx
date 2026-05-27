import React, { useState, useEffect, useCallback } from 'react';
import { AdminUser } from '../types';
import { Plus, Mail, User as UserIcon, Pencil, Check, X, Loader2, Eye, EyeOff, Shield, Clock, AlertTriangle } from 'lucide-react';
import { SwipeToConfirmButton } from './SwipeToConfirmButton';
import { createClient } from '@supabase/supabase-js';
import { getSupabase, getSupabaseConfig } from '../services/supabase';

interface AdminListProps {
  canEdit: boolean;
}

export const AdminList: React.FC<AdminListProps> = ({ canEdit: canEditProp }) => {
  // canEdit vient de App.tsx — déjà validé côté serveur
  const canEdit = !!canEditProp;

  // Supabase config (url/key seulement — on NE touche PAS au singleton de session admin)
  const { url: supabaseUrl, key: supabaseKey, companyId } = getSupabaseConfig();
  const supabase = getSupabase();

  // Liste des admins (récupérée via RPC get_admins)
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // User connecté (pour empêcher l'auto-suppression)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // State pour l'ajout
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminPasswordConfirm, setNewAdminPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // State pour l'édition du nom
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Charger la liste des admins
  const loadAdmins = useCallback(async () => {
    if (!supabase) {
      setLoadError('Supabase non configuré.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);

    try {
      // Récupérer l'ID du user connecté pour empêcher l'auto-suppression
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id) setCurrentUserId(userData.user.id);

      // Appeler la fonction RPC get_admins (vérifie rôle admin côté serveur)
      const { data, error } = await supabase.rpc('get_admins');
      if (error) throw error;

      const mapped: AdminUser[] = (data ?? []).map((row: any) => ({
        id: row.id,
        email: row.email,
        name: row.name ?? undefined,
        createdAt: row.created_at ?? undefined,
        lastSignInAt: row.last_sign_in_at ?? undefined,
      }));
      setAdmins(mapped);
    } catch (err: any) {
      setLoadError(err.message ?? 'Impossible de charger la liste des admins.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  // Ajouter un admin
  const addAdmin = async () => {
    if (!canEdit) return;
    setCreateError(null);
    setCreateSuccess(null);

    // Validation
    if (!newAdminName.trim()) {
      setCreateError('Le nom est requis.');
      return;
    }
    if (!newAdminEmail.trim()) {
      setCreateError('L\'email est requis.');
      return;
    }
    if (!newAdminPassword.trim() || newAdminPassword.length < 8) {
      setCreateError('Le mot de passe doit avoir au moins 8 caractères.');
      return;
    }
    if (newAdminPassword !== newAdminPasswordConfirm) {
      setCreateError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (!supabaseUrl || !supabaseKey || !companyId) {
      setCreateError('Supabase non configuré.');
      return;
    }

    setIsCreating(true);
    try {
      // Client temporaire isolé — NE touche PAS au singleton (pour ne pas perdre la session admin actuelle)
      const tempClient = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // 1. Créer le compte avec signUp (timeout 15s)
      const signUpPromise = tempClient.auth.signUp({
        email: newAdminEmail.trim(),
        password: newAdminPassword.trim(),
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Délai dépassé — réessayez.')), 15_000)
      );
      const { data: signUpData, error: signUpError } = await Promise.race([
        signUpPromise,
        timeoutPromise,
      ]) as Awaited<typeof signUpPromise>;

      if (signUpError) throw signUpError;
      const newUserId = signUpData.user?.id;
      if (!newUserId) throw new Error('Création du compte échouée — pas d\'ID retourné.');

      // 2. Insérer la ligne profiles avec role=admin via le client temporaire
      const { error: profileError } = await tempClient
        .from('profiles')
        .upsert({
          id: newUserId,
          company_id: companyId,
          role: 'admin',
          name: newAdminName.trim(),
        });
      if (profileError) {
        throw new Error('Compte créé mais erreur sur le profil : ' + profileError.message);
      }

      // Reset form
      setCreateSuccess(`Admin ${newAdminName.trim()} créé. Il peut maintenant se connecter avec ${newAdminEmail.trim()}.`);
      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminPassword('');
      setNewAdminPasswordConfirm('');
      setShowPassword(false);
      setShowAddForm(false);

      // Recharger la liste
      await loadAdmins();
    } catch (err: any) {
      setCreateError(err.message ?? 'Erreur lors de la création.');
    } finally {
      setIsCreating(false);
    }
  };

  // Démarrer édition du nom
  const startEditing = (admin: AdminUser) => {
    if (!canEdit) return;
    setEditingId(admin.id);
    setEditName(admin.name ?? '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
  };

  // Sauvegarder le nouveau nom
  const saveName = async (adminId: string) => {
    if (!canEdit || !supabase) return;
    if (!editName.trim()) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: editName.trim() })
        .eq('id', adminId);
      if (error) throw error;

      setAdmins(admins.map(a => a.id === adminId ? { ...a, name: editName.trim() } : a));
      setEditingId(null);
      setEditName('');
    } catch (err: any) {
      alert('Erreur mise à jour du nom : ' + (err.message ?? 'inconnue'));
    }
  };

  // Supprimer un admin (retire son accès via company_id = null)
  const deleteAdmin = async (adminId: string) => {
    if (!canEdit || !supabase) return;

    // Safety 1 : on ne peut pas se supprimer soi-même
    if (adminId === currentUserId) {
      alert('Tu ne peux pas supprimer ton propre compte. Demande à un autre admin de le faire.');
      return;
    }
    // Safety 2 : au moins 1 admin doit rester
    if (admins.length <= 1) {
      alert('Impossible de supprimer le dernier admin — au moins 1 doit rester.');
      return;
    }

    const admin = admins.find(a => a.id === adminId);
    const displayName = admin?.name || admin?.email || 'cet admin';

    try {
      // Retirer le company_id du profil — l'admin perd l'accès au prochain login
      // (même pattern que SupplierList pour les fournisseurs)
      const { error } = await supabase
        .from('profiles')
        .update({ company_id: null })
        .eq('id', adminId);
      if (error) throw error;

      setAdmins(admins.filter(a => a.id !== adminId));
    } catch (err: any) {
      alert(`Erreur suppression de ${displayName} : ` + (err.message ?? 'inconnue'));
    }
  };

  // Formatter une date ISO en quelque chose de lisible (fr-CA)
  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('fr-CA', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  };

  // === RENDU ===

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-7 h-7 text-blue-600" />
            Gestion des administrateurs
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {admins.length} admin{admins.length > 1 ? 's' : ''} actif{admins.length > 1 ? 's' : ''} dans CrewFlo
          </p>
        </div>
        {canEdit && !showAddForm && (
          <button
            onClick={() => { setShowAddForm(true); setCreateError(null); setCreateSuccess(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" /> Ajouter un admin
          </button>
        )}
      </div>

      {/* Message d'erreur de chargement */}
      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 flex-none mt-0.5" />
          <div>
            <div className="font-bold">Erreur de chargement</div>
            <div className="text-sm">{loadError}</div>
          </div>
        </div>
      )}

      {/* Message de succès */}
      {createSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          ✓ {createSuccess}
        </div>
      )}

      {/* Formulaire d'ajout */}
      {canEdit && showAddForm && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Nouvel administrateur</h3>
            <button
              onClick={() => { setShowAddForm(false); setCreateError(null); }}
              className="text-slate-400 hover:text-slate-600"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {createError && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded text-sm">
              {createError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nom complet</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="ex: Benoit Lachance"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="ex: lachance.benoit@hotmail.ca"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mot de passe (min 8 caractères)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Confirmer le mot de passe</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newAdminPasswordConfirm}
                onChange={(e) => setNewAdminPasswordConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <button
            onClick={addAdmin}
            disabled={isCreating}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {isCreating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Création...</>
            ) : (
              <><Plus className="w-4 h-4" /> Créer l'admin</>
            )}
          </button>
        </div>
      )}

      {/* Liste des admins */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Chargement des admins...
        </div>
      ) : admins.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center text-slate-500">
          Aucun admin trouvé.
        </div>
      ) : (
        <div className="space-y-2">
          {admins.map((admin) => {
            const isMe = admin.id === currentUserId;
            const isEditing = editingId === admin.id;

            return (
              <div
                key={admin.id}
                className={`bg-white border rounded-lg p-4 flex items-center gap-4 ${isMe ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'}`}
              >
                {/* Avatar / Icône */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center font-bold flex-none">
                  {(admin.name || admin.email || '?').slice(0, 1).toUpperCase()}
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        className="flex-1 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <button onClick={() => saveName(admin.id)} className="text-green-600 hover:text-green-700" title="Enregistrer">
                        <Check className="w-5 h-5" />
                      </button>
                      <button onClick={cancelEditing} className="text-slate-400 hover:text-slate-600" title="Annuler">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 truncate">
                        {admin.name || <span className="italic text-slate-400">Sans nom</span>}
                      </span>
                      {isMe && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          C'est toi
                        </span>
                      )}
                      {canEdit && (
                        <button onClick={() => startEditing(admin)} className="text-slate-400 hover:text-blue-600" title="Renommer">
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3.5 h-3.5 flex-none" />
                    <span className="truncate">{admin.email}</span>
                  </div>

                  <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                    <Clock className="w-3 h-3 flex-none" />
                    <span>Dernière connexion : {formatDate(admin.lastSignInAt)}</span>
                  </div>
                </div>

                {/* Suppression */}
                {canEdit && !isEditing && !isMe && admins.length > 1 && (
                  <div className="flex-none w-40">
                    <SwipeToConfirmButton
                      onConfirm={() => deleteAdmin(admin.id)}
                      label="Glisser pour retirer"
                      confirmLabel="Retiré"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Note d'info en bas */}
      <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg p-3">
        <strong>Note :</strong> Retirer un admin lui enlève l'accès à CrewFlo mais ne supprime pas son compte Supabase Auth.
        Il faudra le faire manuellement dans le dashboard Supabase si nécessaire.
      </div>
    </div>
  );
};
