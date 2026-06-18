// Changelog visible aux utilisateurs.
// Ordre : du plus récent au plus ancien.
// Mettre à jour ce fichier + bump APP_VERSION dans src/App.tsx
// quand on déploie des changements visibles aux utilisateurs.

export type ChangeType = 'feat' | 'fix' | 'improvement';

export interface ChangelogChange {
  type: ChangeType;
  description: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;          // YYYY-MM-DD
  title?: string;        // optionnel : titre court de la release
  changes: ChangelogChange[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.2.3',
    date: '2026-06-17',
    title: 'Fix header mobile',
    changes: [
      { type: 'fix', description: "Le header mobile (CrewFlo + hamburger + cloche de notifs) ne disparaît plus en ouvrant le calendrier" },
    ],
  },
  {
    version: '2.2.2',
    date: '2026-06-17',
    title: 'Cacher un chantier du calendrier global',
    changes: [
      { type: 'feat', description: "Nouvelle option 'Cacher du calendrier global' dans l'édition de chantier — pour les chantiers de gestion (machinerie, etc.) qu'on veut suivre mais qui n'ont pas leur place dans la vue d'ensemble" },
    ],
  },
  {
    version: '2.2.1',
    date: '2026-06-17',
    title: 'Fix calendrier mobile',
    changes: [
      { type: 'fix', description: "Sur mobile, le calendrier démarre maintenant au mois d'aujourd'hui au lieu du début du chantier" },
      { type: 'fix', description: "Le bouton 'Aujourd'hui' fait maintenant scroller la vue vers le mois courant (avant il ne faisait rien sur mobile)" },
      { type: 'improvement', description: "On peut scroller librement vers le haut/bas pour voir les mois précédents et futurs" },
    ],
  },
  {
    version: '2.2.0',
    date: '2026-05-29',
    title: 'Notifications + Multi-admin',
    changes: [
      { type: 'feat', description: "Comptes admin séparés pour Simon, Benoit et Pierre (plus de partage du compte info@habitationspbl.com)" },
      { type: 'feat', description: "Nouvel écran 'Gestion des admins' (accessible dans la sidebar) pour ajouter ou retirer des administrateurs" },
      { type: 'feat', description: "Cloche de notifications en haut de l'écran avec badge rouge pour les non lues" },
      { type: 'feat', description: "Notifs in-app en temps réel quand quelqu'un déplace, ajoute, supprime ou modifie une tâche" },
      { type: 'feat', description: "Page Notifications complète, groupée par jour, avec historique de 30 jours" },
      { type: 'feat', description: "Notifications push quotidiennes à 12h sur ton téléphone/desktop (résumé des changements de tes chantiers)" },
      { type: 'feat', description: "Popup au démarrage de l'appli qui montre les derniers changements (top 5)" },
      { type: 'feat', description: "Bannière 'Activer les notifications push' qui apparaît automatiquement pour les utilisateurs existants" },
      { type: 'fix', description: "Le bouton 'Se déconnecter' fonctionne maintenant correctement (avant il refaisait juste recharger la page sans déconnecter)" },
      { type: 'improvement', description: "Sidebar mobile mieux alignée (boutons Cloud/Backup/Restaurer ne débordent plus)" },
      { type: 'improvement', description: "Page Notifications est maintenant scrollable jusqu'en bas sur mobile" },
    ],
  },
];

// Trouve les entrées de changelog publiées DEPUIS lastSeenVersion (exclu) jusqu'à currentVersion (inclus).
// Si lastSeenVersion n'est pas trouvée, retourne juste l'entrée correspondant à currentVersion.
export function entriesSince(lastSeenVersion: string | null, currentVersion: string): ChangelogEntry[] {
  const currentIdx = CHANGELOG.findIndex(e => e.version === currentVersion);
  if (currentIdx === -1) return []; // version courante pas dans le changelog

  if (!lastSeenVersion) {
    return [CHANGELOG[currentIdx]];
  }

  const lastSeenIdx = CHANGELOG.findIndex(e => e.version === lastSeenVersion);
  if (lastSeenIdx === -1) {
    // lastSeen pas trouvée — l'user était sur une version trop vieille, on lui montre la dernière
    return [CHANGELOG[currentIdx]];
  }

  if (lastSeenIdx <= currentIdx) {
    // déjà à jour ou plus récent (cas anormal)
    return [];
  }

  // Retourner les entrées entre lastSeen (exclu) et current (inclus)
  // CHANGELOG est ordonné du plus récent (idx 0) au plus ancien
  return CHANGELOG.slice(currentIdx, lastSeenIdx);
}
