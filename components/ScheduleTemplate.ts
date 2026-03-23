// ── Cédule de chantier — Template ──────────────────────────────
// Liste standard des étapes pour un chantier résidentiel au Québec.
// L'admin peut cocher chaque étape, la marquer N/A, assigner un
// entrepreneur et des dates. Les étapes cochées sont ensuite générées
// automatiquement dans le calendrier.

export type ScheduleItemType = 'task' | 'delivery'; // delivery = fond jaune

export interface ScheduleItem {
  key: string;
  label: string;
  type: ScheduleItemType;
}

export interface ScheduleCategory {
  key: string;
  label: string;
  emoji: string;
  items: ScheduleItem[];
}

export const SCHEDULE_TEMPLATE: ScheduleCategory[] = [
  {
    key: 'fondation',
    label: 'Fondation & Excavation',
    emoji: '⛏',
    items: [
      { key: 'permis',             label: 'Permis',                      type: 'task' },
      { key: 'excavation',         label: 'Excavation',                  type: 'task' },
      { key: 'footing',            label: 'Footing',                     type: 'task' },
      { key: 'drain_francais',     label: 'Drain français',              type: 'task' },
      { key: 'roche_drain',        label: 'Roche drain',                 type: 'task' },
      { key: 'coffrage_fondation', label: 'Coffrage fondation',          type: 'task' },
      { key: 'decoffrage',         label: 'Décoffrage fondation',        type: 'task' },
      { key: 'impermeabilisation', label: 'Imperméabilisation fondation',type: 'task' },
      { key: 'backfill',           label: 'Backfill',                    type: 'task' },
    ],
  },
  {
    key: 'structure',
    label: 'Structure',
    emoji: '🏗',
    items: [
      { key: 'livraison_trust',    label: 'Livraison trust / poutrelles', type: 'delivery' },
      { key: 'structure',          label: 'Structure',                    type: 'task' },
      { key: 'livraison_fenetres', label: 'Livraison fenêtres',           type: 'delivery' },
      { key: 'division',           label: 'Division',                     type: 'task' },
    ],
  },
  {
    key: 'mecanique_brute',
    label: 'Mécanique brute',
    emoji: '🔧',
    items: [
      { key: 'plomberie_ss',        label: 'Plomberie SS',                   type: 'task' },
      { key: 'mesure_intermat',     label: 'Prise de mesure Intermat',        type: 'task' },
      { key: 'elevation_plomberie', label: 'Élévation plomberie',            type: 'task' },
      { key: 'elevation_ventil',    label: 'Élévation ventilation',           type: 'task' },
      { key: 'aspiration',          label: 'Tuyauterie aspiration centrale',  type: 'task' },
      { key: 'electricite',         label: 'Électricité',                     type: 'task' },
    ],
  },
  {
    key: 'isolation',
    label: 'Isolation',
    emoji: '🧱',
    items: [
      { key: 'urethane',  label: 'Uréthane',  type: 'task' },
      { key: 'cellulose', label: 'Cellulose', type: 'task' },
      { key: 'tole',      label: 'Tôle système centrale', type: 'task' },
    ],
  },
  {
    key: 'gypse',
    label: 'Gypse',
    emoji: '🪣',
    items: [
      { key: 'livraison_gypse', label: 'Livraison gypse', type: 'delivery' },
      { key: 'inst_gypse',      label: 'Installation gypse', type: 'task' },
      { key: 'joints',          label: 'Joints', type: 'task' },
      { key: 'peinture',        label: 'Peinture', type: 'task' },
    ],
  },
  {
    key: 'ceramique',
    label: 'Céramique',
    emoji: '🟫',
    items: [
      { key: 'livraison_ceramique', label: 'Livraison céramique', type: 'delivery' },
      { key: 'inst_ceramique',      label: 'Installation céramique', type: 'task' },
    ],
  },
  {
    key: 'planchers_escaliers',
    label: 'Planchers & Escaliers',
    emoji: '🪵',
    items: [
      { key: 'livraison_plancher',  label: 'Livraison plancher',  type: 'delivery' },
      { key: 'livraison_escalier',  label: 'Livraison escalier',  type: 'delivery' },
      { key: 'inst_escalier',       label: 'Installation escalier', type: 'task' },
      { key: 'inst_plancher',       label: 'Installation plancher', type: 'task' },
    ],
  },
  {
    key: 'armoires_boiseries',
    label: 'Armoires & Boiseries',
    emoji: '🪚',
    items: [
      { key: 'livraison_armoires',  label: 'Livraison armoires',          type: 'delivery' },
      { key: 'inst_armoire',        label: 'Installation armoire',         type: 'task' },
      { key: 'livraison_boiseries', label: 'Livraison boiseries',         type: 'delivery' },
      { key: 'inst_boiseries',      label: 'Installation boiseries',       type: 'task' },
    ],
  },
  {
    key: 'finitions',
    label: 'Finitions',
    emoji: '✨',
    items: [
      { key: 'plomberie_finale',   label: 'Plomberie finale',     type: 'task' },
      { key: 'finition_ventil',    label: 'Finition ventilation', type: 'task' },
      { key: 'finition_elec',      label: 'Finition électricité', type: 'task' },
      { key: 'peinture_finale',    label: 'Peinture finale',      type: 'task' },
      { key: 'menage',             label: 'Ménage',               type: 'task' },
    ],
  },
];
