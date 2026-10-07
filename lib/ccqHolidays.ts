// ── Congés CCQ ─────────────────────────────────────────────────
// METTRE À JOUR CHAQUE ANNÉE — Source : https://www.ccq.org/calendrier
// Congés annuels de la construction (industrie de la construction, Québec)
export const CCQ_HOLIDAYS: Record<string, string> = {
  // 2026
  '2026-01-01': "Jour de l'An",
  '2026-01-02': "Lendemain du Jour de l'An",
  '2026-04-03': "Vendredi Saint",
  '2026-04-06': "Lundi de Pâques",
  '2026-05-18': "Journée nationale des Patriotes",
  '2026-06-24': "Fête nationale du Québec",
  '2026-07-01': "Fête du Canada",
  '2026-07-20': "Congé CCQ — début vacances construction",
  '2026-07-21': "Congé CCQ",
  '2026-07-22': "Congé CCQ",
  '2026-07-23': "Congé CCQ",
  '2026-07-24': "Congé CCQ",
  '2026-07-27': "Congé CCQ",
  '2026-07-28': "Congé CCQ",
  '2026-07-29': "Congé CCQ",
  '2026-07-30': "Congé CCQ",
  '2026-07-31': "Congé CCQ — fin vacances construction",
  '2026-09-07': "Fête du Travail",
  '2026-10-12': "Action de grâce",
  '2026-12-24': "Veille de Noël",
  '2026-12-25': "Noël",
  '2026-12-26': "Lendemain de Noël",
  '2026-12-27': "Congé CCQ",
  '2026-12-28': "Congé CCQ",
  '2026-12-29': "Congé CCQ",
  '2026-12-30': "Congé CCQ",
  '2026-12-31': "Congé CCQ — fin congés hiver",
  // 2027
  '2027-01-01': "Jour de l'An",
  '2027-03-26': "Vendredi Saint",
  '2027-03-29': "Lundi de Pâques",
  '2027-05-24': "Journée nationale des Patriotes",
  '2027-06-24': "Fête nationale du Québec",
  '2027-07-01': "Fête du Canada",
  '2027-07-19': "Congé CCQ — début vacances construction",
  '2027-07-20': "Congé CCQ",
  '2027-07-21': "Congé CCQ",
  '2027-07-22': "Congé CCQ",
  '2027-07-23': "Congé CCQ",
  '2027-07-26': "Congé CCQ",
  '2027-07-27': "Congé CCQ",
  '2027-07-28': "Congé CCQ",
  '2027-07-29': "Congé CCQ",
  '2027-07-30': "Congé CCQ — fin vacances construction",
  '2027-09-06': "Fête du Travail",
  '2027-10-11': "Action de grâce",
  '2027-12-24': "Veille de Noël",
  '2027-12-25': "Noël",
  '2027-12-26': "Lendemain de Noël",
  '2027-12-27': "Congé CCQ",
  '2027-12-28': "Congé CCQ",
  '2027-12-29': "Congé CCQ",
  '2027-12-30': "Congé CCQ",
  '2027-12-31': "Congé CCQ — fin congés hiver",
};

export const getCCQHoliday = (date: Date): string | null => {
  const key = date.toISOString().slice(0, 10);
  return CCQ_HOLIDAYS[key] ?? null;
};
// ────────────────────────────────────────────────────────────────

// ── Jours ouvrables (décalage de tâches) ───────────────────────
// Jour ouvrable = lundi au vendredi, hors congés CCQ ci-dessus
// (fériés + vacances de la construction + congés d'hiver).

/** Clé AAAA-MM-JJ en heure locale (pas UTC). */
export const localDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const isBusinessDay = (d: Date): boolean => {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  return !CCQ_HOLIDAYS[localDateKey(d)];
};

/** Avance (n > 0) ou recule (n < 0) de n jours ouvrables. Garde l'heure. */
export const addBusinessDays = (date: Date, n: number): Date => {
  const d = new Date(date);
  const step = n >= 0 ? 1 : -1;
  let remaining = Math.abs(n);
  while (remaining > 0) {
    d.setDate(d.getDate() + step);
    if (isBusinessDay(d)) remaining--;
  }
  return d;
};

/** Nombre signé de jours ouvrables entre deux dates (jour de départ exclu, jour d'arrivée inclus). */
export const businessDaysBetween = (from: Date, to: Date): number => {
  const a = new Date(from); a.setHours(12, 0, 0, 0);
  const b = new Date(to); b.setHours(12, 0, 0, 0);
  if (localDateKey(a) === localDateKey(b)) return 0;
  const step = b > a ? 1 : -1;
  let count = 0;
  const d = new Date(a);
  while (localDateKey(d) !== localDateKey(b)) {
    d.setDate(d.getDate() + step);
    if (isBusinessDay(d)) count++;
  }
  return count * step;
};

// ── Jours travaillés (fins de semaine / congés travaillés par le fournisseur) ──

type Worked = string[] | Set<string> | undefined;
const hasWorked = (w: Worked, key: string) => !!w && (w instanceof Set ? w.has(key) : w.includes(key));

/** Jour de travail = jour ouvrable, ou jour de congé que le fournisseur travaille. */
export const isWorkDay = (d: Date, worked?: Worked): boolean =>
  isBusinessDay(d) || hasWorked(worked, localDateKey(d));

/** Libellé d'un jour non ouvrable (fin de semaine, férié, congé CCQ), sinon null. */
export const offDayLabel = (d: Date): string | null => {
  const h = CCQ_HOLIDAYS[localDateKey(d)];
  if (h) return /CCQ/.test(h) ? 'Vacances / congé CCQ' : h;
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return 'Fin de semaine';
  return null;
};

/** Jours non ouvrables compris dans la période (début et fin inclus). */
export const offDaysInRange = (startIso: string, endIso: string): Date[] => {
  const out: Date[] = [];
  const d = new Date(startIso); d.setHours(12, 0, 0, 0);
  const e = new Date(endIso); e.setHours(12, 0, 0, 0);
  while (d <= e) { if (!isBusinessDay(d)) out.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return out;
};

/** La tâche doit-elle s'afficher ce jour-là? (suppose que le jour est dans sa période) */
export const taskShowsOn = (t: { start: string; end: string; workedOffDays?: string[] }, day: Date): boolean => {
  if (t.workedOffDays === undefined) return true;          // ancienne tâche
  if (isWorkDay(day, t.workedOffDays)) return true;
  // Filet : une tâche sans aucun jour de travail reste visible
  const d = new Date(t.start); d.setHours(12, 0, 0, 0);
  const e = new Date(t.end); e.setHours(12, 0, 0, 0);
  while (d <= e) { if (isWorkDay(d, t.workedOffDays)) return false; d.setDate(d.getDate() + 1); }
  return true;
};

/** Ramène la date au prochain jour de travail. Garde l'heure. */
export const nextBusinessDay = (date: Date, worked?: Worked): Date => {
  const d = new Date(date);
  while (!isWorkDay(d, worked)) d.setDate(d.getDate() + 1);
  return d;
};

/** Nombre de jours de travail couverts par une tâche (début et fin inclus), minimum 1. */
export const businessDuration = (start: Date, end: Date, worked?: Worked): number => {
  const d = new Date(start); d.setHours(12, 0, 0, 0);
  const e = new Date(end); e.setHours(12, 0, 0, 0);
  let n = 0;
  while (d <= e) { if (isWorkDay(d, worked)) n++; d.setDate(d.getDate() + 1); }
  return Math.max(1, n);
};

/** Place une tâche à partir de `newStart` (ramené au prochain jour de travail) en gardant
 *  sa durée en jours de travail et l'heure de fin d'origine.
 *  `origWorked` = jours de congé travaillés dans l'ancienne période, `newWorked` dans la nouvelle. */
export const placeTask = (origStart: Date, origEnd: Date, newStart: Date, origWorked?: Worked, newWorked?: Worked): { start: Date; end: Date } => {
  const n = businessDuration(origStart, origEnd, origWorked);
  const start = nextBusinessDay(newStart, newWorked);
  const end = new Date(start);
  let counted = 1;
  while (counted < n) { end.setDate(end.getDate() + 1); if (isWorkDay(end, newWorked)) counted++; }
  end.setHours(origEnd.getHours(), origEnd.getMinutes(), origEnd.getSeconds(), 0);
  if (end < start) end.setTime(start.getTime());
  return { start, end };
};
