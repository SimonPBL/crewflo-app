# CrewFlo Pro — Guide Claude Code

## Workflow de collaboration

Claude AI génère les fichiers. Simon les copie manuellement dans le bon dossier. Simon dit à Claude Code "fichier X remplacé manuellement. Commit et push." Claude Code fait uniquement `git add + git commit + git push` — rien d'autre.

> **Règle :** Ne jamais modifier le code directement. Laisser Claude AI générer les fichiers.

---

## Stack technique

- **Frontend :** React + TypeScript + Tailwind CSS
- **Backend :** Supabase (Auth + PostgreSQL + Edge Functions)
- **Déploiement :** Netlify / Vercel
- **Supabase project ref :** `sfmdlovlpwelehoughgv`

---

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `hooks/useSyncStore.ts` | Synchronisation Supabase (debounce, safety timer) |
| `services/supabase.ts` | Client Supabase + `guardedRefreshSession` centralisé |
| `src/App.tsx` | Auth, rôles (admin/supplier), routing |
| `components/SupplierList.tsx` | Gestion fournisseurs (CRUD + Auth sync) |
| `components/CalendarView.tsx` | Vue calendrier admin (mobile-first) |
| `components/MyTasksView.tsx` | Vue tâches fournisseur |
| `types.ts` | Types partagés |

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
- **supplier** — voit uniquement ses projets assignés, pas la liste des fournisseurs

---

## Commandes utiles

```bash
# Vérifier les fichiers modifiés
git status

# Commit standard
git add <fichiers> && git commit -m "message" && git push
```
