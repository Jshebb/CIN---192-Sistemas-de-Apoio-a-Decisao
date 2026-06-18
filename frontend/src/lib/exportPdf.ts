import type { SolveResponse } from "./api";

// Captura um elemento DOM como imagem PNG em base64.
// Usa html-to-image (resolve getComputedStyle → rgb) para suportar oklch do Tailwind v4.
async function captureElement(id: string): Promise<string | null> {
  const el = document.getElementById(id);
  if (!el) return null;
  const { toPng } = await import("html-to-image");
  return toPng(el, { pixelRatio: 2, backgroundColor: "#ffffff" });
}

const PAGE_W = 210; // A4 mm
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Cores do tema (cinza-escuro para cabeçalho, azul para destaque).
const HEADER_BG: [number, number, number] = [31, 41, 55];   // #1f2937
const ACCENT: [number, number, number] = [99, 102, 241];     // indigo-500
const ROW_ALT: [number, number, number] = [243, 244, 246];   // gray-100
const BORDER: [number, number, number] = [209, 213, 219];    // gray-300
const TEXT_MUTED: [number, number, number] = [107, 114, 128];

export async function exportPdfFull(
  problemName: string,
  result: SolveResponse,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  let y = MARGIN;

  // ── Cabeçalho ───────────────────────────────────────────────────────────────
  doc.setFillColor(...HEADER_BG);
  doc.rect(0, 0, PAGE_W, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("PROMETHEE II — Resultado", MARGIN, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(problemName || "Problema sem nome", MARGIN, 18);

  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
  doc.text(dateStr, PAGE_W - MARGIN, 18, { align: "right" });

  y = 34;

  // GAIA quality badge
  if (result.gaia) {
    doc.setTextColor(...ACCENT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(
      `Qualidade do plano GAIA (δ): ${(result.gaia.quality * 100).toFixed(1)} %`,
      MARGIN,
      y,
    );
    y += 7;
  }

  // ── Tabela de ranking ────────────────────────────────────────────────────────
  doc.setTextColor(...HEADER_BG);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Ranking — PROMETHEE II", MARGIN, y);
  y += 5;

  const cols = [12, 80, 26, 26, 31]; // larguras das colunas (mm)
  const headers = ["#", "Alternativa", "φ⁺", "φ⁻", "φ líquido"];
  const ROW_H = 8;

  // Cabeçalho da tabela
  doc.setFillColor(...HEADER_BG);
  doc.rect(MARGIN, y, CONTENT_W, ROW_H, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  let xOff = MARGIN + 2;
  headers.forEach((h, i) => {
    doc.text(h, xOff, y + 5.5);
    xOff += cols[i];
  });
  y += ROW_H;

  // Linhas
  const sorted = [...result.scores].sort((a, b) => a.rank - b.rank);
  sorted.forEach((s, idx) => {
    const isEven = idx % 2 === 0;
    doc.setFillColor(...(isEven ? ([255, 255, 255] as [number,number,number]) : ROW_ALT));
    doc.rect(MARGIN, y, CONTENT_W, ROW_H, "F");

    // borda inferior
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y + ROW_H, MARGIN + CONTENT_W, y + ROW_H);

    doc.setTextColor(...HEADER_BG);
    doc.setFont("helvetica", s.rank === 1 ? "bold" : "normal");
    doc.setFontSize(9);

    const cells = [
      String(s.rank),
      s.name,
      s.phi_plus.toFixed(4),
      s.phi_minus.toFixed(4),
      (s.phi_net >= 0 ? "+" : "") + s.phi_net.toFixed(4),
    ];
    xOff = MARGIN + 2;
    cells.forEach((cell, i) => {
      if (i === 4) {
        doc.setTextColor(...(s.phi_net >= 0 ? ACCENT : ([220, 38, 38] as [number,number,number])));
      } else {
        doc.setTextColor(...HEADER_BG);
      }
      doc.text(cell, xOff, y + 5.5);
      xOff += cols[i];
    });
    y += ROW_H;
  });

  y += 8;

  // ── Gráficos ─────────────────────────────────────────────────────────────────
  const chartSections: { id: string; title: string }[] = [
    { id: "chart-ranking", title: "Fluxo líquido φ (Ranking)" },
    { id: "chart-flow-quadrant", title: "Diagnóstico dos fluxos" },
    { id: "chart-heatmap", title: "Preferência agregada" },
    { id: "chart-gaia", title: "Plano GAIA" },
  ];

  for (const { id, title } of chartSections) {
    const img = await captureElement(id);
    if (!img) continue;

    // Nova página se não couber (altura mínima estimada: 80 mm).
    if (y + 80 > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }

    doc.setTextColor(...HEADER_BG);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, MARGIN, y);
    y += 5;

    // Linha divisória
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
    y += 4;

    // Imagem proporcional ao CONTENT_W
    const imgProps = doc.getImageProperties(img);
    const imgW = CONTENT_W;
    const imgH = (imgProps.height / imgProps.width) * imgW;

    // Limite de altura por página
    const maxH = PAGE_H - MARGIN - y;
    const finalH = Math.min(imgH, maxH);
    const finalW = (finalH / imgH) * imgW;

    doc.addImage(img, "PNG", MARGIN, y, finalW, finalH);
    y += finalH + 10;
  }

  // ── Rodapé ───────────────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setTextColor(...TEXT_MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      "Gerado por PROMETHEE II App — Brans & Vincke (1986)",
      MARGIN,
      PAGE_H - 8,
    );
    doc.text(`${p} / ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 8, { align: "right" });
  }

  doc.save(`${problemName || "promethee_ii"}.pdf`);
}
