// Genera los manuales de usuario (alumno y profesor) en formato .docx
// Uso: node scripts/generar-manuales.mjs
// Requiere la dependencia "docx" (npm install docx).

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
  LevelFormat,
  PageBreak
} from "docx";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "docs", "manuales");

// Paleta "eco"
const ECO = "15803D"; // emerald-700
const ECO_LIGHT = "DCFCE7"; // emerald-100
const AMBER = "B45309";
const AMBER_LIGHT = "FEF3C7";
const SLATE = "334155";
const GREY = "64748B";

const FONT = "Calibri";

// ---------- Helpers de contenido ----------

function title(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [
      new TextRun({ text, bold: true, size: 48, color: ECO, font: FONT })
    ]
  });
}

function subtitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [
      new TextRun({ text, italics: true, size: 26, color: GREY, font: FONT })
    ]
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 140 },
    children: [new TextRun({ text, bold: true, size: 32, color: ECO, font: FONT })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 100 },
    children: [new TextRun({ text, bold: true, size: 26, color: SLATE, font: FONT })]
  });
}

function p(text, opts = {}) {
  const runs = Array.isArray(text)
    ? text
    : [new TextRun({ text, size: 22, color: SLATE, font: FONT })];
  return new Paragraph({ spacing: { after: 120 }, children: runs, ...opts });
}

function run(text, opts = {}) {
  return new TextRun({ text, size: 22, color: SLATE, font: FONT, ...opts });
}

function bullet(text, level = 0) {
  const runs = Array.isArray(text)
    ? text
    : [new TextRun({ text, size: 22, color: SLATE, font: FONT })];
  return new Paragraph({
    numbering: { reference: "vinetas", level },
    spacing: { after: 60 },
    children: runs
  });
}

function step(text, instanceNumber) {
  const runs = Array.isArray(text)
    ? text
    : [new TextRun({ text, size: 22, color: SLATE, font: FONT })];
  return new Paragraph({
    numbering: { reference: `pasos-${instanceNumber}`, level: 0 },
    spacing: { after: 80 },
    children: runs
  });
}

// Caja destacada (callout) con color de fondo
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
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: [
              new Paragraph({
                spacing: { after: 0 },
                children: [
                  new TextRun({ text: `${label}  `, bold: true, color: labelColor, size: 22, font: FONT }),
                  new TextRun({ text, size: 22, color: SLATE, font: FONT })
                ]
              })
            ]
          })
        ]
      })
    ]
  });
}

function noBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return {
    top: none, bottom: none, left: none, right: none,
    insideHorizontal: none, insideVertical: none
  };
}

function thinBorder() {
  const b = { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" };
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
}

// Tabla sencilla de 2 columnas (ej. estado -> significado)
function twoColTable(headers, rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (hText) =>
        new TableCell({
          shading: { type: ShadingType.CLEAR, color: "auto", fill: ECO },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: hText, bold: true, color: "FFFFFF", size: 22, font: FONT })]
            })
          ]
        })
    )
  });

  const bodyRows = rows.map(
    (cells, i) =>
      new TableRow({
        children: cells.map(
          (cText) =>
            new TableCell({
              shading:
                i % 2 === 1
                  ? { type: ShadingType.CLEAR, color: "auto", fill: "F1F5F9" }
                  : undefined,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: cText, size: 22, color: SLATE, font: FONT })]
                })
              ]
            })
        )
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: thinBorder(),
    rows: [headerRow, ...bodyRows]
  });
}

function spacer(after = 120) {
  return new Paragraph({ spacing: { after }, children: [] });
}

// Numbering config compartido. Creamos varias referencias "pasos-N"
// porque cada lista numerada independiente necesita su propia referencia
// para reiniciar en 1.
function buildNumbering(stepListCount) {
  const configs = [
    {
      reference: "vinetas",
      levels: [
        {
          level: 0,
          format: LevelFormat.BULLET,
          text: "\u2022",
          alignment: AlignmentType.LEFT,
          style: { run: { color: ECO } }
        },
        {
          level: 1,
          format: LevelFormat.BULLET,
          text: "\u25E6",
          alignment: AlignmentType.LEFT
        }
      ]
    }
  ];

  for (let i = 1; i <= stepListCount; i += 1) {
    configs.push({
      reference: `pasos-${i}`,
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { run: { bold: true, color: ECO } }
        }
      ]
    });
  }

  return { config: configs };
}

function footer() {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 480 },
    border: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1", space: 8 }
    },
    children: [
      new TextRun({
        text: "Basura Cero en 52 Semanas  ·  proyectobasuracero.org",
        size: 18,
        color: GREY,
        italics: true,
        font: FONT
      })
    ]
  });
}

function buildDoc(children, stepListCount) {
  return new Document({
    creator: "Basura Cero en 52 Semanas",
    title: "Manual de usuario",
    numbering: buildNumbering(stepListCount),
    styles: {
      default: {
        document: { run: { font: FONT } }
      }
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } }
        },
        children
      }
    ]
  });
}

// =====================================================================
// MANUAL DEL ALUMNO
// =====================================================================
function manualAlumno() {
  let s = 0;
  const next = () => (s += 1);

  const children = [
    title("Manual del Alumno"),
    subtitle("Basura Cero en 52 Semanas"),

    p([
      run(
        "Este es tu manual. Aquí vas a aprender a entrar a la plataforma, hacer tu reto de la semana, jugar y subir tu foto. ¡Vamos a cuidar el planeta juntos!"
      )
    ]),

    h1("1. ¿Qué es esto?"),
    p(
      "Cada semana tu maestra o maestro te da un reto para ayudar al planeta: separar la basura, reusar materiales y aprender cosas nuevas. Durante el año hay 52 retos, uno por semana. Tú completas pasos, juegas un minijuego y subes una foto de lo que hiciste."
    ),

    h1("2. Cómo entrar con tu código"),
    p(
      "Tú no necesitas correo ni contraseña. Entras con un código corto que te da tu maestra o maestro, por ejemplo ABC-123."
    ),
    step("Abre la plataforma en el navegador (tu maestra o maestro te dice la dirección).", next() && s),
    step("Escribe tu código en la cajita que dice ABC-123.", s),
    step("Toca el botón verde Entrar.", s),
    callout(
      "Truco:",
      "Si tu maestra o maestro te da un código QR, puedes escanearlo con la cámara y la plataforma te deja entrar sola, sin escribir nada.",
      "eco"
    ),
    spacer(),
    callout(
      "Importante:",
      "Tu sesión dura 2 horas. Si pasa mucho tiempo, quizá tengas que volver a escribir tu código.",
      "amber"
    ),

    h1("3. Tu reto de la semana"),
    p(
      "Cuando entras, ves la pantalla de tu reto. Arriba dice la Semana y el nombre del reto. También hay un personaje (mascota) que te anima."
    ),
    h2("Lo que ves en esta pantalla"),
    bullet("El título del reto y su objetivo (qué vas a lograr)."),
    bullet("Una barra de XP que se llena con los puntos que ganas."),
    bullet("La lista Tus pasos: cosas que tienes que hacer."),
    bullet("Un minijuego (si el reto tiene uno)."),
    bullet("Tu avance del año: un calendario de 52 cuadritos; los que ya lograste tienen una palomita."),
    bullet("Un botón grande para Subir mi foto."),

    h2("Completar tus pasos"),
    step("Lee cada paso de la lista.", next() && s),
    step("Cuando termines un paso, tócalo. Se pondrá una palomita verde y ganarás puntos.", s),
    step("Si te equivocaste, tócalo otra vez para quitar la palomita.", s),
    p([
      run("Arriba de la lista verás un contador, por ejemplo ", {}),
      run("2/3", { bold: true, color: ECO }),
      run(", que te dice cuántos pasos llevas.", {})
    ]),

    h2("El minijuego"),
    p(
      "Algunos retos tienen un juego de relacionar parejas. Tocas una tarjeta de un lado y luego su pareja del otro lado. Si aciertas, se queda con una palomita; si no, la tarjeta tiembla e intentas de nuevo. Cuando juntas todas las parejas, toca Terminar y ganas puntos. ¡Verás confeti!"
    ),

    h1("4. Subir tu evidencia (tu foto)"),
    p(
      "La evidencia es la foto de lo que hiciste. Entra desde el botón Subir mi foto o desde el enlace Volver a mi reto."
    ),
    step("Toca el botón Elegir fotos y escoge una o varias fotos.", next() && s),
    step("Si quieres, escribe en la cajita qué hiciste (es opcional).", s),
    step("Revisa tus fotos. Si una no te gusta, tócala en el bote de basura para quitarla.", s),
    step("Toca el botón grande Enviar mi evidencia.", s),
    p(
      "Cuando se envía, aparece confeti y un mensaje: tu maestra o maestro la va a revisar."
    ),
    spacer(),
    callout(
      "Regla de seguridad:",
      "Toma la foto de tu RESULTADO (la basura separada o tu manualidad). No subas fotos donde se vea la cara de niñas o niños.",
      "amber"
    ),

    h2("¿Qué significa el estado de mi evidencia?"),
    twoColTable(
      ["Estado", "Qué significa"],
      [
        ["Borrador", "Todavía no la has enviado."],
        ["Enviada, esperando revisión", "Ya la mandaste. Tu maestra o maestro la va a ver."],
        ["Aprobada", "¡Felicidades! Tu evidencia fue aceptada."],
        ["Te pidieron volver a intentarlo", "Tienes que hacer un cambio y volver a enviarla."]
      ]
    ),

    h1("5. Salir"),
    p(
      "Cuando termines, toca el botón Salir (arriba a la derecha). Así nadie más usa tu sesión. Para volver a entrar, escribe tu código otra vez."
    ),

    h1("6. Si algo no funciona"),
    bullet("Si dice que tu código no es válido, pide a tu maestra o maestro que te dé uno nuevo."),
    bullet("Si dice que no hay reto todavía, espera; tu maestra o maestro lo activa cuando empieza la semana."),
    bullet("Si hiciste muchos intentos seguidos, espera un minuto y vuelve a escribir tu código."),

    footer()
  ];

  return buildDoc(children, s);
}

// =====================================================================
// MANUAL DEL PROFESOR (MAESTRO)
// =====================================================================
function manualProfesor() {
  let s = 0;
  const next = () => (s += 1);

  const children = [
    title("Manual del Profesor"),
    subtitle("Basura Cero en 52 Semanas · Rol Maestro"),

    p(
      "Esta guía explica cómo iniciar sesión, administrar tus grupos y alumnos, repartir códigos de acceso, revisar las evidencias de los alumnos y registrar la evidencia del grupo con sus métricas de impacto."
    ),

    h1("1. Conceptos básicos"),
    twoColTable(
      ["Concepto", "Descripción"],
      [
        ["Semana", "Una de las 52 semanas del programa. El avance se mide por semanas completadas."],
        ["Reto / Experimento", "La actividad de la semana (objetivo, pasos, a veces un minijuego y una ficha imprimible). La activa el administrador."],
        ["Evidencia del alumno", "La foto y el comentario que sube cada alumno. Tú la apruebas o la rechazas."],
        ["Evidencia del grupo", "El registro formal que haces tú a nombre del grupo, con métricas de impacto."],
        ["Métricas de impacto", "Participantes, kilos separados y materiales reutilizados."],
        ["Insignias y puntaje", "Las evidencias ganan puntos automáticamente y desbloquean insignias para el ranking."]
      ]
    ),

    h1("2. Iniciar sesión"),
    p(
      "Tú entras con el correo y la contraseña registrados en el sistema. Tu rol se detecta automáticamente y te lleva a tu panel."
    ),
    step("Abre la página de inicio de sesión (/login).", next() && s),
    step("Escribe tu correo y tu contraseña (mínimo 6 caracteres).", s),
    step("Toca Iniciar sesión. Entrarás al Panel de maestro.", s),
    callout(
      "Primer ingreso:",
      "Si es tu primera vez, el sistema te pedirá cambiar tu contraseña por una segura antes de continuar.",
      "amber"
    ),

    h1("3. El Panel de maestro"),
    p("Al entrar verás tu panel principal. Allí encuentras:"),
    bullet("El Reto activo de la semana: título, objetivo y periodo de fechas."),
    bullet([
      run("Botones para "),
      run("Ver detalle del experimento", { bold: true }),
      run(" y, si está disponible, "),
      run("Descargar ficha", { bold: true }),
      run(" (PDF imprimible).")
    ]),
    bullet("Un anillo de progreso con las semanas completadas."),
    bullet("El formulario para subir la evidencia del grupo."),
    bullet("Las insignias de tus grupos."),
    bullet([
      run("Un enlace arriba a la derecha: "),
      run("Gestionar alumnos", { bold: true }),
      run(".")
    ]),
    spacer(),
    callout(
      "Si no hay reto activo:",
      "Verás un aviso. Pídele al administrador que active el reto de la semana. Mientras no haya reto activo, no podrás registrar evidencias.",
      "amber"
    ),

    h1("4. Gestionar alumnos y códigos de acceso"),
    p(
      "Desde Gestionar alumnos administras tu lista de alumnos y repartes los códigos con los que ellos entran. Los alumnos no usan correo ni contraseña: solo su código."
    ),
    callout(
      "Privacidad de menores:",
      "Registra a cada alumno con un alias (apodo), por ejemplo Estrella01. No uses nombres reales, apellidos, correos ni fotos donde se vea la cara de niñas y niños.",
      "amber"
    ),

    h2("Agregar un alumno"),
    step("Selecciona el grupo en la lista desplegable.", next() && s),
    step("Escribe un alias (mínimo 2 caracteres) y, si quieres, el grado.", s),
    step("Toca Agregar.", s),
    step("Aparecerá el código de acceso del alumno (por ejemplo ABC-123) y un código QR.", s),
    callout(
      "Muy importante:",
      "Guarda o imprime el código en ese momento. Por seguridad, el código completo solo se muestra una vez. Después solo verás los dos primeros caracteres (AB****).",
      "amber"
    ),

    h2("Repartir el acceso"),
    bullet("Puedes dictar el código al alumno para que lo escriba, o"),
    bullet("Mostrar o imprimir el código QR para que lo escanee y entre sin escribir."),

    h2("Administrar la lista"),
    p("En cada alumno de la lista tienes estas acciones:"),
    twoColTable(
      ["Acción", "Para qué sirve"],
      [
        ["Código", "Genera un código nuevo (el anterior deja de funcionar). Úsalo si el alumno pierde su código."],
        ["Activar / Desactivar", "Un alumno inactivo no puede entrar. Útil al final de un periodo."],
        ["Eliminar", "Borra al alumno de forma permanente. Pide confirmación y no se puede deshacer."]
      ]
    ),

    h1("5. Revisar las evidencias de los alumnos"),
    p(
      "En la misma sección de alumnos tienes el bloque Evidencias de alumnos, donde revisas lo que suben."
    ),
    step("Usa las pestañas para filtrar: Pendientes, Aprobadas, Rechazadas o Todas.", next() && s),
    step("Toca una evidencia para expandirla y ver las fotos y el comentario del alumno.", s),
    step("Decide con los botones: Aprobar, Rechazar o Regresar a pendiente.", s),
    p([
      run("Cada evidencia muestra el alias del alumno, su grupo, la semana y el experimento, y cuántas fotos trae.")
    ]),

    h1("6. Registrar la evidencia del grupo"),
    p(
      "Además de revisar a los alumnos, tú registras la evidencia formal del grupo. Esto es lo que genera el puntaje del grupo. Se hace desde el formulario Subir evidencia semanal del panel."
    ),
    step("Selecciona el grupo.", next() && s),
    step("Escribe los comentarios y aprendizajes (mínimo 5 caracteres).", s),
    step("Captura las métricas de impacto: participantes, kilos separados y materiales reutilizados.", s),
    step("Adjunta las evidencias: fotos o archivos PDF (puedes subir varios).", s),
    step("Toca Enviar evidencia para registrarla, o Guardar borrador para terminar después.", s),
    callout(
      "Puntaje automático:",
      "Al enviar la evidencia, el sistema calcula el puntaje del grupo automáticamente a partir de las métricas registradas.",
      "eco"
    ),

    h2("Estados de una evidencia"),
    twoColTable(
      ["Estado", "Qué significa"],
      [
        ["Borrador (draft)", "Guardada pero aún no enviada ni puntuada."],
        ["Enviada (submitted)", "Registrada y con puntaje calculado."],
        ["Aprobada (approved)", "Revisada y aceptada."],
        ["Rechazada (rejected)", "No aceptada; requiere corrección."]
      ]
    ),

    h1("7. Recursos públicos útiles"),
    bullet([
      run("Experimentos", { bold: true }),
      run(": biblioteca pública de los retos publicados, con el detalle de cada semana.")
    ]),
    bullet([
      run("Ranking e Insignias", { bold: true }),
      run(": tablero de posiciones y medallas del programa.")
    ]),

    h1("8. Preguntas frecuentes"),
    p([run("No puedo registrar evidencias.", { bold: true })]),
    p("Revisa que haya un reto activo y que tengas al menos un grupo asignado. Si no hay reto, pide al administrador que active la semana."),
    p([run("Un alumno perdió su código.", { bold: true })]),
    p("Entra a Gestionar alumnos, ubica al alumno y toca Código para generar uno nuevo."),
    p([run("¿Puedo ver el código completo de un alumno más tarde?", { bold: true })]),
    p("No. Por seguridad solo se muestra una vez. Si hace falta, genera uno nuevo."),

    footer()
  ];

  return buildDoc(children, s);
}

// =====================================================================
async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const alumno = manualAlumno();
  const profesor = manualProfesor();

  const alumnoBuf = await Packer.toBuffer(alumno);
  const profesorBuf = await Packer.toBuffer(profesor);

  const alumnoPath = join(OUT_DIR, "manual-alumno.docx");
  const profesorPath = join(OUT_DIR, "manual-profesor.docx");

  await writeFile(alumnoPath, alumnoBuf);
  await writeFile(profesorPath, profesorBuf);

  console.log("Generado:", alumnoPath, `(${alumnoBuf.length} bytes)`);
  console.log("Generado:", profesorPath, `(${profesorBuf.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
