import React, { useState } from 'react';
import { saveSupabaseConfig, getSupabaseConfig, clearSupabaseConfig } from '../services/supabase';
import { Cloud, Wifi, WifiOff, X, Check, Globe, Users, Building, Shuffle, Lock, Database, ChevronDown, ChevronUp, Copy, Settings } from 'lucide-react';

interface CloudSetupProps {
  isOpen: boolean;
  onClose: () => void;
  isCloudConnected: boolean;
}

export const CloudSetup: React.FC<CloudSetupProps> = ({ isOpen, onClose, isCloudConnected }) => {
  const currentConfig = getSupabaseConfig();
  const usingEnv = currentConfig.usingEnv;
  const [url, setUrl] = useState(currentConfig.url || '');
  const [key, setKey] = useState(currentConfig.key || '');
  const [companyId, setCompanyId] = useState(currentConfig.companyId || '');
  const [showSql, setShowSql] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!url.startsWith('http') || key.length < 20) {
      alert("Configuration invalide. Vérifiez l'URL et la clé.");
      return;
    }
    saveSupabaseConfig(url, key, companyId);
  };

  const handleDisconnect = () => {
    if (confirm("Voulez-vous vraiment vous déconnecter du mode Collaboration ? Vous repasserez en mode local.")) {
      clearSupabaseConfig();
    }
  };

  const generateSecureId = () => {
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const prefix = companyId.split('-')[0] || 'Equipe';
    // Nettoyer le préfixe pour garder que les lettres
    const cleanPrefix = prefix.replace(/[^a-zA-Z]/g, '');
    setCompanyId(`${cleanPrefix}-${randomStr}`);
  };

  const sqlScript = `-- CrewFlo - Setup Supabase (Auth + Rôles)
-- 0) Prérequis: Activer "Email" dans Authentication > Providers (Supabase)

-- 1) Table de sync (même principe qu'avant)
create table if not exists crewflo_sync (
  key text primary key,
  data jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2) Table des profils (rôle + compagnie)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id text not null,
  role text not null check (role in ('admin','supplier')),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3) Realtime
alter publication supabase_realtime add table crewflo_sync;

-- 4) Sécurité RLS
alter table crewflo_sync enable row level security;
alter table profiles enable row level security;

-- Profiles: chaque utilisateur peut lire son profil
drop policy if exists "read_own_profile" on profiles;
create policy "read_own_profile"
on profiles for select
to authenticated
using (id = auth.uid());

-- Crewflo_sync: lecture autorisée seulement pour la bonne compagnie
drop policy if exists "read_company_data" on crewflo_sync;
create policy "read_company_data"
on crewflo_sync for select
to authenticated
using (
  split_part(key, '_', 1) = (
    select company_id from profiles where id = auth.uid()
  )
);

-- Crewflo_sync: écriture autorisée seulement aux admins de la compagnie
drop policy if exists "admin_write_company_data" on crewflo_sync;
create policy "admin_write_company_data"
on crewflo_sync for insert, update, delete
to authenticated
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'admin'
      and company_id = split_part(key, '_', 1)
  )
)
with check (
  exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'admin'
      and company_id = split_part(key, '_', 1)
  )
);

-- IMPORTANT:
-- 1) Crée tes utilisateurs dans Authentication > Users (admin et fournisseurs)
-- 2) Ajoute une ligne dans "profiles" pour chaque user avec company_id + role
`;

  const copySql = () => {
    navigator.clipboard.writeText(sqlScript);
    alert("Script SQL copié ! Collez-le dans l'éditeur SQL de Supabase.");
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 p-6 flex justify-between items-start flex-none">
           <div>
             <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Globe className="w-6 h-6 text-blue-400" />
                Mode Collaboration
             </h2>
             <p className="text-slate-400 text-sm mt-1">
               Synchronisez vos données en temps réel.
             </p>
           </div>
           <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto">
            {isCloudConnected ? (
                <div className="text-center py-2">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Wifi className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Vous êtes connecté</h3>
                    <p className="text-slate-500 mb-2">La synchronisation est active.</p>
                    {currentConfig.companyId && (
                        <div className="mb-6 inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-lg text-sm font-bold text-slate-700 border border-slate-200">
                             <Building className="w-4 h-4 text-slate-400" />
                             {currentConfig.companyId}
                        </div>
                    )}
                    <button 
                        onClick={handleDisconnect}
                        className="block w-full px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
                    >
                        Se déconnecter
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800 mb-2">
                        <p className="font-bold mb-2 flex items-center gap-2">
                            <Settings className="w-4 h-4" />
                            Où trouver les infos ?
                        </p>
                        <ol className="list-decimal pl-4 space-y-1 text-xs sm:text-sm">
                            <li>Allez sur votre dashboard <strong>Supabase</strong>.</li>
                            <li>Cliquez sur la roue dentée <strong>Settings</strong> (tout en bas à gauche).</li>
                            <li>Cliquez sur <strong>API</strong> dans le menu.</li>
                            <li>Copiez l'<strong>URL</strong> (tout en haut) et la <strong>Key</strong> (anon public).</li>
                        </ol>
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <button 
                            onClick={() => setShowSql(!showSql)}
                            className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 text-sm font-bold text-slate-700 transition-colors"
                        >
                            <span className="flex items-center gap-2"><Database className="w-4 h-4 text-slate-500" /> Script SQL requis (Pour Supabase)</span>
                            {showSql ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {showSql && (
                            <div className="p-3 bg-slate-900 text-slate-300 text-xs font-mono relative group">
                                <pre className="whitespace-pre-wrap">{sqlScript}</pre>
                                <button 
                                    onClick={copySql}
                                    className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Copier"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {!usingEnv ? (
                    <div className="grid gap-4 mt-2">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project URL</label>
                            <input 
                                type="text" 
                                value={url}
                                onChange={e => setUrl(e.target.value)}
                                placeholder="https://xyz.supabase.co"
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">API Key (Anon/Public)</label>
                            <input 
                                type="password" 
                                value={key}
                                onChange={e => setKey(e.target.value)}
                                placeholder="eyJhbGciOiJIUzI1NiIsInR5..."
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono"
                            />
                        </div>
                    </div>
                  ) : (
                    <div className="mt-2 p-3 rounded-lg border border-green-200 bg-green-50 text-sm text-green-800">
                      <div className="font-bold flex items-center gap-2"><Check className="w-4 h-4" /> Variables d'environnement détectées</div>
                      <div className="mt-1 text-green-700">
                        Sur Vercel, configure <span className="font-mono">VITE_SUPABASE_URL</span> et <span className="font-mono">VITE_SUPABASE_ANON_KEY</span>.
                        Ici, tu n'as qu'à définir le <b>Code d'équipe</b>.
                      </div>
                    </div>
                  )}
                    
                    <button 
                        onClick={handleSave}
                        className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 mt-2 flex items-center justify-center gap-2"
                    >
                        <Check className="w-4 h-4" /> Activer la synchronisation
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};