# Implementation Plan

- [x] 1. Escribir prueba de exploración de la condición del bug
  - **Property 1: Bug Condition** - Ortografía española correcta en cadenas de interfaz
  - **IMPORTANTE**: Escribe esta prueba basada en propiedades ANTES de implementar el arreglo
  - **CRÍTICO**: Esta prueba DEBE FALLAR en el código sin corregir — la falla confirma que el bug existe
  - **NO intentes arreglar la prueba ni el código cuando falle**
  - **NOTA**: Esta prueba codifica el comportamiento esperado — validará el arreglo cuando pase tras la implementación
  - **GOAL**: Exponer contraejemplos que demuestren que el bug existe
  - **Enfoque PBT acotado**: El bug es determinista (texto estático), así que acota la propiedad a los casos concretos que fallan: las cuatro cadenas literales identificadas
  - Renderizar `StudentChallenge` (de `src/components/students/student-challenge.tsx`) en los escenarios relevantes y aseverar que el DOM contiene la ortografía correcta (de la Bug Condition en el diseño):
    - Con reto asignado y `calendarWeeks` presente: aseverar el encabezado "Tu avance del año"
    - Con reto asignado: aseverar el aviso de evidencia "...caras de niñas ni niños."
    - Con reto asignado: aseverar que el mensaje de la mascota contiene "Yo te acompaño."
    - Con `challenge = null` (sin reto asignado): aseverar el encabezado "Todavía no hay reto"
  - Las aserciones deben coincidir con las Expected Behavior Properties del diseño (isBugCondition → cadenas con ñ/acentos)
  - Ejecutar la prueba sobre el código SIN corregir
  - **RESULTADO ESPERADO**: La prueba FALLA (es lo correcto — demuestra que el bug existe)
  - Documentar los contraejemplos encontrados (p. ej. el DOM contiene "Tu avance del ano", "ninas ni ninos", "Todavia no hay reto" y "Yo te acompano")
  - Marcar la tarea como completa cuando la prueba esté escrita, ejecutada y la falla documentada
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Escribir pruebas de preservación (ANTES de implementar el arreglo)
  - **Property 2: Preservation** - Resto de la pantalla sin cambios
  - **IMPORTANTE**: Sigue la metodología de observación primero (observation-first)
  - Observar el comportamiento en el código SIN corregir para las entradas donde NO se cumple la condición del bug (isBugCondition retorna false):
    - Cadenas ya correctas: "Sube tu evidencia", "Tus pasos", "Subir mi foto", "Salir", "Cargando tu reto..."
    - Valores dinámicos: alias del alumno, número de semana, título/objetivo del reto, calendario de 52 semanas
    - Interacciones: marcar/desmarcar pasos (`toggleStep`), el minijuego (`completeGame`), la barra de XP (`XpBar`) y el botón de salir (`logout`)
  - Escribir pruebas basadas en propiedades que capturen los patrones de comportamiento observados (de las Preservation Requirements del diseño): generar distintos `view` (variando alias, número de semana, títulos y objetivos) y verificar que las cadenas ya correctas y las interpolaciones dinámicas se mantienen intactas; generar estados con y sin reto asignado
  - Las pruebas basadas en propiedades generan muchos casos para garantías más fuertes
  - Ejecutar las pruebas sobre el código SIN corregir
  - **RESULTADO ESPERADO**: Las pruebas PASAN (esto confirma el comportamiento base a preservar)
  - Marcar la tarea como completa cuando las pruebas estén escritas, ejecutadas y pasando en el código sin corregir
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Arreglar la ortografía (ñ/acentos) de las cuatro cadenas de interfaz en `StudentChallenge`

  - [x] 3.1 Implementar el arreglo
    - En `src/components/students/student-challenge.tsx`, corregir únicamente las cuatro cadenas literales afectadas (sin tocar JSX, atributos, clases, lógica ni interpolaciones):
      - Encabezado del calendario de 52 semanas (`<h2>`): `Tu avance del ano` → `Tu avance del año`
      - Aviso del bloque "Sube tu evidencia" (`<p>`): `...caras de ninas ni ninos.` → `...caras de niñas ni niños.`
      - Encabezado del estado sin reto (`<h1>`): `Todavia no hay reto` → `Todavía no hay reto`
      - Mensaje de `MascotBubble`: `...Yo te acompano.` → `...Yo te acompaño.`
    - No modificar interpolaciones (`${view.student.alias}`, número de semana), estilos, otras cadenas ni comentarios internos (fuera de alcance)
    - _Bug_Condition: isBugCondition(input) — cadena literal estática de StudentChallenge en {"Tu avance del ano", "...caras de ninas ni ninos.", "Todavia no hay reto", "...Yo te acompano."} escrita sin ñ/acentos_
    - _Expected_Behavior: expectedBehavior(result) — la cadena se renderiza con la ortografía española correcta ("Tu avance del año", "...caras de niñas ni niños.", "Todavía no hay reto", "...Yo te acompaño.")_
    - _Preservation: Preservation Requirements del diseño — resto de cadenas, lógica, valores dinámicos y flujo de carga/errores/API sin cambios_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 Verificar que la prueba de exploración de la condición del bug ahora pasa
    - **Property 1: Expected Behavior** - Ortografía española correcta en cadenas de interfaz
    - **IMPORTANTE**: Re-ejecutar la MISMA prueba de la tarea 1 — NO escribir una prueba nueva
    - La prueba de la tarea 1 codifica el comportamiento esperado; al pasar, confirma que la ortografía correcta se renderiza
    - Ejecutar la prueba de exploración del paso 1
    - **RESULTADO ESPERADO**: La prueba PASA (confirma que el bug está arreglado)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Verificar que las pruebas de preservación siguen pasando
    - **Property 2: Preservation** - Resto de la pantalla sin cambios
    - **IMPORTANTE**: Re-ejecutar las MISMAS pruebas de la tarea 2 — NO escribir pruebas nuevas
    - Ejecutar las pruebas de preservación del paso 2
    - **RESULTADO ESPERADO**: Las pruebas PASAN (confirma que no hay regresiones)
    - Confirmar que todas las pruebas siguen pasando tras el arreglo (sin regresiones)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Asegurar que todo pasa
  - Ejecutar `npm run lint` y `npm run build` y confirmar que ambos pasan (no hay suite de pruebas configurada en el proyecto)
  - Revisar el diff para confirmar que es mínimo: solo las cuatro cadenas corregidas, sin cambios de lógica, estilos ni interpolaciones
  - Asegurar que todas las verificaciones pasan; consultar al usuario si surgen dudas
