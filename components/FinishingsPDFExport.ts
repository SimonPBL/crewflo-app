// FinishingsPDFExport.ts
// Génère un PDF propre des finitions d'un chantier avec jsPDF (sans html2canvas)

import jsPDF from 'jspdf';
import { FINISHING_TEMPLATE } from './finishingTemplate';

// ── Types (miroir de ProjectFinishingsPanel) ──────────────────────────────────
type AreaValue = {
  confirmed: boolean;
  selectedMaterial: string;
  selectedMaterials: string[];
  materialPresets: Record<string, string[]>;
  customMatPresets: Record<string, string[]>;
  presets: string[];
  customPresets: string[];
  model: string;
  color: string;
  notes: string;
};

type RoomValue = {
  confirmed: boolean;
  areas: Record<string, AreaValue>;
};

type FinishingData = Record<string, Record<string, RoomValue>>;

// ── Couleurs ──────────────────────────────────────────────────────────────────
const NAVY   = [13,  31,  60]  as [number,number,number];
const GOLD   = [201,168, 76]  as [number,number,number];
const WHITE  = [255,255,255]  as [number,number,number];
const LGREY  = [226,232,240]  as [number,number,number];
const DGREY  = [51, 65,  85]  as [number,number,number];
const MGREY  = [100,116,139]  as [number,number,number];
const BGBLUE = [239,246,255]  as [number,number,number];
const GREEN  = [5,  122, 85]  as [number,number,number];
const BGGREEN= [236,253,245]  as [number,number,number];
const BGGREY = [248,250,252]  as [number,number,number];

// ── Helpers jsPDF ─────────────────────────────────────────────────────────────
function rgb(c: [number,number,number]) { return { r: c[0], g: c[1], b: c[2] }; }

function getRoom(data: FinishingData, cat: string, room: string): RoomValue {
  return data[cat]?.[room] ?? { confirmed: false, areas: {} };
}

function getArea(data: FinishingData, cat: string, room: string, area: string): AreaValue {
  return data[cat]?.[room]?.areas?.[area] ?? {
    confirmed: false, selectedMaterial: '', selectedMaterials: [],
    materialPresets: {}, customMatPresets: {}, presets: [], customPresets: [],
    model: '', color: '', notes: '',
  };
}

// Wrap text and return array of lines
function splitText(doc: jsPDF, text: string, maxWidth: number, fontSize: number): string[] {
  doc.setFontSize(fontSize);
  return doc.splitTextToSize(text, maxWidth);
}

// Strip emoji from label for PDF (jsPDF ne supporte pas les emoji)
function cleanLabel(label: string): string {
  return label.replace(/[\u{1F300}-\u{1FFFF}]/gu, '').replace(/[\u2600-\u27BF]/g, '').trim();
}

// ── Générateur principal ──────────────────────────────────────────────────────
export function exportFinishingsPDF(
  projectName: string,
  projectAddress: string,
  data: FinishingData,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

  const PW = 215.9; // letter width mm
  const PH = 279.4; // letter height mm
  const ML = 14;    // margin left
  const MR = 14;    // margin right
  const CW = PW - ML - MR; // content width
  const FOOTER_H = 12;
  const HEADER_H = 12;
  const CONTENT_TOP = 14 + HEADER_H;
  const CONTENT_BOT = PH - FOOTER_H - 6;

  let page = 1;
  let y = CONTENT_TOP;

  // ── Fonctions utilitaires page ──────────────────────────────

  const addHeader = (isFirst = false) => {
    // Bande navy en haut
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, PW, isFirst ? 38 : HEADER_H, 'F');

    if (isFirst) {
      // Logo / titre
      doc.setTextColor(...GOLD);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('CrewFlo', ML, 12);
      doc.setTextColor(...WHITE);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Habitations PBL', ML, 18);

      // Ligne dorée
      doc.setFillColor(...GOLD);
      doc.rect(0, 21, PW, 0.8, 'F');

      // Nom du chantier
      doc.setTextColor(...WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      const nameLines = splitText(doc, cleanLabel(projectName), CW * 0.7, 15);
      doc.text(nameLines, ML, 28);

      if (projectAddress) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(180, 196, 214);
        doc.text(cleanLabel(projectAddress), ML, 35);
      }

      // Date en haut à droite
      const now = new Date();
      const dateStr = now.toLocaleDateString('fr-CA', { year:'numeric', month:'long', day:'numeric' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(180, 196, 214);
      doc.text(dateStr, PW - MR, 10, { align: 'right' });

    } else {
      // Header compact sur pages suivantes
      doc.setTextColor(...GOLD);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('CrewFlo', ML, 8);
      doc.setTextColor(...WHITE);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const shortName = cleanLabel(projectName).length > 50
        ? cleanLabel(projectName).substring(0, 50) + '...'
        : cleanLabel(projectName);
      doc.text(shortName, ML + 18, 8);
    }
  };

  const addFooter = () => {
    const fy = PH - FOOTER_H;
    doc.setFillColor(...NAVY);
    doc.rect(0, fy, PW, FOOTER_H, 'F');
    doc.setTextColor(...GOLD);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('CrewFlo — Habitations PBL', ML, fy + 7);
    doc.setTextColor(180, 196, 214);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Page ${page}`, PW - MR, fy + 7, { align: 'right' });
    doc.text('crewflo-app.vercel.app', PW / 2, fy + 7, { align: 'center' });
  };

  const checkNewPage = (neededH: number) => {
    if (y + neededH > CONTENT_BOT) {
      addFooter();
      doc.addPage();
      page++;
      addHeader(false);
      y = CONTENT_TOP + 4;
    }
  };

  // ── Page de titre ───────────────────────────────────────────

  addHeader(true);
  y = 46;

  // Stats globales
  const totalRooms = FINISHING_TEMPLATE.reduce((s, cat) => s + cat.rooms.length, 0);
  const confirmedRooms = FINISHING_TEMPLATE.reduce((s, cat) =>
    s + cat.rooms.filter(r => getRoom(data, cat.key, r.key).confirmed).length, 0);
  const pct = totalRooms > 0 ? Math.round((confirmedRooms / totalRooms) * 100) : 0;

  // Boite progression
  doc.setFillColor(...BGBLUE);
  doc.roundedRect(ML, y, CW, 16, 2, 2, 'F');
  doc.setTextColor(...DGREY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Progression : ${confirmedRooms} / ${totalRooms} sections confirmées`, ML + 4, y + 6);
  // Barre de progression
  const barW = CW - 8;
  const barH = 4;
  const barX = ML + 4;
  const barY = y + 9;
  doc.setFillColor(...LGREY);
  doc.roundedRect(barX, barY, barW, barH, 2, 2, 'F');
  if (pct > 0) {
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(barX, barY, barW * (pct / 100), barH, 2, 2, 'F');
  }
  doc.setTextColor(59, 130, 246);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`${pct}%`, ML + CW - 4, y + 6, { align: 'right' });

  y += 22;

  // ── Légende ─────────────────────────────────────────────────
  doc.setFillColor(...BGGREY);
  doc.roundedRect(ML, y, CW, 10, 2, 2, 'F');
  // OUI pill
  doc.setFillColor(...GREEN);
  doc.roundedRect(ML + 4, y + 2.5, 12, 5, 1, 1, 'F');
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('OUI', ML + 10, y + 6, { align: 'center' });
  doc.setTextColor(...DGREY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Section confirmée avec données', ML + 19, y + 6);
  // NON pill
  doc.setFillColor(...LGREY);
  doc.roundedRect(ML + 90, y + 2.5, 12, 5, 1, 1, 'F');
  doc.setTextColor(...MGREY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('NON', ML + 96, y + 6, { align: 'center' });
  doc.setTextColor(...MGREY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Non applicable / non confirmé', ML + 105, y + 6);

  y += 16;

  // ── Sommaire des catégories ──────────────────────────────────
  doc.setTextColor(...DGREY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Sommaire par categorie', ML, y);
  y += 5;

  const catCols = 2;
  const catColW = CW / catCols;
  FINISHING_TEMPLATE.forEach((cat, idx) => {
    const col = idx % catCols;
    const row = Math.floor(idx / catCols);
    const cx = ML + col * catColW;
    const cy = y + row * 8;

    const catConfirmed = cat.rooms.filter(r => getRoom(data, cat.key, r.key).confirmed).length;
    const catTotal = cat.rooms.length;
    const catPct = catTotal > 0 ? Math.round((catConfirmed / catTotal) * 100) : 0;

    doc.setFillColor(...BGGREY);
    doc.roundedRect(cx, cy, catColW - 2, 7, 1.5, 1.5, 'F');

    doc.setTextColor(...DGREY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(cleanLabel(cat.label), cx + 3, cy + 4.5);

    doc.setTextColor(...MGREY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`${catConfirmed}/${catTotal}  ${catPct}%`, cx + catColW - 5, cy + 4.5, { align: 'right' });

    // Mini barre
    const mb = catColW - 10;
    doc.setFillColor(...LGREY);
    doc.roundedRect(cx + 3, cy + 5.5, mb, 1, 0.5, 0.5, 'F');
    if (catPct > 0) {
      doc.setFillColor(59, 130, 246);
      doc.roundedRect(cx + 3, cy + 5.5, mb * (catPct / 100), 1, 0.5, 0.5, 'F');
    }
  });

  const summaryRows = Math.ceil(FINISHING_TEMPLATE.length / catCols);
  y += summaryRows * 8 + 8;

  // ── Contenu par catégorie ────────────────────────────────────

  FINISHING_TEMPLATE.forEach(cat => {
    checkNewPage(18);

    // Header catégorie
    doc.setFillColor(...NAVY);
    doc.roundedRect(ML, y, CW, 9, 2, 2, 'F');
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(cleanLabel(cat.label), ML + 4, y + 6.3);
    y += 12;

    cat.rooms.forEach(room => {
      const roomVal = getRoom(data, cat.key, room.key);
      const isConfirmed = roomVal.confirmed;

      checkNewPage(14);

      // Header pièce
      const bgColor = isConfirmed ? BGGREEN : BGGREY;
      doc.setFillColor(...bgColor);
      doc.roundedRect(ML, y, CW, 8, 1.5, 1.5, 'F');

      // Badge OUI/NON
      if (isConfirmed) {
        doc.setFillColor(...GREEN);
        doc.roundedRect(ML + 2, y + 1.5, 10, 5, 1, 1, 'F');
        doc.setTextColor(...WHITE);
      } else {
        doc.setFillColor(...LGREY);
        doc.roundedRect(ML + 2, y + 1.5, 10, 5, 1, 1, 'F');
        doc.setTextColor(...MGREY);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(isConfirmed ? 'OUI' : 'NON', ML + 7, y + 5, { align: 'center' });

      // Nom de la pièce
      doc.setTextColor(isConfirmed ? DGREY[0] : MGREY[0], isConfirmed ? DGREY[1] : MGREY[1], isConfirmed ? DGREY[2] : MGREY[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(cleanLabel(room.label), ML + 15, y + 5.3);

      y += 10;

      // Si confirmé → afficher les areas
      if (isConfirmed) {
        room.areas.forEach(area => {
          const areaVal = getArea(data, cat.key, room.key, area.key);

          // Collecter toutes les valeurs non vides de cette area
          const lines: { label: string; value: string }[] = [];

          // Presets sélectionnés
          const allPresets = [...(areaVal.presets || []), ...(areaVal.customPresets || [])];
          if (allPresets.length > 0) {
            lines.push({ label: cleanLabel(area.label), value: allPresets.join(', ') });
          }

          // Matériaux avec leurs presets
          if (area.materialChoices) {
            area.materialChoices.forEach(mc => {
              const matPresets = [
                ...(areaVal.materialPresets?.[mc.key] || []),
                ...(areaVal.customMatPresets?.[mc.key] || []),
              ];
              if (matPresets.length > 0) {
                lines.push({ label: cleanLabel(mc.label), value: matPresets.join(', ') });
              }
            });
          }

          // Champs texte
          if (areaVal.model) lines.push({ label: 'Modele', value: areaVal.model });
          if (areaVal.color) lines.push({ label: 'Couleur / Fini', value: areaVal.color });
          if (areaVal.notes) lines.push({ label: 'Notes', value: areaVal.notes });

          if (lines.length === 0) return; // Rien à afficher pour cette area

          lines.forEach(({ label, value }) => {
            const valueLines = splitText(doc, value, CW - 60, 8);
            const rowH = Math.max(7, valueLines.length * 4.5 + 3);

            checkNewPage(rowH + 1);

            // Alternance de fond
            doc.setFillColor(248, 250, 252);
            doc.rect(ML + 2, y, CW - 2, rowH, 'F');

            doc.setTextColor(...MGREY);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text(label + ' :', ML + 5, y + 4.5);

            doc.setTextColor(...DGREY);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            valueLines.forEach((line, li) => {
              doc.text(line, ML + 55, y + 4.5 + li * 4.5);
            });

            y += rowH;
          });
        });
        y += 3;
      } else {
        // Pièce non confirmée — juste un petit espace
        y += 2;
      }
    });

    y += 6;
  });

  // ── Footer dernière page ─────────────────────────────────────
  addFooter();

  // ── Numéroter toutes les pages ───────────────────────────────
  // (déjà fait dans addFooter au fil de la génération)

  // ── Sauvegarder ─────────────────────────────────────────────
  const safeName = projectName.replace(/[^a-zA-Z0-9\s\-\_]/g, '').trim().replace(/\s+/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`CrewFlo_Finitions_${safeName}_${dateStr}.pdf`);
}
