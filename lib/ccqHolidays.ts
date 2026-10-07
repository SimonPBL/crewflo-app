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

/** Si la date tombe une fin de semaine ou un congé CCQ, avance au prochain jour ouvrable. Garde l'heure. */
export const nextBusinessDay = (date: Date): Date => {
  const d = new Date(date);
  while (!isBusinessDay(d)) d.setDate(d.getDate() + 1);
  return d;
};

/** Nombre de jours ouvrables couverts par une tâche (début et fin inclus), minimum 1. */
export const businessDuration = (start: Date, end: Date): number => {
  const d = new Date(start); d.setHours(12, 0, 0, 0);
  const e = new Date(end); e.setHours(12, 0, 0, 0);
  let n = 0;
  while (d <= e) { if (isBusinessDay(d)) n++; d.setDate(d.getDate() + 1); }
  return Math.max(1, n);
};

/** Place une tâche à partir de `newStart` (ramené au prochain jour ouvrable) en gardant
 *  sa durée en jours ouvrables et l'heure de fin d'origine. */
export const placeTask = (origStart: Date, origEnd: Date, newStart: Date): { start: Date; end: Date } => {
  const n = businessDuration(origStart, origEnd);
  const start = nextBusinessDay(newStart);
  const end = addBusinessDays(start, n - 1);
  end.setHours(origEnd.getHours(), origEnd.getMinutes(), origEnd.getSeconds(), 0);
  if (end < start) end.setTime(start.getTime());
  return { start, end };
};
