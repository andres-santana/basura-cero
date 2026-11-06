/**
 * Contenido de los manuales de usuario (alumno y maestro) como estructura de
 * datos reutilizable. Las paginas HTML bajo `/manuales` consumen este modulo
 * para renderizar el contenido con Tailwind, de forma responsive, accesible e
 * imprimible.
 *
 * El texto proviene del contenido ya redactado en
 * `scripts/generar-manuales.mjs`, adaptado al formato web.
 */

export type ManualAudience = "alumno" | "maestro";

/** Bloques de contenido que puede contener una seccion del manual. */
export type ManualBlock =
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "steps"; items: string[] }
  | { type: "callout"; tone: "eco" | "amber"; label: string; text: string }
  | { type: "table"; headers: [string, string]; rows: Array<[string, string]> };

export type ManualSection = {
  id: string;
  heading: string;
  blocks: ManualBlock[];
};

export type Manual = {
  audience: ManualAudience;
  title: string;
  subtitle: string;
  intro: string;
  sections: ManualSection[];
};

export const ALUMNO_MANUAL: Manual = {
  audience: "alumno",
  title: "Manual del Alumno",
  subtitle: "Basura Cero en 52 Semanas",
  intro:
    "Este es tu manual. Aqui vas a aprender a entrar a la plataforma, hacer tu reto de la semana, jugar y subir tu foto. Vamos a cuidar el planeta juntos!",
  sections: [
    {
      id: "que-es",
      heading: "1. Que es esto?",
      blocks: [
        {
          type: "paragraph",
          text: "Cada semana tu maestra o maestro te da un reto para ayudar al planeta: separar la basura, reusar materiales y aprender cosas nuevas. Durante el ano hay 52 retos, uno por semana. Tu completas pasos, juegas un minijuego y subes una foto de lo que hiciste."
        }
      ]
    },
    {
      id: "como-entrar",
      heading: "2. Como entrar con tu codigo",
      blocks: [
        {
          type: "paragraph",
          text: "Tu no necesitas correo ni contrasena. Entras con un codigo corto que te da tu maestra o maestro, por ejemplo ABC-123."
        },
        {
          type: "steps",
          items: [
            "Abre la plataforma en el navegador (tu maestra o maestro te dice la direccion).",
            "Escribe tu codigo en la cajita que dice ABC-123.",
            "Toca el boton verde Entrar."
          ]
        },
        {
          type: "callout",
          tone: "eco",
          label: "Truco:",
          text: "Si tu maestra o maestro te da un codigo QR, puedes escanearlo con la camara y la plataforma te deja entrar sola, sin escribir nada."
        },
        {
          type: "callout",
          tone: "amber",
          label: "Importante:",
          text: "Tu sesion dura 2 horas. Si pasa mucho tiempo, quiza tengas que volver a escribir tu codigo."
        }
      ]
    },
    {
      id: "tu-reto",
      heading: "3. Tu reto de la semana",
      blocks: [
        {
          type: "paragraph",
          text: "Cuando entras, ves la pantalla de tu reto. Arriba dice la Semana y el nombre del reto. Tambien hay un personaje (mascota) que te anima."
        },
        {
          type: "bullets",
          items: [
            "El titulo del reto y su objetivo (que vas a lograr).",
            "Una barra de XP que se llena con los puntos que ganas.",
            "La lista Tus pasos: cosas que tienes que hacer.",
            "Un minijuego (si el reto tiene uno).",
            "Tu avance del ano: un calendario de 52 cuadritos; los que ya lograste tienen una palomita.",
            "Un boton grande para Subir mi foto."
          ]
        },
        {
          type: "steps",
          items: [
            "Lee cada paso de la lista.",
            "Cuando termines un paso, tocalo. Se pondra una palomita verde y ganaras puntos.",
            "Si te equivocaste, tocalo otra vez para quitar la palomita."
          ]
        },
        {
          type: "paragraph",
          text: "Algunos retos tienen un juego de relacionar parejas. Tocas una tarjeta de un lado y luego su pareja del otro lado. Cuando juntas todas las parejas, toca Terminar y ganas puntos. Veras confeti!"
        }
      ]
    },
    {
      id: "evidencia",
      heading: "4. Subir tu evidencia (tu foto)",
      blocks: [
        {
          type: "paragraph",
          text: "La evidencia es la foto de lo que hiciste. Entra desde el boton Subir mi foto o desde el enlace Volver a mi reto."
        },
        {
          type: "steps",
          items: [
            "Toca el boton Elegir fotos y escoge una o varias fotos.",
            "Si quieres, escribe en la cajita que hiciste (es opcional).",
            "Revisa tus fotos. Si una no te gusta, tocala en el bote de basura para quitarla.",
            "Toca el boton grande Enviar mi evidencia."
          ]
        },
        {
          type: "callout",
          tone: "amber",
          label: "Regla de seguridad:",
          text: "Toma la foto de tu RESULTADO (la basura separada o tu manualidad). No subas fotos donde se vea la cara de ninas o ninos."
        },
        {
          type: "table",
          headers: ["Estado", "Que significa"],
          rows: [
            ["Borrador", "Todavia no la has enviado."],
            ["Enviada, esperando revision", "Ya la mandaste. Tu maestra o maestro la va a ver."],
            ["Aprobada", "Felicidades! Tu evidencia fue aceptada."],
            ["Te pidieron volver a intentarlo", "Tienes que hacer un cambio y volver a enviarla."]
          ]
        }
      ]
    },
    {
      id: "salir",
      heading: "5. Salir",
      blocks: [
        {
          type: "paragraph",
          text: "Cuando termines, toca el boton Salir (arriba a la derecha). Asi nadie mas usa tu sesion. Para volver a entrar, escribe tu codigo otra vez."
        }
      ]
    },
    {
      id: "ayuda",
      heading: "6. Si algo no funciona",
      blocks: [
        {
          type: "bullets",
          items: [
            "Si dice que tu codigo no es valido, pide a tu maestra o maestro que te de uno nuevo.",
            "Si dice que no hay reto todavia, espera; tu maestra o maestro lo activa cuando empieza la semana.",
            "Si hiciste muchos intentos seguidos, espera un minuto y vuelve a escribir tu codigo."
          ]
        }
      ]
    }
  ]
};

export const MAESTRO_MANUAL: Manual = {
  audience: "maestro",
  title: "Manual del Maestro",
  subtitle: "Basura Cero en 52 Semanas - Rol Maestro",
  intro:
    "Esta guia explica como iniciar sesion, administrar tus grupos y alumnos, repartir codigos de acceso, revisar las evidencias de los alumnos y registrar la evidencia del grupo con sus metricas de impacto.",
  sections: [
    {
      id: "conceptos",
      heading: "1. Conceptos basicos",
      blocks: [
        {
          type: "table",
          headers: ["Concepto", "Descripcion"],
          rows: [
            ["Semana", "Una de las 52 semanas del programa. El avance se mide por semanas completadas."],
            ["Reto / Experimento", "La actividad de la semana (objetivo, pasos, a veces un minijuego y una ficha imprimible). La activa el administrador."],
            ["Evidencia del alumno", "La foto y el comentario que sube cada alumno. Tu la apruebas o la rechazas."],
            ["Evidencia del grupo", "El registro formal que haces tu a nombre del grupo, con metricas de impacto."],
            ["Metricas de impacto", "Participantes, kilos separados y materiales reutilizados."],
            ["Insignias y puntaje", "Las evidencias ganan puntos automaticamente y desbloquean insignias para el ranking."]
          ]
        }
      ]
    },
    {
      id: "iniciar-sesion",
      heading: "2. Iniciar sesion",
      blocks: [
        {
          type: "paragraph",
          text: "Tu entras con el correo y la contrasena registrados en el sistema. Tu rol se detecta automaticamente y te lleva a tu panel."
        },
        {
          type: "steps",
          items: [
            "Abre la pagina de inicio de sesion (/login).",
            "Escribe tu correo y tu contrasena (minimo 6 caracteres).",
            "Toca Iniciar sesion. Entraras al Panel de maestro."
          ]
        },
        {
          type: "callout",
          tone: "amber",
          label: "Primer ingreso:",
          text: "Si es tu primera vez, el sistema te pedira cambiar tu contrasena por una segura antes de continuar."
        }
      ]
    },
    {
      id: "panel",
      heading: "3. El Panel de maestro",
      blocks: [
        { type: "paragraph", text: "Al entrar veras tu panel principal. Alli encuentras:" },
        {
          type: "bullets",
          items: [
            "El Reto activo de la semana: titulo, objetivo y periodo de fechas.",
            "Botones para Ver detalle del experimento y, si esta disponible, Descargar ficha (PDF imprimible).",
            "Un anillo de progreso con las semanas completadas.",
            "El formulario para subir la evidencia del grupo.",
            "Las insignias de tus grupos.",
            "Un enlace arriba a la derecha: Gestionar alumnos."
          ]
        },
        {
          type: "callout",
          tone: "amber",
          label: "Si no hay reto activo:",
          text: "Veras un aviso. Pidele al administrador que active el reto de la semana. Mientras no haya reto activo, no podras registrar evidencias."
        }
      ]
    },
    {
      id: "alumnos",
      heading: "4. Gestionar alumnos y codigos de acceso",
      blocks: [
        {
          type: "paragraph",
          text: "Desde Gestionar alumnos administras tu lista de alumnos y repartes los codigos con los que ellos entran. Los alumnos no usan correo ni contrasena: solo su codigo."
        },
        {
          type: "callout",
          tone: "amber",
          label: "Privacidad de menores:",
          text: "Registra a cada alumno con un alias (apodo), por ejemplo Estrella01. No uses nombres reales, apellidos, correos ni fotos donde se vea la cara de ninas y ninos."
        },
        {
          type: "steps",
          items: [
            "Selecciona el grupo en la lista desplegable.",
            "Escribe un alias (minimo 2 caracteres) y, si quieres, el grado.",
            "Toca Agregar.",
            "Aparecera el codigo de acceso del alumno (por ejemplo ABC-123) y un codigo QR."
          ]
        },
        {
          type: "callout",
          tone: "amber",
          label: "Muy importante:",
          text: "Guarda o imprime el codigo en ese momento. Por seguridad, el codigo completo solo se muestra una vez. Despues solo veras los dos primeros caracteres (AB****)."
        },
        {
          type: "table",
          headers: ["Accion", "Para que sirve"],
          rows: [
            ["Codigo", "Genera un codigo nuevo (el anterior deja de funcionar). Usalo si el alumno pierde su codigo."],
            ["Activar / Desactivar", "Un alumno inactivo no puede entrar. Util al final de un periodo."],
            ["Eliminar", "Borra al alumno de forma permanente. Pide confirmacion y no se puede deshacer."]
          ]
        }
      ]
    },
    {
      id: "revisar-evidencias",
      heading: "5. Revisar las evidencias de los alumnos",
      blocks: [
        {
          type: "paragraph",
          text: "En la misma seccion de alumnos tienes el bloque Evidencias de alumnos, donde revisas lo que suben."
        },
        {
          type: "steps",
          items: [
            "Usa las pestanas para filtrar: Pendientes, Aprobadas, Rechazadas o Todas.",
            "Toca una evidencia para expandirla y ver las fotos y el comentario del alumno.",
            "Decide con los botones: Aprobar, Rechazar o Regresar a pendiente."
          ]
        }
      ]
    },
    {
      id: "evidencia-grupo",
      heading: "6. Registrar la evidencia del grupo",
      blocks: [
        {
          type: "paragraph",
          text: "Ademas de revisar a los alumnos, tu registras la evidencia formal del grupo. Esto es lo que genera el puntaje del grupo. Se hace desde el formulario Subir evidencia semanal del panel."
        },
        {
          type: "steps",
          items: [
            "Selecciona el grupo.",
            "Escribe los comentarios y aprendizajes (minimo 5 caracteres).",
            "Captura las metricas de impacto: participantes, kilos separados y materiales reutilizados.",
            "Adjunta las evidencias: fotos o archivos PDF (puedes subir varios).",
            "Toca Enviar evidencia para registrarla, o Guardar borrador para terminar despues."
          ]
        },
        {
          type: "callout",
          tone: "eco",
          label: "Puntaje automatico:",
          text: "Al enviar la evidencia, el sistema calcula el puntaje del grupo automaticamente a partir de las metricas registradas."
        },
        {
          type: "table",
          headers: ["Estado", "Que significa"],
          rows: [
            ["Borrador (draft)", "Guardada pero aun no enviada ni puntuada."],
            ["Enviada (submitted)", "Registrada y con puntaje calculado."],
            ["Aprobada (approved)", "Revisada y aceptada."],
            ["Rechazada (rejected)", "No aceptada; requiere correccion."]
          ]
        }
      ]
    },
    {
      id: "faq",
      heading: "7. Preguntas frecuentes",
      blocks: [
        {
          type: "bullets",
          items: [
            "No puedo registrar evidencias: revisa que haya un reto activo y que tengas al menos un grupo asignado.",
            "Un alumno perdio su codigo: entra a Gestionar alumnos, ubica al alumno y toca Codigo para generar uno nuevo.",
            "Puedo ver el codigo completo de un alumno mas tarde? No. Por seguridad solo se muestra una vez; genera uno nuevo si hace falta."
          ]
        }
      ]
    }
  ]
};

export function getManual(audience: ManualAudience): Manual {
  return audience === "alumno" ? ALUMNO_MANUAL : MAESTRO_MANUAL;
}
