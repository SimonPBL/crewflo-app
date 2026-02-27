# CrewFlo — Contexte du projet

## Vue d'ensemble
Application PWA de gestion de chantier en temps réel pour **Habitations PBL**.
- **URL production** : https://crewflo-app.vercel.app
- **Repo GitHub** : https://github.com/SimonPBL/crewflo-app
- **Hébergement** : Vercel (déploiement automatique via git push)
- **Base de données** : Supabase
- **Supabase URL** : https://sfmdlovlpwelehoughgv.supabase.co
- **Company ID** : PBL

---

## Stack technique
- **React 18** + **TypeScript**
- **Vite 5** + **vite-plugin-pwa** (PWA avec service worker)
- **Tailwind CSS**
- **Supabase** (@supabase/supabase-js ^2.39.0) — auth + realtime + base de données
- **Lucide React** — icônes
- **@google/genai** — Assistant IA

---

## Structure des fichiers importants

```
crewflo-pro/
├── public/
│   ├── icon-192.png          ← Icône PWA (navy + contour doré + toit + CF)
│   ├── icon-512.png          ← Icône PWA grande
│   └── manifest.json         ← Config PWA
├── src/ (ou racine selon structure)
│   ├── types.ts              ← Types TypeScript (Project, Supplier, Task, etc.)
│   ├── services/
│   │   └── supabase.ts       ← Client Supabase singleton (Navigator Lock désactivé)
│   ├── hooks/
│   │   └── useSyncStore.ts   ← Hook sync locale + Supabase realtime
│   └── components/
│       ├── App.tsx                      ← Composant principal
│       ├── CalendarView.tsx             ← Vue calendrier
│       ├── ProjectList.tsx              ← Liste chantiers + modale finitions
│       ├── ProjectFinishingsPanel.tsx   ← Panel finitions OUI/NON + sous-choix
│       ├── SupplierList.tsx             ← Liste fournisseurs
│       ├── AIAssistant.tsx              ← Assistant IA
│       ├── AuthScreen.tsx               ← Écran de connexion
│       ├── CloudSetup.tsx               ← Config cloud
│       ├── ConflictAlert.tsx            ← Alertes conflits
│       └── SwipeToConfirmButton.tsx     ← Bouton swipe pour supprimer
├── vite.config.ts            ← Config Vite + PWA
└── package.json
```

---

## Rôles utilisateurs
- **admin** (Simon) : accès complet, peut modifier tout
- **supplier** (fournisseurs) : lecture seule sur finitions, voit le calendrier de ses tâches

Les rôles sont stockés dans Supabase table `profiles` :
```sql
profiles (
  id uuid,          -- = auth.uid()
  company_id text,  -- ex: 'PBL'
  role text         -- 'admin' ou 'supplier'
)
```

---

## Tables Supabase

### Tables existantes (opérationnelles)
```sql
-- Sync temps réel des données app
crewflo_sync (
  key text PRIMARY KEY,   -- ex: 'PBL_crewflo_projects'
  data jsonb,
  updated_at timestamp
)

-- Profils utilisateurs
profiles (
  id uuid PRIMARY KEY,    -- = auth.uid()
  company_id text,
  role text
)
```

### Tables finitions (ajoutées récemment — problème à résoudre)
```sql
-- Liste dynamique des items de finition
finishing_items (
  id uuid PRIMARY KEY,
  category text,          -- ex: 'Céramique', 'Planchers'
  label text,             -- ex: 'Plancher chauffant'
  sort_order int,
  is_active boolean,
  created_at timestamptz
)

-- Sous-choix par item (ex: Salon, SDB, Cuisine)
finishing_subitems (
  id uuid PRIMARY KEY,
  item_id uuid REFERENCES finishing_items(id),
  label text,
  sort_order int,
  created_at timestamptz
)

-- Valeurs OUI/NON par chantier pour chaque item
project_finishings (
  id uuid PRIMARY KEY,
  project_id text,        -- ID du projet (string)
  item_id uuid REFERENCES finishing_items(id),
  checked boolean,        -- OUI ou NON
  notes text,
  updated_at timestamptz,
  UNIQUE(project_id, item_id)
)

-- Valeurs des sous-choix par chantier
project_subfinishings (
  id uuid PRIMARY KEY,
  project_id text,
  subitem_id uuid REFERENCES finishing_subitems(id),
  checked boolean,
  model text,             -- Modèle / No produit
  color text,             -- Couleur
  format text,            -- Format / Dimension
  notes text,
  updated_at timestamptz,
  UNIQUE(project_id, subitem_id)
)
```

### RLS (Row Level Security)
- **Lecture** : tous les utilisateurs connectés (`authenticated`)
- **Écriture** : seulement `role = 'admin'` dans `profiles`
- **Realtime** activé sur toutes les tables via `supabase_realtime` publication

---

## Fonctionnalités implémentées

### ✅ Opérationnel
- Authentification Supabase (admin + supplier)
- Sync temps réel entre appareils (useSyncStore)
- Calendrier global + par projet
- Gestion fournisseurs
- Gestion chantiers (CRUD)
- Assistant IA (Google Gemini)
- PWA installable (Android + iOS)
- Bannière "Mise à jour disponible" auto
- Export/Import backup JSON
- Undo/Redo actions
- Icône PWA custom (navy, contour doré, toit PBL, CF CrewFlo)

### 🔧 En cours / À debugger
- **Finitions par chantier** — tables créées, composants codés, problème Supabase à identifier
  - `ProjectFinishingsPanel.tsx` — panel OUI/NON + sous-choix + détails
  - `ProjectList.tsx` — modale avec onglets Infos / Finitions

---

## Config PWA (vite.config.ts)
```typescript
VitePWA({
  registerType: 'prompt',        // Affiche bannière au lieu de mise à jour silencieuse
  manifest: {
    name: 'CrewFlo — Habitations PBL',
    short_name: 'CrewFlo',
    background_color: '#0D1F3C',
    theme_color: '#0D1F3C',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ]
  }
})
```

---

## supabase.ts — Points importants
- **Singleton** — une seule instance partagée dans toute l'app
- **Navigator Lock désactivé** — fix pour éviter timeouts sur mobile
- Company ID stocké dans `localStorage` sous clé `crewflo_company_id`

---

## Workflow de déploiement
```bash
# Dans Git Bash (PAS PowerShell)
git add .
git commit -m "description"
git push
# Puis dans Vercel : Deployments → Promote to Production
```

---

## Ce que Claude Code peut faire
- Lire et modifier les fichiers du projet directement
- Utiliser ce fichier comme contexte de départ
- Travailler en équipe avec claude.ai (chat) pour les décisions

## Ce que claude.ai (chat) fait
- Générer du code complet
- Expliquer les concepts
- Créer les fichiers SQL Supabase
- Garder l'historique de conversation

---

## Notes importantes
- Utiliser **Git Bash** (pas PowerShell) pour les commandes git
- Les fournisseurs ne peuvent PAS s'auto-enregistrer — admin crée les comptes manuellement dans Supabase Auth
- `types.ts` est à la racine du projet (pas dans src/) — les imports utilisent `'../types'`
- APP_VERSION dans App.tsx doit être incrémentée à chaque déploiement pour déclencher la bannière de mise à jour
