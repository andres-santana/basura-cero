# Bugfix Requirements Document

## Introduction

En la página del alumno (`/alumno/reto`), varios textos de la interfaz en español
están escritos en el código fuente sin la letra **ñ** ni los acentos correspondientes.
El usuario reportó explícitamente el encabezado "Tu avance del ano", que debería decir
"Tu avance del año". A partir de la captura de la misma pantalla se detectaron otras
cadenas con el mismo problema de **ñ** faltante (por ejemplo "caras de ninas ni ninos").

La investigación del código confirma que **no es un problema de codificación ni de
renderizado**: el archivo `src/components/students/student-challenge.tsx` contiene las
cadenas literales sin la **ñ** ni los acentos (p. ej. `ano`, `ninas`, `ninos`,
`acompano`, `Todavia`). El archivo se guarda en UTF-8 válido, por lo que la causa raíz
es un **defecto literal en las cadenas de origen**: faltan los caracteres acentuados y
la **ñ** en el texto escrito.

El idioma del dominio es español y la copia de la interfaz debe mostrarse con la
ortografía correcta (ñ y acentos). Este bugfix corrige las cadenas de interfaz
afectadas en `src/components/students/student-challenge.tsx`, que es el componente que
se renderiza en la ruta `/alumno/reto`.

## Bug Analysis

### Current Behavior (Defect)

Las cadenas de interfaz visibles para el alumno en `/alumno/reto` se muestran sin la
letra **ñ** ni los acentos porque así están escritas en el código fuente.

1.1 WHEN el alumno ve la sección de avance anual en `/alumno/reto` THEN el sistema muestra "Tu avance del ano" (sin la ñ)
1.2 WHEN el alumno ve el bloque de subir evidencia en `/alumno/reto` THEN el sistema muestra "...caras de ninas ni ninos." (sin las ñ)
1.3 WHEN no hay reto asignado en `/alumno/reto` THEN el sistema muestra el encabezado "Todavia no hay reto" (sin el acento en "Todavía")
1.4 WHEN el alumno ve el mensaje de ánimo de la mascota en `/alumno/reto` THEN el sistema muestra "...Yo te acompano." (sin la ñ en "acompaño")

### Expected Behavior (Correct)

Las mismas cadenas deben mostrarse con la ortografía correcta en español, con la **ñ**
y los acentos correspondientes.

2.1 WHEN el alumno ve la sección de avance anual en `/alumno/reto` THEN el sistema SHALL mostrar "Tu avance del año"
2.2 WHEN el alumno ve el bloque de subir evidencia en `/alumno/reto` THEN el sistema SHALL mostrar "...caras de niñas ni niños."
2.3 WHEN no hay reto asignado en `/alumno/reto` THEN el sistema SHALL mostrar el encabezado "Todavía no hay reto"
2.4 WHEN el alumno ve el mensaje de ánimo de la mascota en `/alumno/reto` THEN el sistema SHALL mostrar "...Yo te acompaño."

### Unchanged Behavior (Regression Prevention)

El resto del comportamiento y de las cadenas de la pantalla debe permanecer igual.

3.1 WHEN las cadenas de interfaz ya están escritas correctamente en español (p. ej. "Sube tu evidencia", "Tus pasos", "Subir mi foto") THEN el sistema SHALL CONTINUE TO mostrarlas sin cambios
3.2 WHEN el alumno interactúa con los pasos, el minijuego, la barra de XP o el botón de salir THEN el sistema SHALL CONTINUE TO comportarse exactamente igual (sin cambios de lógica)
3.3 WHEN se renderizan valores dinámicos (título del reto, objetivo, alias del alumno, número de semana, calendario de 52 semanas) THEN el sistema SHALL CONTINUE TO mostrarlos tal como provienen de los datos
3.4 WHEN la pantalla carga, maneja errores o ejecuta peticiones a la API THEN el sistema SHALL CONTINUE TO funcionar sin cambios de comportamiento
