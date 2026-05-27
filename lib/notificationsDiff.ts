// Détection des changements entre deux listes de tâches.
// Produit une liste d'événements à envoyer via createNotifications.

import { Task, Supplier, Project } from '../types';
import { NotificationEvent } from '../services/notifications';

// Formate une date ISO en "12 juin" ou "12 juin 14h30" (fr-CA)
const formatDate = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' });
  } catch { return iso; }
};

// Compare deux tâches sur les champs "important" (dates, supplierId, projectId, titre, status)
// Retourne la liste des champs changés
const changedFields = (a: Task, b: Task): string[] => {
  const fields: string[] = [];
  if (a.start !== b.start) fields.push('start');
  if (a.end !== b.end) fields.push('end');
  if (a.supplierId !== b.supplierId) fields.push('supplierId');
  if (a.projectId !== b.projectId) fields.push('projectId');
  if (a.title !== b.title) fields.push('title');
  if (a.description !== b.description) fields.push('description');
  if (a.taskStatus !== b.taskStatus) fields.push('taskStatus');
  if (a.confirmedBySupplier !== b.confirmedBySupplier) fields.push('confirmedBySupplier');
  return fields;
};

// Helpers pour récupérer le nom du projet et du supplier
const projectName = (projects: Project[], id: string): string =>
  projects.find(p => p.id === id)?.name || 'chantier inconnu';

const supplierName = (suppliers: Supplier[], id: string): string =>
  suppliers.find(s => s.id === id)?.name || 'fournisseur inconnu';

const supplierUserId = (suppliers: Supplier[], id: string): string | undefined =>
  suppliers.find(s => s.id === id)?.supabaseUserId;

/**
 * Compare deux états de tâches et retourne les événements à notifier.
 *
 * Important: cette fonction NE crée PAS les notifications elle-même —
 * elle retourne juste la liste d'events. C'est l'appelant qui décide
 * d'envoyer (ou non) via createNotifications().
 *
 * @param oldTasks  Tâches avant modification
 * @param newTasks  Tâches après modification
 * @param suppliers Suppliers actuels (pour les noms + supabaseUserId)
 * @param projects  Projects actuels (pour les noms)
 * @param actorIsSupplier  Si true (le user est un supplier qui confirme/refuse),
 *                         on ne génère QUE les events de statut, pas les autres
 */
export function diffTasksToEvents(
  oldTasks: Task[],
  newTasks: Task[],
  suppliers: Supplier[],
  projects: Project[],
  actorIsSupplier = false,
): NotificationEvent[] {
  const events: NotificationEvent[] = [];

  const oldById = new Map(oldTasks.map(t => [t.id, t]));
  const newById = new Map(newTasks.map(t => [t.id, t]));

  // 1. CRÉATION : tâches dans new mais pas dans old
  if (!actorIsSupplier) {
    for (const t of newTasks) {
      if (!oldById.has(t.id)) {
        const projName = projectName(projects, t.projectId);
        const suppName = supplierName(suppliers, t.supplierId);
        const suppUserId = supplierUserId(suppliers, t.supplierId);
        const dates = `${formatDate(t.start)}${t.start !== t.end ? ' au ' + formatDate(t.end) : ''}`;

        events.push({
          eventType: 'task_created',
          targetType: 'task',
          targetId: t.id,
          // Pour les admins
          title: `Nouvelle tâche : ${t.title}`,
          description: `${t.title} ajoutée pour ${suppName} sur ${projName} (${dates}).`,
          // Pour le supplier assigné
          supplierTitle: `Nouvelle tâche assignée`,
          supplierDescription: `${t.title} sur ${projName}, ${dates}.`,
          supplierUserId: suppUserId,
          metadata: { taskTitle: t.title, projectName: projName, dates },
        });
      }
    }
  }

  // 2. SUPPRESSION : tâches dans old mais pas dans new
  if (!actorIsSupplier) {
    for (const t of oldTasks) {
      if (!newById.has(t.id)) {
        const projName = projectName(projects, t.projectId);
        const suppName = supplierName(suppliers, t.supplierId);
        const suppUserId = supplierUserId(suppliers, t.supplierId);

        events.push({
          eventType: 'task_deleted',
          targetType: 'task',
          targetId: t.id,
          title: `Tâche supprimée : ${t.title}`,
          description: `${t.title} (${suppName} sur ${projName}) a été retirée.`,
          supplierTitle: `Une tâche t'a été retirée`,
          supplierDescription: `${t.title} sur ${projName} a été supprimée de ton horaire.`,
          supplierUserId: suppUserId,
          metadata: { taskTitle: t.title, projectName: projName },
        });
      }
    }
  }

  // 3. MODIFICATIONS : tâches présentes dans les deux, avec des champs changés
  for (const newTask of newTasks) {
    const oldTask = oldById.get(newTask.id);
    if (!oldTask) continue; // déjà géré dans CRÉATION

    const changes = changedFields(oldTask, newTask);
    if (changes.length === 0) continue; // rien à notifier

    const projName = projectName(projects, newTask.projectId);
    const suppName = supplierName(suppliers, newTask.supplierId);
    const suppUserId = supplierUserId(suppliers, newTask.supplierId);

    // 3a. CHANGEMENT DE STATUT (confirmé/refusé par supplier) — c'est l'event prioritaire
    if (changes.includes('taskStatus') || changes.includes('confirmedBySupplier')) {
      const status = newTask.taskStatus;
      if (status === 'confirmed') {
        events.push({
          eventType: 'task_confirmed',
          targetType: 'task',
          targetId: newTask.id,
          title: `Tâche confirmée par ${suppName}`,
          description: `${suppName} a confirmé sa tâche ${newTask.title} sur ${projName}.`,
          // Pas de supplierUserId — c'est lui qui a fait l'action
          metadata: { taskTitle: newTask.title, projectName: projName, supplierName: suppName },
        });
      } else if (status === 'declined') {
        events.push({
          eventType: 'task_declined',
          targetType: 'task',
          targetId: newTask.id,
          title: `Tâche refusée par ${suppName}`,
          description: `${suppName} a refusé sa tâche ${newTask.title} sur ${projName}. À reprogrammer.`,
          metadata: { taskTitle: newTask.title, projectName: projName, supplierName: suppName },
        });
      }
      // Si on est dans actorIsSupplier, c'est probablement juste un changement de statut.
      // On n'analyse pas les autres champs (le supplier ne peut pas les modifier normalement).
      if (actorIsSupplier) continue;
    }

    // Les changements suivants : seulement si actor est un admin
    if (actorIsSupplier) continue;

    // 3b. RÉASSIGNATION (supplier changé)
    if (changes.includes('supplierId')) {
      const oldSuppName = supplierName(suppliers, oldTask.supplierId);
      const oldSuppUserId = supplierUserId(suppliers, oldTask.supplierId);

      events.push({
        eventType: 'task_reassigned',
        targetType: 'task',
        targetId: newTask.id,
        title: `Tâche réassignée : ${newTask.title}`,
        description: `${newTask.title} sur ${projName} : ${oldSuppName} → ${suppName}.`,
        // Nouveau supplier : "tu as une nouvelle tâche"
        supplierTitle: `Nouvelle tâche assignée`,
        supplierDescription: `${newTask.title} sur ${projName}, ${formatDate(newTask.start)}.`,
        supplierUserId: suppUserId,
        // Ancien supplier : "ta tâche a été retirée"
        oldSupplierUserId: oldSuppUserId,
        oldSupplierTitle: `Tâche retirée de ton horaire`,
        oldSupplierDescription: `${newTask.title} sur ${projName} a été réassignée à ${suppName}.`,
        metadata: { taskTitle: newTask.title, projectName: projName, oldSupplierName: oldSuppName, newSupplierName: suppName },
      });
      continue; // on ne génère pas aussi un 'task_moved' ou 'task_updated' si le supplier change
    }

    // 3c. CHANGEMENT DE PROJET (chantier changé)
    if (changes.includes('projectId')) {
      const oldProjName = projectName(projects, oldTask.projectId);
      events.push({
        eventType: 'task_project_changed',
        targetType: 'task',
        targetId: newTask.id,
        title: `Chantier changé : ${newTask.title}`,
        description: `${newTask.title} : ${oldProjName} → ${projName} (${suppName}).`,
        supplierTitle: `Ta tâche change de chantier`,
        supplierDescription: `${newTask.title} : ${oldProjName} → ${projName}.`,
        supplierUserId: suppUserId,
        metadata: { taskTitle: newTask.title, oldProjectName: oldProjName, newProjectName: projName },
      });
      continue;
    }

    // 3d. DÉPLACEMENT (dates changées)
    if (changes.includes('start') || changes.includes('end')) {
      const oldDates = `${formatDate(oldTask.start)}${oldTask.start !== oldTask.end ? '-' + formatDate(oldTask.end) : ''}`;
      const newDates = `${formatDate(newTask.start)}${newTask.start !== newTask.end ? '-' + formatDate(newTask.end) : ''}`;

      events.push({
        eventType: 'task_moved',
        targetType: 'task',
        targetId: newTask.id,
        title: `Tâche déplacée : ${newTask.title}`,
        description: `${newTask.title} (${suppName}, ${projName}) : ${oldDates} → ${newDates}.`,
        supplierTitle: `Ta tâche a été déplacée`,
        supplierDescription: `${newTask.title} sur ${projName} : ${oldDates} → ${newDates}.`,
        supplierUserId: suppUserId,
        metadata: { taskTitle: newTask.title, projectName: projName, oldDates, newDates },
      });
      continue;
    }

    // 3e. AUTRES MODIFS (titre, description, etc.)
    if (changes.includes('title') || changes.includes('description')) {
      events.push({
        eventType: 'task_updated',
        targetType: 'task',
        targetId: newTask.id,
        title: `Tâche modifiée : ${newTask.title}`,
        description: `Détails de ${newTask.title} (${suppName}, ${projName}) mis à jour.`,
        supplierTitle: `Une de tes tâches a été modifiée`,
        supplierDescription: `Détails de ${newTask.title} sur ${projName} mis à jour.`,
        supplierUserId: suppUserId,
        metadata: { taskTitle: newTask.title, projectName: projName, changedFields: changes },
      });
    }
  }

  return events;
}
