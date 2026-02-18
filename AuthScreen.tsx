import React, { useEffect, useState } from 'react';
import { getSupabase } from '../services/supabase';
import { setCompanyId } from '../services/supabase';
import { LogIn, Loader2 } from 'lucide-react';

const STORE_KEY_ROLE = 'crewflo_role';

export const AuthScreen: React.FC = () => {
  const supabase = getSupabase();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setErrorMsg(null);
  }, [email, password]);

  const handleLogin = async () => {
    if (!supabase) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      const user = signInData.user;
      if (!user) throw new Error("Connexion impossible (user manquant).");

      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('role, company_id')
        .eq('id', user.id)
        .single();

      if (profErr) throw profErr;
      if (!profile?.company_id) throw new Error("Profil incomplet: company_id manquant.");
      if (!profile?.role) throw new Error("Profil incomplet: role manquant.");

      // Scope multi-compagnie + rôle
      setCompanyId(profile.company_id);
      localStorage.setItem(STORE_KEY_ROLE, profile.role);

      // Recharger pour réinitialiser les stores (companyId change les clés de sync)
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">CF</div>
          <div>
            <div className="text-lg font-bold text-slate-900">CrewFlo</div>
            <div className="text-xs text-slate-500">Connexion</div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Login (email)</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              placeholder="ex: admin@tonentreprise.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {errorMsg && (
            <div className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg p-2">
              {errorMsg}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !supabase}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Se connecter
          </button>

          {!supabase && (
            <div className="text-xs text-slate-500">
              Supabase n'est pas configuré. Ajoute VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans ton fichier .env.local.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
