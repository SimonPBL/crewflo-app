# CrewFlo — Contexte du projet

## Vue d'ensemble
Application PWA de gestion de chantier en temps réel pour **Habitations PBL**.
- **URL production** : https://crewflo-pro.vercel.app
- **Repo GitHub** : https://github.com/SimonPBL/crewflo-app (branche `main`)
- **Hébergement** : Vercel (déploiement automatique via `git push` sur `main`)
- **Base de données** : Supabase
- **Supabase URL** : https://sfmdlovlpwelehoughgv.supabase.co
- **Company ID** : PBL

---

## Stack technique
- **React 18** + **TypeScript**
- **Vite 5** + **vite-plugin-pwa** (PWA avec service worker)
- **Tailwind CSS**
- **Supabase** (@supabase/supabase-js) — auth + realtime + base de données
- **Lucide React** — icônes
- **jsPDF** — export PDF des finitions
- **@google/genai** — Assistant IA (Google Gemini)

---

## Structure des fichiers importants

```
crewflo-pro/
├── public/
│   ├── icon-192.png          ← Icône PWA (navy + contour doré + toit + CF)
│   ├── icon-512.png          ← Icône PWA grande
│   └── manifest.json         ← Config PWA
├── types.ts                  ← Types TypeScript (Project, Supplier, Task, COLORS, TRADES)
├── services/
│   └── supabase.ts           ← Client Supabase singleton
├── hooks/
│   └── useSyncStore.ts       ← Hook sync locale + Supabase realtime
├── components/
│   ├── finishingTemplate.ts             ← Template des catégories/pièces/zones de finition
│   ├── FinishingsPDFExport.ts           ← Export PDF des finitions (jsPDF)
│   ├── AuthScreen.tsx                   ← Écran de connexion
│   ├── CloudSetup.tsx                   ← Modal config Supabase + script SQL à copier
│   ├── ConflictAlert.tsx                ← Alertes conflits de calendrier
│   ├── SwipeToConfirmButton.tsx         ← Bouton swipe pour supprimer
│   ├── AIAssistant.tsx                  ← Assistant IA Gemini
│   ├── SupplierList.tsx                 ← Gestion fournisseurs + color picker visuel
│   ├── ProjectList.tsx                  ← Liste chantiers + filtre/tri + modale finitions
│   ├── ProjectFinishingsPanel.tsx       ← Panel finitions complet
│   └── CalendarView.tsx                 ← Vue calendrier + export PDF rapport
└── src/
    ├── App.tsx                          ← Composant principal
    └── main.tsx
```

---

## Sécurité et rôles

- **admin** (Simon) : accès complet, peut modifier tout
- **supplier** (fournisseurs) : lecture seule, voit le calendrier de ses tâches

### Règles importantes
- Le rôle est **validé côté serveur uniquement** — `App.tsx` initialise `role` à `''` et utilise un état `roleChecked` avant tout rendu
- **Ne jamais lire le rôle depuis localStorage** comme état initial
- `canEdit = roleChecked && role === 'admin'` — propagé en prop à tous les composants
- `SupplierList` et tous les composants utilisent le prop `canEdit` — jamais `localStorage`

---

## Tables Supabase

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
  company_id text,        -- ex: 'PBL'
  role text               -- 'admin' ou 'supplier'
)

-- Données de finitions par chantier
project_finishing_data (
  project_id text,
  company_id text,
  data jsonb,
  PRIMARY KEY (project_id, company_id)
)
```

### RLS (Row Level Security)

**crewflo_sync** — lecture :
```sql
create policy "read_company_data" on crewflo_sync for select to authenticated
using (
  starts_with(key, (select company_id from profiles where id = auth.uid()) || '_')
);
```

**crewflo_sync** — écriture admin :
```sql
create policy "admin_write_company_data" on crewflo_sync for insert, update, delete to authenticated
using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin'
    and starts_with(key, company_id || '_'))
)
with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin'
    and starts_with(key, company_id || '_'))
);
```

**project_finishing_data** — lecture filtrée par company_id :
```sql
create policy "finishing_data_read" on project_finishing_data for select to authenticated
using (company_id = (select company_id from profiles where id = auth.uid()));
```

> ⚠️ Utiliser `starts_with(key, company_id || '_')` et NON `split_part(key, '_', 1)` — robuste si company_id contient des underscores.

---

## Fonctionnalités implémentées

- ✅ Authentification Supabase (admin + supplier), rôle validé serveur
- ✅ Sync temps réel entre appareils (useSyncStore) — offline-first
- ✅ Calendrier global + par projet, tap sur case pour ajouter une tâche (admin)
- ✅ Gestion fournisseurs avec color picker visuel (28 couleurs : 17 pastels + 11 saturées)
- ✅ Gestion chantiers — filtre par statut, recherche nom/adresse, tri
- ✅ Barre de progression finitions sur chaque carte de chantier
- ✅ Panel finitions complet (OUI/NON, presets, options custom, modèle/couleur/notes, copie entre chantiers)
- ✅ Export PDF des finitions par chantier (jsPDF)
- ✅ Export PDF du rapport calendrier (html2canvas + jsPDF)
- ✅ Assistant IA (Google Gemini)
- ✅ PWA installable Android + iOS avec bannière de mise à jour
- ✅ Détection iOS + instructions d'installation (modal)
- ✅ Listeners `visibilitychange` + `focus` + `pageshow` pour mise à jour iOS Safari
- ✅ Bannière hors ligne (orange) quand `navigator.onLine === false`
- ✅ Export/Import backup JSON
- ✅ Undo/Redo

---

## useSyncStore — comportement

- **Reconnexion/focus/visibilité** : si `pendingData` existe → envoie d'abord, puis fetch. Sinon → fetch serveur
- **Timeout** 10s + retry jusqu'à 3 fois avec backoff exponentiel
- **Keepalive ping** toutes les 25s
- **Realtime channel** avec reconnexion auto sur erreur
- **Listener `online`** inclus pour détection reconnexion réseau

---

## Workflow de déploiement

```bash
# Dans Git Bash (PAS PowerShell)
git add .
git commit -m "description"
git push
# Vercel déploie automatiquement sur push vers main — pas besoin de "promote"
```

---

## Workflow de collaboration

- **claude.ai (chat)** : planification, architecture, génération de code, SQL, révisions
- **Claude Code** : éditions directes de fichiers, commits git, déploiements
- Simon révise les plans avant que du code soit écrit

---

## Notes importantes

- Utiliser **Git Bash** (pas PowerShell) pour les commandes git
- Les fournisseurs ne peuvent PAS s'auto-enregistrer — admin crée les comptes manuellement dans Supabase Auth
- `types.ts` est à la **racine** du projet (pas dans `src/`) — les imports utilisent `'../types'`
- L'icône CrewFlo dans la sidebar et la page login utilise `/icon-192.png` (pas d'icône lucide)
- Quand un fichier `App.tsx` est copié d'une autre session Claude, vérifier que l'icône Hammer n'est pas revenue
