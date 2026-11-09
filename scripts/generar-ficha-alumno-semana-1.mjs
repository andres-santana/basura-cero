// Genera la ficha imprimible para alumnos del primer experimento publicado
// ("Auditoría de basura de un día", Semana 1) en formato .docx, con el código
// QR real del sitio del proyecto incrustado como imagen.
//
// Uso: node scripts/generar-ficha-alumno-semana-1.mjs
// Requiere dev-deps: docx, qrcode.

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  ImageRun
} from "docx";
import QRCode from "qrcode";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "docs", "manuales");

const SITE_URL = "https://basura-cero.vercel.app/alumno";
const RETO_URL = "https://basura-cero.vercel.app/experimentos/1";

// Paleta "eco" (coherente con generar-manuales.mjs)
const ECO = "15803D";
const ECO_LIGHT = "DCFCE7";
const AMBER = "B45309";
const AMBER_LIGHT = "FEF3C7";
const SLATE = "334155";
const GREY = "64748B";
const FONT = "Calibri";

// ---------- Helpers ----------
function title(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text, bold: true, size: 34, color: ECO, font: FONT })]
  });
}

function subtitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text, italics: true, size: 22, color: GREY, font: FONT })]
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 140, after: 50 },
    children: [new TextRun({ text, bold: true, size: 24, color: ECO, font: FONT })]
  });
}

function p(text, opts = {}) {
  const runs = Array.isArray(text)
    ? text
    : [new TextRun({ text, size: 20, color: SLATE, font: FONT })];
  return new Paragraph({ spacing: { after: 60 }, children: runs, ...opts });
}

function noBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
}

function callout(label, text, tone = "eco") {
  const bg = tone === "amber" ? AMBER_LIGHT : ECO_LIGHT;
  const labelColor = tone === "amber" ? AMBER : ECO;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, color: "auto", fill: bg },
            margins: { top: 70, bottom: 70, left: 140, right: 140 },
            children: [
              new Paragraph({
                spacing: { after: 0 },
                children: [
                  new TextRun({ text: label ? `${label}  ` : "", bold: true, color: labelColor, size: 20, font: FONT }),
                  new TextRun({ text, size: 20, color: SLATE, font: FONT })
                ]
              })
            ]
          })
        ]
      })
    ]
  });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 20 },
    children: [new TextRun({ text, size: 20, color: SLATE, font: FONT })]
  });
}

function numbered(text, ref) {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 20 },
    children: [new TextRun({ text, size: 20, color: SLATE, font: FONT })]
  });
}

// ---------- Documento ----------
async function build() {
  const qrPng = await QRCode.toBuffer(SITE_URL, {
    type: "png",
    width: 420,
    margin: 1,
    color: { dark: "#000000", light: "#FFFFFF" }
  });

  const qrBlock = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 32, type: WidthType.PERCENTAGE },
            verticalAlign: "center",
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    data: qrPng,
                    transformation: { width: 115, height: 115 }
                  })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 68, type: WidthType.PERCENTAGE },
            verticalAlign: "center",
            children: [
              new Paragraph({
                spacing: { after: 40 },
                children: [new TextRun({ text: "📱 ¡Apunta la cámara de tu celu al cuadrito!", bold: true, size: 22, color: ECO, font: FONT })]
              }),
              new Paragraph({
                spacing: { after: 40 },
                children: [new TextRun({ text: "O escribe esta dirección en internet:", size: 20, color: SLATE, font: FONT })]
              }),
              new Paragraph({
                spacing: { after: 40 },
                children: [new TextRun({ text: SITE_URL, bold: true, size: 24, color: SLATE, font: FONT })]
              }),
              new Paragraph({
                children: [new TextRun({ text: "🔑 Pide tu código a tu maestra o maestro para entrar.", bold: true, size: 20, color: AMBER, font: FONT })]
              })
            ]
          })
        ]
      })
    ]
  });

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "proc",
          levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START }]
        }
      ]
    },
    styles: {
      default: { document: { run: { font: FONT, color: SLATE } } }
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 560, bottom: 480, left: 800, right: 800 } }
        },
        children: [
          title("🌍 Basura Cero en 52 Semanas"),
          subtitle("¡Hola, pequeño héroe del planeta! 🦸"),

          p([
            new TextRun({ text: "¿Qué vamos a hacer?  ", bold: true, color: ECO, size: 20, font: FONT }),
            new TextRun({
              text:
                "¡Un reto nuevo cada semana durante todo el año! Vamos a aprender a hacer menos basura y a cuidar la Tierra. Cada equipo gana puntos, ¡y juntos ganamos un planeta más limpio! 🌱",
              size: 20,
              color: SLATE,
              font: FONT
            })
          ]),

          h1("🥇 Tu primer reto — Semana 1"),
          p([new TextRun({ text: "Detectives de la basura por un día 🔍", bold: true, size: 22, color: SLATE, font: FONT })]),
          callout("🎯 Tu misión:", "Descubrir qué tipo de basura hacemos más… ¡para saber qué bajar primero!"),
          callout("🧠 ¿Qué crees?", "Hacemos más basura de la que pensamos, ¡sobre todo plástico!", "amber"),

          h1("🎒 ¿Qué necesitas?"),
          p([new TextRun({ text: "Una bolsa de basura de un día  •  guantes  •  báscula (si tienes)  •  hoja y lápiz  •  3 cajas o botes  •  etiquetas", size: 20, color: SLATE, font: FONT })]),

          h1("🗑️ Separa en 3 montones"),
          callout("🟢 Orgánica:", "Cáscaras de fruta, verduras, hojas secas… ¡lo que fue vivo! Sirve para composta."),
          callout("🔵 Reciclable:", "Papel, cartón, latas, botellas y vidrio, limpios y secos. ¡Se vuelven cosas nuevas!"),
          callout("⚫ No reciclable:", "Pañales, papel de baño usado, envolturas que no se pueden reciclar. Van en bolsa cerrada."),
          callout("🔋 ¡Ojo!", "Pilas, medicinas y aparatos eléctricos van aparte: necesitan un lugar especial.", "amber"),

          h1("👟 Manos a la obra"),
          numbered("Junta toda la basura de un día.", "proc"),
          numbered("Ponte tus guantes.", "proc"),
          numbered("Separa la basura en las 3 cajas.", "proc"),
          numbered("Cuenta o pesa cada montón.", "proc"),
          numbered("Anota lo que descubriste. 📝", "proc"),

          callout("🤔 Piensa:", "¿Cuál montón fue el más grande en tu casa?"),
          callout("💡 ¿Sabías qué?", "¡Una sola persona puede hacer hasta 1 kg de basura al día!", "amber"),

          h1("📲 Entra a jugar el reto"),
          qrBlock,

          new Paragraph({
            spacing: { before: 120 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "Si sabemos cuánta basura hacemos, ¡podemos hacer menos! 🌱💚",
                bold: true,
                italics: true,
                size: 22,
                color: ECO,
                font: FONT
              })
            ]
          })
        ]
      }
    ]
  });

  await mkdir(OUT_DIR, { recursive: true });
  const buffer = await Packer.toBuffer(doc);
  const outPath = join(OUT_DIR, "ficha-alumno-semana-1.docx");
  await writeFile(outPath, buffer);

  // Guardamos también el QR suelto por si se quiere reutilizar.
  await writeFile(join(OUT_DIR, "qr-basura-cero.png"), qrPng);

  console.log("Generado:", outPath);
  console.log("QR:", join(OUT_DIR, "qr-basura-cero.png"));
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
