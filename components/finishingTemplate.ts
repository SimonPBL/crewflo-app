// ============================================================
// FINISHING TEMPLATE — Structure fixe du chantier type PBL
// Les valeurs par chantier sont sauvegardées dans Supabase.
// Pour ajouter une option spéciale à UN chantier : bouton "+" dans l'app.
// ============================================================

export interface MaterialChoice {
  key: string;
  label: string;
  presets: string[];
}

export interface AreaDef {
  key: string;
  label: string;
  presets?: string[];
  materialChoices?: MaterialChoice[];
  noYesNo?: boolean;
}

export interface RoomDef {
  key: string;
  label: string;
  areas: AreaDef[];
}

export interface CategoryDef {
  key: string;
  label: string;
  emoji: string;
  rooms: RoomDef[];
}

// ── Helpers réutilisables ────────────────────────────────────

const ceramiquePresets = ['12x12', '12x24', '24x24', '24x48', 'Subway 3x6', 'Subway 4x12', 'Grandes dalles', 'Mosaïque'];
const backsplashPresets = ['2x6 Métro', '3x6 Métro', '3x9', '4x12', 'Mosaïque 1x1', 'Mosaïque 2x2', 'Carré 4x4'];
const robineteriePresets = ['Chrome', 'Nickel brossé', 'Bronze huilé', 'Noir mat', 'Or brossé', 'Blanc mat'];
const essencesBois = ['Chêne', 'Érable', 'Merisier', 'Chêne rouge', 'Chêne blanc', 'Frêne', 'Pin', 'Exotique'];
const largeursBoisFranc = ['2 1/4" (57mm)', '3 1/4" (82mm)', '4 1/4" (108mm)', '5" (127mm)', '6" (152mm)', '7" (178mm)', '8" (203mm)'];
const largeursBoisIngenierie = ['3 1/4" (82mm)', '4 1/4" (108mm)', '5" (127mm)', '6 1/2" (165mm)', '7 1/2" (190mm)', '8" (203mm)', '9" (228mm)', '10" (254mm)'];
const vinyleLVPPresets = ['2mm', '3mm', '4mm', '5mm', '5.5mm', '6mm', '6.5mm', '7mm', '8mm'];
const stratifiePresets = ['7mm', '8mm', '10mm', '12mm', '14mm'];
const tapisPresets = ['Berber', 'Coupé poil court', 'Coupé poil long', 'Frisé'];
const betonPoliPresets = ['Mat', 'Satiné', 'Brillant', 'Avec granulats'];
const epoxyPresets = ['Standard uni', 'Métallique', 'Flocons', 'Quartz'];

const plancherChoices = (): MaterialChoice[] => [
  { key: 'bois_franc_essence',   label: 'Bois franc — Essence',          presets: essencesBois },
  { key: 'bois_franc_largeur',   label: 'Bois franc — Largeur',          presets: largeursBoisFranc },
  { key: 'ingenierie_essence',   label: 'Bois d\'ingénierie — Essence',  presets: essencesBois },
  { key: 'ingenierie_largeur',   label: 'Bois d\'ingénierie — Largeur',  presets: largeursBoisIngenierie },
  { key: 'stratifie',            label: 'Stratifié',                     presets: stratifiePresets },
  { key: 'vinyle_lvp',           label: 'Vinyle / LVP',                  presets: vinyleLVPPresets },
  { key: 'tapis',                label: 'Tapis',                         presets: tapisPresets },
  { key: 'ceramique',            label: 'Céramique',                     presets: ceramiquePresets },
  { key: 'beton_poli',           label: 'Béton poli',                    presets: betonPoliPresets },
  { key: 'epoxy',                label: 'Époxy',                         presets: epoxyPresets },
];

const escalierAreas = (): AreaDef[] => [
  {
    key: 'structure', label: 'Type de structure',
    materialChoices: [
      { key: 'limon_central',   label: 'Limon central — Sélectionner 3 options s.v.p.',  presets: ['5x5', '6x6', 'Marche 1.75"', 'Marche 2"', 'Bonhomme vertical', 'Bonhomme diagonal'] },
      { key: 'standard_ouvert', label: 'Escalier standard — Ouvert', presets: ['Bois massif', 'Bois + métal', 'Bois + verre'] },
      { key: 'standard_ferme',  label: 'Escalier standard — Fermé',  presets: ['Bois massif', 'MDF peint'] },
    ],
  },
  { key: 'teinte',     label: 'Teinte / Couleur',  presets: ['Naturel', 'Chêne pâle', 'Chêne foncé', 'Noyer', 'Blanc peint', 'Noir peint', 'Même que plancher'] },
  { key: 'nez_marche', label: 'Nez de marche',     presets: ['Droit', 'Bullnose', 'Carré', 'Même matériau'] },
  { key: 'rampe',      label: 'Rampe / Balustrade', presets: ['Bois classique', 'Bois + métal', 'Métal noir', 'Verre + métal', 'Inox', 'Câble tendu'] },
];

const sdbAreas = (): AreaDef[] => [
  { key: 'plancher', label: 'Plancher', presets: ceramiquePresets },
  { key: 'mur',      label: 'Mur',      presets: ceramiquePresets },
  {
    key: 'douche', label: 'Douche / Bain-douche',
    materialChoices: [
      { key: 'ceramique',  label: 'Céramique', presets: ceramiquePresets },
      { key: 'acrylique',  label: 'Acrylique', presets: ['36x36', '36x48', '36x60', '48x36', '48x60', '60x30'] },
    ],
  },
  { key: 'backsplash',   label: 'Niche / Backsplash déco',    presets: backsplashPresets },
  { key: 'porte_douche', label: 'Porte / Paroi de douche',    presets: ['Verre clair semi-frameless', 'Verre clair frameless', 'Verre dépoli', 'Rideau', 'Ouverture walk-in'] },
  { key: 'toilette',     label: 'Toilette',                    presets: ['Bidet', 'Standard 2 boutons', 'Standard clanche'] },
  { key: 'miroir',       label: 'Miroir / Armoire à pharmacie', presets: ['Miroir simple', 'Armoire pharmacie 1 porte', 'Armoire pharmacie 2 portes', 'Miroir LED intégré'] },
];

// ── Template complet ─────────────────────────────────────────

export const FINISHING_TEMPLATE: CategoryDef[] = [

  // ── CÉRAMIQUE ───────────────────────────────────────────────
  {
    key: 'ceramique',
    label: 'Céramique',
    emoji: '🟫',
    rooms: [
      { key: 'sdb_principale', label: 'SDB Principale', areas: sdbAreas() },
      { key: 'sdb_secondaire', label: 'SDB Secondaire', areas: sdbAreas() },
      { key: 'sdb_soussol',    label: 'SDB Sous-sol',   areas: sdbAreas() },
      {
        key: 'entree', label: 'Entrée',
        areas: [{ key: 'plancher', label: 'Plancher', presets: ceramiquePresets }],
      },
      {
        key: 'cuisine', label: 'Cuisine',
        areas: [
          { key: 'plancher',   label: 'Plancher',              presets: ceramiquePresets },
          { key: 'backsplash', label: 'Backsplash / Dosseret', presets: backsplashPresets },
        ],
      },
    ],
  },

  // ── PLANCHERS ────────────────────────────────────────────────
  {
    key: 'planchers',
    label: 'Planchers',
    emoji: '🪵',
    rooms: [
      {
        key: 'rdc', label: 'RDC',
        areas: [{ key: 'type', label: 'Type de plancher', materialChoices: plancherChoices() }],
      },
      {
        key: 'deuxieme', label: '2ième étage',
        areas: [{ key: 'type', label: 'Type de plancher', materialChoices: plancherChoices() }],
      },
      {
        key: 'soussol', label: 'Sous-sol',
        areas: [{ key: 'type', label: 'Type de plancher', materialChoices: plancherChoices() }],
      },
      { key: 'escalier_entree', label: 'Escalier entrée',      areas: escalierAreas() },
      { key: 'escalier_2e',     label: 'Escalier 2ième étage', areas: escalierAreas() },
      { key: 'escalier_ss',     label: 'Escalier sous-sol',    areas: escalierAreas() },
    ],
  },

  // ── CUISINE ──────────────────────────────────────────────────
  {
    key: 'cuisine',
    label: 'Cuisine',
    emoji: '🍳',
    rooms: [
      {
        key: 'armoires', label: 'Armoires',
        areas: [
          { key: 'style',    label: 'Style',    presets: ['Shaker', 'Flat', 'Mélamine', 'Thermoplastique', 'Polyester'] },
          { key: 'couleur',  label: 'Couleur',  presets: ['Blanc', 'Blanc cassé', 'Gris pâle', 'Gris foncé', 'Noir', 'Bleu marine', 'Vert', 'Bois naturel'] },
          { key: 'poignees', label: 'Poignées', presets: ['Chrome', 'Nickel brossé', 'Noir mat', 'Or brossé', 'Bronze huilé', 'Aucune (push)'] },
        ],
      },
      {
        key: 'comptoir', label: 'Comptoir',
        areas: [
          {
            key: 'type', label: 'Matériau',
            materialChoices: [
              { key: 'quartz',    label: 'Quartz',            presets: ['Blanc pur', 'Blanc veiné', 'Gris', 'Noir', 'Marbre look', 'Calcatta'] },
              { key: 'granit',    label: 'Granit',            presets: ['Blanc', 'Noir galaxie', 'Beige', 'Marron'] },
              { key: 'stratifie', label: 'Stratifié/Formica', presets: ['Blanc', 'Gris', 'Bois look', 'Marbre look'] },
              { key: 'beton',     label: 'Béton ciré',        presets: ['Naturel', 'Blanc', 'Gris', 'Foncé'] },
              { key: 'bois',      label: 'Bois / Butcher block', presets: ['Érable', 'Chêne', 'Noyer'] },
            ],
          },
          { key: 'epaisseur', label: 'Épaisseur',     presets: ['3/4"', '1"', '1 1/4"', '1 1/2"', '2"'] },
          { key: 'rebord',    label: 'Style de rebord', presets: ['Straight edge', 'Bullnose', 'Eased edge', 'Ogee', 'Waterfall'] },
        ],
      },
      {
        key: 'evier', label: 'Évier',
        areas: [
          { key: 'type',     label: 'Type',     presets: ['Sous-plan', 'Sur-plan', 'Farmhouse/Apron', '1 cuve', '2 cuves', 'Intégré au comptoir'] },
          { key: 'materiau', label: 'Matériau', presets: ['Acier inox', 'Composite noir', 'Composite blanc', 'Fonte émaillée', 'Céramique'] },
        ],
      },
      {
        key: 'robinetterie_cuisine', label: 'Robinetterie',
        areas: [
          { key: 'couleur', label: 'Couleur / Fini', presets: robineteriePresets },
        ],
      },
      {
        key: 'hotte', label: 'Hotte',
        areas: [
          { key: 'type', label: 'Type', presets: ['Sous-armoire', 'Murale', 'Îlot suspendu', 'Intégrée micro-ondes'] },
        ],
      },
    ],
  },

  // ── SALLES DE BAIN ───────────────────────────────────────────
  {
    key: 'sdb',
    label: 'Salles de bain',
    emoji: '🚿',
    rooms: [
      {
        key: 'sdb_principale', label: 'SDB Principale',
        areas: [
          {
            key: 'bain_douche', label: 'Bain / Douche',
            materialChoices: [
              { key: 'bain_acrylique',   label: 'Bain acrylique',    presets: ['Alcôve 5\'', 'Alcôve 6\'', 'Autoportant', 'Encastré'] },
              { key: 'douche_ceramique', label: 'Douche céramique',  presets: ['32x32', '36x36', '36x48', '36x60', '48x36', '48x48'] },
              { key: 'douche_acrylique', label: 'Douche acrylique',  presets: ['32x32', '36x36', '36x48', '36x60', '48x36', '48x48'] },
              { key: 'combo_bain',       label: 'Combo bain-douche', presets: ['Acrylique 5\'', 'Acrylique 6\'', 'Céramique'] },
            ],
          },
          { key: 'porte_douche', label: 'Porte / Paroi de douche',    presets: ['Verre clair semi-frameless', 'Verre clair frameless', 'Verre dépoli', 'Rideau', 'Ouverture walk-in'] },
          { key: 'toilette',     label: 'Toilette',                    presets: ['Bidet', 'Standard 2 boutons', 'Standard clanche'] },
          { key: 'miroir',       label: 'Miroir / Armoire à pharmacie', presets: ['Miroir simple', 'Armoire pharmacie 1 porte', 'Armoire pharmacie 2 portes', 'Miroir LED intégré'] },
        ],
      },
      {
        key: 'sdb_secondaire', label: 'SDB Secondaire',
        areas: [
          {
            key: 'bain_douche', label: 'Bain / Douche',
            materialChoices: [
              { key: 'bain_acrylique',   label: 'Bain acrylique',    presets: ['Alcôve 5\'', 'Alcôve 6\''] },
              { key: 'douche_ceramique', label: 'Douche céramique',  presets: ['32x32', '36x36', '36x48', '36x60'] },
              { key: 'douche_acrylique', label: 'Douche acrylique',  presets: ['32x32', '36x36', '36x48', '36x60'] },
              { key: 'combo_bain',       label: 'Combo bain-douche', presets: ['Acrylique 5\'', 'Céramique'] },
            ],
          },
          { key: 'porte_douche', label: 'Porte / Paroi de douche',    presets: ['Verre clair semi-frameless', 'Verre clair frameless', 'Verre dépoli', 'Rideau', 'Ouverture walk-in'] },
          { key: 'toilette',     label: 'Toilette',                    presets: ['Bidet', 'Standard 2 boutons', 'Standard clanche'] },
          { key: 'miroir',       label: 'Miroir / Armoire à pharmacie', presets: ['Miroir simple', 'Armoire pharmacie 1 porte', 'Armoire pharmacie 2 portes', 'Miroir LED intégré'] },
        ],
      },
      {
        key: 'sdb_soussol', label: 'SDB Sous-sol',
        areas: [
          {
            key: 'bain_douche', label: 'Bain / Douche',
            materialChoices: [
              { key: 'douche_ceramique', label: 'Douche céramique', presets: ['32x32', '36x36', '36x48'] },
              { key: 'douche_acrylique', label: 'Douche acrylique', presets: ['32x32', '36x36', '36x48'] },
            ],
          },
          { key: 'porte_douche', label: 'Porte / Paroi de douche',    presets: ['Verre clair semi-frameless', 'Verre clair frameless', 'Verre dépoli', 'Rideau', 'Ouverture walk-in'] },
          { key: 'toilette',     label: 'Toilette',                    presets: ['Bidet', 'Standard 2 boutons', 'Standard clanche'] },
          { key: 'miroir',       label: 'Miroir / Armoire à pharmacie', presets: ['Miroir simple', 'Armoire pharmacie 1 porte', 'Armoire pharmacie 2 portes', 'Miroir LED intégré'] },
        ],
      },
    ],
  },

  // ── PLOMBERIE ────────────────────────────────────────────────
  {
    key: 'plomberie',
    label: 'Plomberie',
    emoji: '🔩',
    rooms: [
      {
        key: 'robinetterie', label: 'Robinetterie',
        areas: [
          { key: 'soussol',  label: 'Couleur / Fini — Sous-sol',    presets: robineteriePresets },
          { key: 'rdc',      label: 'Couleur / Fini — RDC',         presets: robineteriePresets },
          { key: 'deuxieme', label: 'Couleur / Fini — 2ième étage', presets: robineteriePresets },
        ],
      },
      {
        key: 'eau', label: 'Eau',
        areas: [
          { key: 'chauffe_eau', label: 'Chauffe-eau',            presets: ['40 gal électrique', '50 gal électrique', '60 gal électrique', 'Thermopompe 50 gal', 'Thermopompe 80 gal', 'Gaz'] },
          { key: 'adoucisseur', label: 'Adoucisseur d\'eau',    presets: ['Inclus installé', 'Préparation seulement', 'Non inclus'] },
          { key: 'filtration',  label: 'Filtration eau potable', presets: ['Osmose inverse', 'Filtre sous évier', 'Non inclus'] },
        ],
      },
    ],
  },

  // ── ÉLECTRICITÉ & ÉCLAIRAGE ──────────────────────────────────
  {
    key: 'electricite',
    label: 'Électricité & Éclairage',
    emoji: '💡',
    rooms: [
      {
        key: 'finitions', label: 'Finitions électriques',
        areas: [
          { key: 'plaques', label: 'Couleur plaques / prises / interrupteurs', presets: ['Blanc', 'Ivoire', 'Noir', 'Aluminium brossé'] },
        ],
      },
      {
        key: 'luminaires', label: 'Luminaires intérieurs',
        areas: [
          { key: 'salon',    label: 'Salon / Salle à manger', presets: ['Encastré LED', 'Suspendu/Pendant', 'Chandelier', 'Rail'] },
          { key: 'cuisine',  label: 'Cuisine / Îlot',         presets: ['Encastré LED', 'Pendant îlot', 'Rail', 'Sous-armoire LED'] },
          { key: 'chambres', label: 'Chambres',               presets: ['Encastré LED', 'Plafonnier', 'Semi-encastré', 'Ventilateur-lumière'] },
          { key: 'sdb',      label: 'Salles de bain',         presets: ['Barre LED miroir', 'Encastré LED', 'Suspendu', 'Miroir LED intégré'] },
          { key: 'soussol',  label: 'Sous-sol',               presets: ['Encastré LED', 'Suspendu industriel', 'Rail'] },
        ],
      },
      {
        key: 'luminaires_ext', label: 'Luminaires extérieurs',
        areas: [
          { key: 'entree',   label: 'Entrée / Façade',  presets: ['Applique murale', 'Suspendu porche', 'Encastré plafond', 'Lanterne'] },
          { key: 'garage',   label: 'Plafond garage',   presets: ['Fluorescent', 'LED panneau', 'Encastré'] },
          { key: 'terrasse', label: 'Terrasse / Patio', presets: ['Encastré plafond', 'Applique murale', 'Spots sol'] },
        ],
      },
      {
        key: 'special', label: 'Équipements spéciaux',
        areas: [
          { key: 'ventilateurs', label: 'Ventilateurs de plafond', presets: ['Salon', 'Chambre principale', 'Chambre 2', 'Chambre 3', 'Sous-sol', 'Terrasse'] },
          { key: 've',           label: 'Borne recharge VE',       presets: ['Niveau 1 (120V)', 'Niveau 2 (240V)', '2 bornes', 'Préparation seulement', 'Non inclus'] },
          { key: 'thermostats',  label: 'Thermostats',             presets: ['Standard', 'Programmable', 'Intelligent WiFi', 'Ecobee', 'Nest'] },
        ],
      },
    ],
  },

  // ── PORTES & QUINCAILLERIE ───────────────────────────────────
  {
    key: 'portes',
    label: 'Portes & Quincaillerie',
    emoji: '🚪',
    rooms: [
      {
        key: 'interieures', label: 'Portes intérieures',
        areas: [
          { key: 'style',    label: 'Style',    presets: ['Plat/Moderne', 'Shaker 1 panneau', 'Shaker 5 panneaux', 'Traditionnel', 'Verre'] },
          { key: 'couleur',  label: 'Couleur',  presets: ['Blanc', 'Noir', 'Bois naturel', 'Même mur'] },
          { key: 'poignees', label: 'Poignées', presets: robineteriePresets },
        ],
      },
      {
        key: 'entree', label: 'Porte d\'entrée',
        areas: [
          { key: 'style',   label: 'Style',   presets: ['Pleine', 'Avec fenêtre latérale', 'Double', 'Avec imposte'] },
          { key: 'couleur', label: 'Couleur', presets: ['Blanc', 'Noir', 'Rouge', 'Gris anthracite', 'Bois'] },
          { key: 'serrure', label: 'Serrure', presets: ['Standard', 'Deadbolt', 'Smart lock', 'Biométrique'] },
        ],
      },
      {
        key: 'garage', label: 'Porte de garage',
        areas: [
          { key: 'taille',  label: 'Taille',  presets: ['Simple 8x7', 'Simple 9x7', 'Double 16x7', 'Double 18x7'] },
          { key: 'style',   label: 'Style',   presets: ['Lisse', 'Panneau surélevé', 'Carrossé', 'Vitrée haut', 'Bois look'] },
          { key: 'couleur', label: 'Couleur', presets: ['Blanc', 'Brun', 'Noir', 'Gris', 'Bois naturel'] },
        ],
      },
      {
        key: 'fenetres', label: 'Fenêtres',
        areas: [
          { key: 'type',    label: 'Type',          presets: ['Guillotine', 'Coulissant', 'Fixe', 'Soufflet', 'Baie'] },
          { key: 'couleur', label: 'Couleur cadre', presets: ['Blanc', 'Noir', 'Brun', 'Même extérieur'] },
        ],
      },
    ],
  },

  // ── MÉCANIQUE ────────────────────────────────────────────────
  {
    key: 'mecanique',
    label: 'Mécanique',
    emoji: '🔧',
    rooms: [
      {
        key: 'chauffage', label: 'Chauffage & Climatisation',
        areas: [
          { key: 'systeme',       label: 'Système principal', presets: ['Thermopompe centrale', 'Fournaise gaz + CA', 'Plinthes électriques', 'Géothermique', 'Radiants plancher'] },
          { key: 'climatisation', label: 'Climatisation',     presets: ['Incluse (thermopompe)', 'Mini-split', 'Centrale séparée', 'Non incluse', 'Préparation seulement'] },
        ],
      },
      {
        key: 'foyer', label: 'Foyer',
        areas: [
          { key: 'type',     label: 'Type',     presets: ['Gaz naturel', 'Propane', 'Électrique', 'Bois', 'Éthanol', 'Non inclus'] },
          { key: 'finition', label: 'Finition', presets: ['Pierre naturelle', 'Pierre reconstituée', 'Céramique', 'Drywall peint', 'Bois', 'Acier'] },
        ],
      },
    ],
  },

  // ── NOTES & EXTRAS ───────────────────────────────────────────
  {
    key: 'notes',
    label: 'Notes & Extras',
    emoji: '📝',
    rooms: [
      {
        key: 'general', label: 'Général',
        areas: [
          { key: 'extras',         label: 'Extras / Changements demandés par client', noYesNo: true, presets: [] },
          { key: 'fournisseurs',   label: 'Fournisseurs spéciaux à contacter',        noYesNo: true, presets: [] },
          { key: 'date_livraison', label: 'Date de livraison prévue',                 noYesNo: true, presets: [] },
          { key: 'notes',          label: 'Notes diverses chantier',                  noYesNo: true, presets: [] },
        ],
      },
    ],
  },
];
