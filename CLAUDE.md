# CrewFlo — Guide Claude Code

## Projet
PWA de gestion de chantiers pour **Habitations PBL** (triplex/multiplex au Québec).  
Propriétaires : Benoit et Pierre. Développeur : Simon (débutant — Claude écrit tout le code).

- **URL production** : https://crewflo-pro.vercel.app
- **Repo GitHub** : https://github.com/SimonPBL/crewflo-app (branche `main`)
- **Supabase project ref** : `sfmdlovlpwelehoughgv`
- **Company ID** : PBL

---

## Stack technique

- **Frontend** : React + TypeScript + Tailwind CSS + Vite
- **Backend** : Supabase (Auth + PostgreSQL + Realtime + Edge Functions)
- **Déploiement** : Vercel (auto-deploy sur push)
- **PWA** : vite-plugin-pwa
- **IA** : Google Gemini (@google/genai)
- **PDF** : jsPDF

---

## Workflow autonome (Claude Cowork)

Depuis mai 2026, Simon utilise **Claude Cowork** (app desktop) qui peut écrire les fichiers et pusher vers GitHub directement. Plus de copier-coller manuel.

### Environnement de travail Claude
- Claude clone le repo dans `/tmp/crewflo-work` (sandbox Linux, full permissions git)
- Le dossier Windows monté (`C:\Users\simon\Desktop\CrewFlow Code\crewflo-pro\crewflo-pro`) ne permet pas les `rm` → git plante si on travaille directement dedans
- Toutes les opérations git (commit, push, branch) se font dans `/tmp/crewflo-work`
- Le user pull les changements sur son Windows pour les voir localement

### Cycle de développement standard

```
1. git checkout main && git pull              ← partir d'un main à jour
2. git checkout -b <type>/<nom-court>         ← nouvelle feature branch
3. [Claude code les modifications]
4. npm run build                              ← VÉRIF OBLIGATOIRE avant push
5. git add <fichiers> && git commit -m "..."
6. git push origin <branche>
7. [Simon teste sur Vercel preview ou local]
8. Simon valide → Claude merge dans main
9. git checkout main && git merge <branche> && git push
10. git branch -d <branche> && git push origin --delete <branche>   ← fermer la branche
```

### Convention nommage des branches
- `feature/<nom>` — nouvelle fonctionnalité (ex: `feature/notifications-horaire`)
- `fix/<nom>` — correction de bug (ex: `fix/conflit-horaire-passe`)
- `refactor/<nom>` — refactorisation (ex: `refactor/syncstore-cleanup`)
- `chore/<nom>` — maintenance, config, deps (ex: `chore/update-deps`)

### Convention messages de commit (conventional commits)
- `feat:` nouvelle fonctionnalité
- `fix:` correction de bug
- `refactor:` refactorisation sans changement de comportement
- `chore:` config, build, deps
- `docs:` documentation seulement
- `style:` formatting (pas de logic change)

Exemple : `feat: notifications fournisseurs sur changement horaire`

### Vérifications obligatoires AVANT chaque push

1. `npm run build` doit passer sans erreur
2. Pas de `console.log` de debug oublié
3. Imports respectent la règle critique (voir section "Chemins d'import")
4. Si modif Supabase : tester avec un compte admin ET un compte supplier

### Côté Simon (Windows) — pour récupérer les changements

Après chaque push de Claude :
```bash
cd ~/Desktop/CrewFlow\ Code/crewflo-pro/crewflo-pro
git pull
```

Si erreurs de lock files (résidus d'anciennes sessions Claude Cowork) :
```bash
find .git -name "*.lock" -delete
git fetch --prune
git pull
```

---

## Branches actives

- `main` — production stable (déploiement auto Vercel)
- Branches feature/fix/refactor/chore créées et supprimées au besoin

---

## Structure des fichiers (chemins réels)

```
crewflo-pro/               ← racine du projet
├── src/                   ← SEULEMENT App.tsx, main.tsx, index.css
│   ├── App.tsx            ← Layout principal, routing, sidebar, auth, rôles
│   ├── main.tsx
│   └── index.css
├── components/            ← TOUS les composants React (PAS dans src/)
│   ├── CalendarView.tsx        ← Calendrier principal (FICHIER PRINCIPAL)
│   ├── ProjectSchedule.tsx     ← Modale cédule de chantier
│   ├── ScheduleTemplate.ts     ← Template des tâches de la cédule
│   ├── SupplierList.tsx        ← Gestion fournisseurs (CRUD + Auth sync)
│   ├── ProjectList.tsx         ← Liste chantiers
│   ├── ProjectFinishingsPanel.tsx
│   ├── FinishingsPDFExport.ts
│   ├── finishingTemplate.ts
│   ├── ConflictAlert.tsx       ← Alerte conflits d'horaire
│   ├── MyTasksView.tsx         ← Vue tâches du fournisseur connecté
│   ├── AIAssistant.tsx
│   ├── AuthScreen.tsx
│   ├── CloudSetup.tsx
│   └── SwipeToConfirmButton.tsx
├── hooks/                 ← Hooks custom (PAS dans src/)
│   └── useSyncStore.ts    ← Synchronisation Supabase (debounce, safety timer)
├── services/              ← Services externes (PAS dans src/)
│   ├── supabase.ts        ← Client Supabase + guardedRefreshSession
│   └── geminiService.ts
├── supabase/
│   └── functions/
│       ├── update-supplier-email/   ← Edge Function sync email Auth
│       └── delete-supplier-auth/    ← Edge Function suppression Auth user
├── types.ts               ← Interfaces TypeScript — À LA RACINE (pas dans src/)
├── index.html
├── index.tsx
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## ⚠️ RÈGLE CRITIQUE — Chemins d'import

`components/`, `hooks/`, `services/` et `types.ts` sont à la **racine**, **pas dans `src/`**.  
`src/` contient **uniquement** `App.tsx`, `main.tsx` et `index.css`.

```typescript
// ✅ Correct (depuis components/)
import { Task, Supplier } from '../types';
import { SCHEDULE_TEMPLATE } from './ScheduleTemplate';

// ❌ Faux
import { Task } from './types';
import { Task } from '../../types';
import { Task } from 'src/types';
```

Les commandes git utilisent les bons chemins :
- `components/CalendarView.tsx` ✅ (pas `src/components/CalendarView.tsx`)
- `types.ts` ✅ (pas `src/types.ts`)
- `src/App.tsx` ✅ (celui-là est bien dans `src/`)

---

## Edge Functions Supabase

- `update-supplier-email` — sync email Auth lors modification fournisseur
- `delete-supplier-auth` — supprime Auth user lors suppression fournisseur

**Déploiement :**
```bash
SUPABASE_ACCESS_TOKEN=<token> npx supabase functions deploy <nom> --use-api --project-ref sfmdlovlpwelehoughgv
```

---

## Rôles utilisateurs

- **admin** — accès complet
- **supplier** — vue lecture seule de ses tâches assignées, pas la liste des fournisseurs

### Règle sécurité
- Le rôle est **validé côté serveur uniquement** — ne jamais lire depuis localStorage
- `canEdit = roleChecked && role === 'admin'` — propagé en prop à tous les composants

---

## Conventions importantes

### Couleurs Tailwind
- **JAMAIS** de classes Tailwind générées dynamiquement (ex: `bg-${color}-500`)
- Toujours utiliser `style={{ backgroundColor: '#hex' }}` pour les couleurs runtime
- Les couleurs des fournisseurs sont stockées comme strings Tailwind complètes : `'bg-teal-500 text-white border-teal-600'`

### TypeScript
- Préférer `as Type` sur l'objet entier plutôt que sur un spread partiel
- Les interfaces Task, Supplier, Project sont dans `types.ts` (racine du projet)

### PDF
- Utiliser **jsPDF vectoriel** (pas html2canvas) pour les PDFs de cédule
- Format legal 8.5×14 pouces = 215.9×355.6mm
- Les PDFs de calendrier utilisent encore html2canvas

### Excel
- Pas de freeze panes
- Pas de classes Tailwind dans les scripts Python openpyxl
- Format monétaire : `'#,##0.00\\ "$"'`

### Icône app
- La sidebar et la page login utilisent `/icon-192.png` (pas d'icône lucide Hammer)
- Vérifier après chaque copie d'`App.tsx`

---

## Interfaces TypeScript principales

```typescript
interface Supplier {
  id, name, trade, color, email?, customInitials?, supabaseUserId?
}

interface Task {
  id, projectId, supplierId, title, description?, notes?,
  start, end, createdAt?,
  taskStatus?: 'pending' | 'confirmed' | 'declined',
  confirmedBySupplier?, adminNote?, supplierNotes?
}

interface Project {
  id, name, address, status: 'planning' | 'active' | 'completed'
}

type ViewMode = 'calendar' | 'suppliers' | 'projects' | 'ai' | 'mytasks'
```

---

## Règles métier importantes

- **Conflit d'horaire** = même fournisseur + chantiers DIFFÉRENTS + dates qui se chevauchent
- Même fournisseur + même chantier = **PAS un conflit**
- Conflits passés (avant aujourd'hui) = **ne pas afficher** le rouge ni l'alerte
- Calendrier global = **1 seul badge par fournisseur par jour** (déduplication)

---

## Cédule de chantier (template v2)

Ordre exact des tâches — **ne jamais réorganiser sans instruction explicite** :

**Fondation** : Excavation, Footing, Coffrage fondation, Backfill  
**Structure** : Livraison trust/poutrelle*, Structure, Trust, Bardeaux, Livraison fenêtres*, Mat électrique  
**Mécanique brute** : Plomberie SS, Uréthane roche, Division, Coulée béton, Prise de mesure Intermat, Élévation plomberie, Élévation ventilation, Tuyauterie aspiration centrale, Électricité élévation  
**Isolation** : Uréthane mur, Porte de garage, Cellulose, Tôle système centrale  
**Gypse** : Livraison gypse*, Installation gypse, Joints, Ménage, Peinture  
**Céramique** : Livraison céramique*, Installation céramique  
**Planchers & Escaliers** : Livraison plancher*, Livraison escalier*, Installation escalier, Installation plancher  
**Armoires & Boiseries** : Livraison armoires*, Installation armoire, Livraison boiseries*, Installation boiseries  
**Finitions** : Plomberie finale, Finition électricité, Finition ventilation, Ménage rough, Peinture finale, Ménage final  
**Extérieur** : Brique, Revêtement, Balcon bois, Ligne gaz/thermopompe, Gouttière, Nivellement final  

`*` = Livraison (badge jaune dans le PDF)

---

## Types de fournisseurs (TRADES)

Électricien, Plombier, Ventilation, Charpentier, Peintre, Maçon, Couvreur, Paysagiste, Cuisiniste, Plâtrier, Cimentier, Général

---

## Commandes utiles

```bash
# Vérifier les fichiers modifiés
git status

# Commit standard
git add <fichiers> && git commit -m "message" && git push

# Déployer une Edge Function
SUPABASE_ACCESS_TOKEN=<token> npx supabase functions deploy <nom> --use-api --project-ref sfmdlovlpwelehoughgv
```
