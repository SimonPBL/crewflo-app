// ============================================================
// FINISHING TEMPLATE — Structure fixe du chantier type PBL
// Ce fichier définit les sections, pièces, et choix prédéfinis.
// Les valeurs par chantier sont sauvegardées dans Supabase.
// Pour ajouter une section globale: modifier ce fichier + redéployer.
// Pour ajouter une option spéciale à UN chantier: bouton "+" dans l'app.
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
  noYesNo?: boolean;  // pour les champs notes sans oui/non
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

const ceramiquePresets = ['12x12', '12x24', '24x24', '24x48', 'Subway 3x6', 'Subway 4x12', 'Grandes dalles', 'Mosaïque', 'Autres'];
const backsplashPresets = ['2x6 Métro', '3x6 Métro', '3x9', '4x12', 'Mosaïque 1x1', 'Mosaïque 2x2', 'Carré 4x4', 'Autres'];
const robineteriePresets = ['Chrome', 'Nickel brossé', 'Bronze huilé', 'Noir mat', 'Or brossé', 'Blanc mat', 'Autres'];
const douche: AreaDef = {
  key: 'douche',
  label: 'Douche / Bain-douche',
  materialChoices: [
    { key: 'ceramique', label: 'Céramique', presets: ceramiquePresets },
    { key: 'acrylique', label: 'Acrylique', presets: ['36x36', '36x48', '36x60', '48x36', '48x60', '60x30', 'Autres'] },
  ],
};

const sdbAreas = (): AreaDef[] => [
  { key: 'plancher', label: 'Plancher', presets: ceramiquePresets },
  { key: 'mur', label: 'Mur', presets: ceramiquePresets },
  douche,
  { key: 'backsplash', label: 'Niche / Backsplash déco', presets: backsplashPresets },
];

// ── Template complet ─────────────────────────────────────────

export const FINISHING_TEMPLATE: CategoryDef[] = [

  // ── CÉRAMIQUE ───────────────────────────────────────────────
  {
    key: 'ceramique',
    label: 'Céramique',
    emoji: '🟫',
    rooms: [
      { key: 'sdb_principale',  label: 'SDB Principale',  areas: sdbAreas() },
      { key: 'sdb_secondaire',  label: 'SDB Secondaire',  areas: sdbAreas() },
      { key: 'sdb_soussol',     label: 'SDB Sous-sol',    areas: sdbAreas() },
      {
        key: 'entree', label: 'Entrée',
        areas: [
          { key: 'plancher', label: 'Plancher', presets: ceramiquePresets },
        ],
      },
      {
        key: 'cuisine', label: 'Cuisine',
        areas: [
          { key: 'plancher',    label: 'Plancher',              presets: ceramiquePresets },
          { key: 'backsplash',  label: 'Backsplash / Dosseret', presets: backsplashPresets },
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
        key: 'salon', label: 'Salon / Couloir / Aire ouverte',
        areas: [{
          key: 'type', label: 'Type de plancher',
          materialChoices: [
            { key: 'bois_franc',  label: 'Bois franc',   presets: ['3"', '4"', '5"', '6"', 'Larges lattes'] },
            { key: 'stratifie',   label: 'Stratifié',    presets: ['Standard', 'Imperméable AC3', 'Imperméable AC4', 'Imperméable AC5'] },
            { key: 'vinyle_lvp',  label: 'Vinyle / LVP', presets: ['4mm', '6mm', '8mm', '12mm'] },
            { key: 'tapis',       label: 'Tapis',        presets: ['Berber', 'Coupé poil court', 'Coupé poil long', 'Frisé'] },
          ],
        }],
      },
      {
        key: 'chambres', label: 'Chambres',
        areas: [{
          key: 'type', label: 'Type de plancher',
          materialChoices: [
            { key: 'bois_franc',  label: 'Bois franc',   presets: ['3"', '4"', '5"', '6"'] },
            { key: 'stratifie',   label: 'Stratifié',    presets: ['Standard', 'Imperméable AC3', 'AC4'] },
            { key: 'vinyle_lvp',  label: 'Vinyle / LVP', presets: ['4mm', '6mm', '8mm'] },
            { key: 'tapis',       label: 'Tapis',        presets: ['Berber', 'Coupé poil court', 'Coupé poil long', 'Frisé'] },
          ],
        }],
      },
      {
        key: 'soussol', label: 'Sous-sol',
        areas: [{
          key: 'type', label: 'Type de plancher',
          materialChoices: [
            { key: 'vinyle_lvp',  label: 'Vinyle / LVP',        presets: ['4mm', '6mm', '8mm', '12mm'] },
            { key: 'stratifie',   label: 'Stratifié',           presets: ['Standard', 'Imperméable'] },
            { key: 'tapis',       label: 'Tapis',               presets: ['Berber', 'Coupé', 'Frisé'] },
            { key: 'ceramique',   label: 'Céramique',           presets: ceramiquePresets },
            { key: 'beton',       label: 'Béton / Époxy',       presets: ['Peint', 'Époxy standard', 'Époxy métallique', 'Polished'] },
          ],
        }],
      },
      {
        key: 'escalier', label: 'Escalier',
        areas: [
          { key: 'teinte',      label: 'Teinte / Couleur',  presets: ['Naturel', 'Chêne pâle', 'Chêne foncé', 'Noyer', 'Blanc peint', 'Noir peint', 'Même que plancher', 'Autres'] },
          { key: 'nez_marche',  label: 'Nez de marche',     presets: ['Droit', 'Bullnose', 'Carré', 'Même matériau', 'Autres'] },
        ],
      },
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
          { key: 'style',        label: 'Style',                  presets: ['Shaker', 'Moderne / Flat', 'Traditionnel', 'Rustique', 'Autres'] },
          { key: 'couleur_bas',  label: 'Couleur armoires basses', presets: ['Blanc', 'Blanc cassé', 'Gris pâle', 'Gris foncé', 'Noir', 'Bleu marine', 'Vert', 'Bois naturel', 'Autres'] },
          { key: 'couleur_haut', label: 'Couleur armoires hautes', presets: ['Blanc', 'Blanc cassé', 'Même que bas', 'Verre givré', 'Verre clair', 'Autres'] },
          { key: 'poignees',     label: 'Poignées / Boutons',      presets: ['Chrome', 'Nickel brossé', 'Noir mat', 'Or brossé', 'Bronze huilé', 'Aucune (push)', 'Autres'] },
        ],
      },
      {
        key: 'comptoir', label: 'Comptoir',
        areas: [{
          key: 'type', label: 'Matériau',
          materialChoices: [
            { key: 'quartz',     label: 'Quartz',           presets: ['Blanc pur', 'Blanc veiné', 'Gris', 'Noir', 'Marbre look', 'Calcatta', 'Autres'] },
            { key: 'granit',     label: 'Granit',           presets: ['Blanc', 'Noir galaxie', 'Beige', 'Marron', 'Autres'] },
            { key: 'stratifie',  label: 'Stratifié/Formica', presets: ['Blanc', 'Gris', 'Bois look', 'Marbre look', 'Autres'] },
            { key: 'beton',      label: 'Béton ciré',       presets: ['Naturel', 'Blanc', 'Gris', 'Foncé', 'Autres'] },
            { key: 'bois',       label: 'Bois / Butcher block', presets: ['Érable', 'Chêne', 'Noyer', 'Autres'] },
          ],
        },
        { key: 'rebord', label: 'Style de rebord', presets: ['Straight edge', 'Bullnose', 'Eased edge', 'Ogee', 'Waterfall', 'Autres'] },
        ],
      },
      {
        key: 'evier', label: 'Évier',
        areas: [
          { key: 'type',      label: 'Type',      presets: ['Sous-plan', 'Sur-plan', 'Farmhouse/Apron', '1 cuve', '2 cuves', 'Intégré au comptoir', 'Autres'] },
          { key: 'materiau',  label: 'Matériau',  presets: ['Acier inox', 'Composite noir', 'Composite blanc', 'Fonte émaillée', 'Céramique', 'Autres'] },
        ],
      },
      {
        key: 'robinetterie_cuisine', label: 'Robinetterie',
        areas: [
          { key: 'couleur', label: 'Couleur / Fini',  presets: robineteriePresets },
          { key: 'style',   label: 'Style',            presets: ['1 levier', '2 leviers', 'Tactile', 'Avec douchette', 'Rétractable', 'Industriel', 'Autres'] },
        ],
      },
      {
        key: 'hotte', label: 'Hotte',
        areas: [
          { key: 'type',    label: 'Type',    presets: ['Sous-armoire', 'Murale', 'Îlot suspendu', 'Intégrée micro-ondes', 'Autres'] },
          { key: 'couleur', label: 'Couleur', presets: ['Acier inox', 'Blanc', 'Noir', 'Même armoires', 'Autres'] },
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
          { key: 'vanite',        label: 'Vanité (taille)',  presets: ['30"', '36"', '42"', '48"', '60" simple', '60" double', '72" double', 'Sur mesure', 'Autres'] },
          { key: 'couleur_vanite',label: 'Couleur vanité',   presets: ['Blanc', 'Gris', 'Noir', 'Bois naturel', 'Bleu', 'Vert', 'Autres'] },
          { key: 'robinetterie',  label: 'Robinetterie',     presets: robineteriePresets },
          {
            key: 'bain_douche', label: 'Bain / Douche',
            materialChoices: [
              { key: 'bain_acrylique',   label: 'Bain acrylique',      presets: ['Alcôve 5\'', 'Alcôve 6\'', 'Autoportant', 'Encastré', 'Autres'] },
              { key: 'douche_ceramique', label: 'Douche céramique',    presets: ['32x32', '36x36', '36x48', '36x60', '48x36', '48x48', 'Autres'] },
              { key: 'douche_acrylique', label: 'Douche acrylique',    presets: ['32x32', '36x36', '36x48', '36x60', '48x36', '48x48', 'Autres'] },
              { key: 'combo_bain',       label: 'Combo bain-douche',   presets: ['Acrylique 5\'', 'Acrylique 6\'', 'Céramique', 'Autres'] },
            ],
          },
          { key: 'porte_douche', label: 'Porte / Paroi de douche', presets: ['Verre clair semi-frameless', 'Verre clair frameless', 'Verre dépoli', 'Rideau', 'Ouverture walk-in', 'Autres'] },
          { key: 'toilette',     label: 'Toilette',                 presets: ['Standard cuvette ronde', 'Allongée', 'Hauteur confort', 'Sans joint (skirt)', 'Intelligente', 'Autres'] },
          { key: 'accessoires',  label: 'Accessoires',              presets: ['Chrome', 'Nickel brossé', 'Noir mat', 'Or brossé', 'Même que robinetterie', 'Autres'] },
          { key: 'miroir',       label: 'Miroir / Armoire à pharmacie', presets: ['Miroir simple', 'Armoire pharmacie 1 porte', 'Armoire pharmacie 2 portes', 'Miroir LED intégré', 'Autres'] },
        ],
      },
      {
        key: 'sdb_secondaire', label: 'SDB Secondaire',
        areas: [
          { key: 'vanite',       label: 'Vanité (taille)',  presets: ['24"', '30"', '36"', '42"', '48"', 'Autres'] },
          { key: 'couleur_vanite',label: 'Couleur vanité',  presets: ['Blanc', 'Gris', 'Noir', 'Bois naturel', 'Autres'] },
          { key: 'robinetterie', label: 'Robinetterie',     presets: robineteriePresets },
          {
            key: 'bain_douche', label: 'Bain / Douche',
            materialChoices: [
              { key: 'bain_acrylique',   label: 'Bain acrylique',   presets: ['Alcôve 5\'', 'Alcôve 6\'', 'Autres'] },
              { key: 'douche_ceramique', label: 'Douche céramique', presets: ['32x32', '36x36', '36x48', '36x60', 'Autres'] },
              { key: 'douche_acrylique', label: 'Douche acrylique', presets: ['32x32', '36x36', '36x48', '36x60', 'Autres'] },
              { key: 'combo_bain',       label: 'Combo bain-douche', presets: ['Acrylique 5\'', 'Céramique', 'Autres'] },
            ],
          },
          { key: 'toilette', label: 'Toilette', presets: ['Standard', 'Allongée', 'Hauteur confort', 'Autres'] },
        ],
      },
      {
        key: 'sdb_soussol', label: 'SDB Sous-sol',
        areas: [
          { key: 'vanite',       label: 'Vanité (taille)',  presets: ['24"', '30"', '36"', '48"', 'Autres'] },
          { key: 'robinetterie', label: 'Robinetterie',     presets: robineteriePresets },
          {
            key: 'bain_douche', label: 'Bain / Douche',
            materialChoices: [
              { key: 'douche_ceramique', label: 'Douche céramique', presets: ['32x32', '36x36', '36x48', 'Autres'] },
              { key: 'douche_acrylique', label: 'Douche acrylique', presets: ['32x32', '36x36', '36x48', 'Autres'] },
            ],
          },
          { key: 'toilette', label: 'Toilette', presets: ['Standard', 'Allongée', 'Hauteur confort', 'Autres'] },
        ],
      },
    ],
  },

  // ── PEINTURE ─────────────────────────────────────────────────
  {
    key: 'peinture',
    label: 'Peinture & Finitions',
    emoji: '🎨',
    rooms: [
      {
        key: 'interieur', label: 'Intérieur',
        areas: [
          { key: 'salon',    label: 'Salon / Aire ouverte',  presets: ['Blanc pur', 'Blanc cassé', 'Gris très pâle', 'Gris moyen', 'Beige', 'Greige', 'Autres'] },
          { key: 'couloir',  label: 'Couloir / Entrée',      presets: ['Blanc pur', 'Blanc cassé', 'Même salon', 'Gris pâle', 'Autres'] },
          { key: 'chambres', label: 'Chambres',              presets: ['Blanc pur', 'Blanc cassé', 'Gris pâle', 'Bleu pâle', 'Vert sauge', 'Rose pâle', 'Autres'] },
          { key: 'soussol',  label: 'Sous-sol',              presets: ['Blanc pur', 'Blanc cassé', 'Gris pâle', 'Autres'] },
          { key: 'plafond',  label: 'Plafond',               presets: ['Blanc pur', 'Blanc cassé', 'Même mur', 'Autres'] },
          { key: 'portes',   label: 'Portes intérieures',    presets: ['Blanc pur', 'Blanc cassé', 'Noir', 'Même mur', 'Autres'] },
          { key: 'moulures', label: 'Moulures / Plinthes',   presets: ['Blanc pur', 'Blanc cassé', 'Même portes', 'Autres'] },
          {
            key: 'style_moulures', label: 'Style moulures',
            presets: ['Simple profil', 'Colonial', 'Moderne/carré', 'Classique', 'Pas de moulures', 'Autres'],
          },
        ],
      },
      {
        key: 'exterieur', label: 'Extérieur',
        areas: [
          { key: 'principale', label: 'Couleur principale',        presets: ['Blanc', 'Gris pâle', 'Gris foncé', 'Beige', 'Brun', 'Bleu ardoise', 'Vert forêt', 'Autres'] },
          { key: 'accent',     label: 'Couleur accent / garnitures', presets: ['Blanc', 'Noir', 'Même principale', 'Contraste foncé', 'Autres'] },
          { key: 'fenetres',   label: 'Couleur cadres fenêtres',   presets: ['Blanc', 'Noir', 'Même principale', 'Même accent', 'Autres'] },
        ],
      },
    ],
  },

  // ── ÉLECTRICITÉ ──────────────────────────────────────────────
  {
    key: 'electricite',
    label: 'Électricité & Éclairage',
    emoji: '💡',
    rooms: [
      {
        key: 'finitions', label: 'Finitions électriques',
        areas: [
          { key: 'plaques', label: 'Couleur plaques / prises / interrupteurs', presets: ['Blanc', 'Ivoire', 'Noir', 'Aluminium brossé', 'Autres'] },
        ],
      },
      {
        key: 'luminaires', label: 'Luminaires intérieurs',
        areas: [
          { key: 'salon',    label: 'Salon / Salle à manger', presets: ['Encastré LED', 'Suspendu/Pendant', 'Chandelier', 'Rail', 'Aucun (voir électricien)', 'Autres'] },
          { key: 'cuisine',  label: 'Cuisine / Îlot',          presets: ['Encastré LED', 'Pendant îlot', 'Rail', 'Sous-armoire LED', 'Autres'] },
          { key: 'chambres', label: 'Chambres',                presets: ['Encastré LED', 'Plafonnier', 'Semi-encastré', 'Ventilateur-lumière', 'Autres'] },
          { key: 'sdb',      label: 'Salles de bain',          presets: ['Barre LED miroir', 'Encastré LED', 'Suspendu', 'Miroir LED intégré', 'Autres'] },
          { key: 'soussol',  label: 'Sous-sol',                presets: ['Encastré LED', 'Suspendu industriel', 'Rail', 'Autres'] },
        ],
      },
      {
        key: 'luminaires_ext', label: 'Luminaires extérieurs',
        areas: [
          { key: 'entree',   label: 'Entrée / Façade',         presets: ['Applique murale', 'Suspendu porche', 'Encastré plafond', 'Lanterne', 'Autres'] },
          { key: 'garage',   label: 'Plafond garage',          presets: ['Fluorescent', 'LED panneau', 'Encastré', 'Autres'] },
          { key: 'terrasse', label: 'Terrasse / Patio',        presets: ['Encastré plafond', 'Applique murale', 'Spots sol', 'Autres'] },
        ],
      },
      {
        key: 'special', label: 'Équipements spéciaux',
        areas: [
          { key: 'ventilateurs', label: 'Ventilateurs de plafond',  presets: ['Salon', 'Chambre principale', 'Chambre 2', 'Chambre 3', 'Sous-sol', 'Terrasse', 'Autres'] },
          { key: 've',           label: 'Borne recharge VE',        presets: ['Niveau 1 (120V)', 'Niveau 2 (240V)', '2 bornes', 'Préparation seulement', 'Non inclus', 'Autres'] },
          { key: 'thermostats',  label: 'Thermostats',              presets: ['Standard', 'Programmable', 'Intelligent WiFi', 'Ecobee', 'Nest', 'Autres'] },
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
          { key: 'style',    label: 'Style',    presets: ['Plat/Moderne', 'Shaker 1 panneau', 'Shaker 5 panneaux', 'Traditionnel', 'Verre', 'Autres'] },
          { key: 'couleur',  label: 'Couleur',  presets: ['Blanc', 'Noir', 'Bois naturel', 'Même mur', 'Autres'] },
          { key: 'poignees', label: 'Poignées', presets: robineteriePresets },
        ],
      },
      {
        key: 'entree', label: "Porte d'entrée",
        areas: [
          { key: 'style',   label: 'Style',   presets: ['Pleine', 'Avec fenêtre latérale', 'Double', 'Avec imposte', 'Autres'] },
          { key: 'couleur', label: 'Couleur', presets: ['Blanc', 'Noir', 'Rouge', 'Gris anthracite', 'Bois', 'Autres'] },
          { key: 'serrure', label: 'Serrure', presets: ['Standard', 'Deadbolt', 'Smart lock', 'Biométrique', 'Autres'] },
        ],
      },
      {
        key: 'garage', label: 'Porte de garage',
        areas: [
          { key: 'taille',  label: 'Taille',  presets: ['Simple 8x7', 'Simple 9x7', 'Double 16x7', 'Double 18x7', 'Autres'] },
          { key: 'style',   label: 'Style',   presets: ['Lisse', 'Panneau surélevé', 'Carrossé', 'Vitrée haut', 'Bois look', 'Autres'] },
          { key: 'couleur', label: 'Couleur', presets: ['Blanc', 'Brun', 'Noir', 'Gris', 'Bois naturel', 'Autres'] },
        ],
      },
      {
        key: 'fenetres', label: 'Fenêtres',
        areas: [
          { key: 'type',    label: 'Type',           presets: ['Guillotine', 'Coulissant', 'Fixe', 'Soufflet', 'Baie', 'Autres'] },
          { key: 'couleur', label: 'Couleur cadre',  presets: ['Blanc', 'Noir', 'Brun', 'Même extérieur', 'Autres'] },
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
          { key: 'systeme',     label: 'Système principal',     presets: ['Thermopompe centrale', 'Fournaise gaz + CA', 'Plinthes électriques', 'Géothermique', 'Radiants plancher', 'Autres'] },
          { key: 'climatisation',label: 'Climatisation',        presets: ['Incluse (thermopompe)', 'Mini-split', 'Centrale séparée', 'Non incluse', 'Préparation seulement', 'Autres'] },
          { key: 'vrc',         label: 'Ventilation VRC/VRE',   presets: ['Standard', 'Haute efficacité', 'Non inclus', 'Autres'] },
        ],
      },
      {
        key: 'plomberie', label: 'Plomberie',
        areas: [
          { key: 'chauffe_eau',  label: 'Chauffe-eau',              presets: ['40 gal électrique', '50 gal électrique', '60 gal électrique', 'Thermopompe 50 gal', 'Thermopompe 80 gal', 'Gaz', 'Au gaz sur demande', 'Autres'] },
          { key: 'adoucisseur',  label: "Adoucisseur d'eau",        presets: ['Inclus installé', 'Préparation seulement', 'Non inclus', 'Autres'] },
          { key: 'filtration',   label: 'Filtration eau potable',   presets: ['Osmose inverse', 'Filtre sous évier', 'Non inclus', 'Autres'] },
        ],
      },
      {
        key: 'foyer', label: 'Foyer',
        areas: [
          { key: 'type',     label: 'Type',     presets: ['Gaz naturel', 'Propane', 'Électrique', 'Bois', 'Éthanol', 'Non inclus', 'Autres'] },
          { key: 'finition', label: 'Finition', presets: ['Pierre naturelle', 'Pierre reconstituée', 'Céramique', 'Drywall peint', 'Bois', 'Acier', 'Autres'] },
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
          { key: 'extras',          label: 'Extras / Changements demandés par client', noYesNo: true, presets: [] },
          { key: 'fournisseurs',    label: 'Fournisseurs spéciaux à contacter',        noYesNo: true, presets: [] },
          { key: 'date_livraison',  label: 'Date de livraison prévue',                 noYesNo: true, presets: [] },
          { key: 'notes',           label: 'Notes diverses chantier',                  noYesNo: true, presets: [] },
        ],
      },
    ],
  },
];
