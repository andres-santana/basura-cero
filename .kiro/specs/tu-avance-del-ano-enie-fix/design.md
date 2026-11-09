# Tu Avance del Año — Corrección de ñ/acentos (Bugfix Design)

## Overview

En la ruta del alumno `/alumno/reto` varias cadenas de interfaz en español están
escritas en el código fuente sin la letra **ñ** ni los acentos correspondientes. La
investigación (confirmada en los requisitos) descarta un problema de codificación o de
renderizado: el archivo `src/components/students/student-challenge.tsx` se guarda en
UTF-8 válido, pero las cadenas literales fueron escritas con ortografía incorrecta
(`ano`, `ninas`, `ninos`, `acompano`, `Todavia`).

La estrategia de arreglo es mínima y acotada: corregir únicamente las cuatro cadenas
literales afectadas dentro de ese componente, dejando intacta toda la lógica, los
valores dinámicos y el resto de las cadenas. No hay cambios de comportamiento, de API,
de datos ni de estilos; es una corrección puramente ortográfica en texto estático.

## Glossary

- **Bug_Condition (C)**: La condición que dispara el defecto — que una cadena literal
  de interfaz en `student-challenge.tsx` esté escrita sin la **ñ** o el acento que exige
  la ortografía española correcta, para una de las cuatro cadenas identificadas.
- **Property (P)**: El comportamiento deseado — que esas cadenas se rendericen con la
  ortografía correcta (`año`, `niñas`, `niños`, `acompaño`, `Todavía`).
- **Preservation**: Todo lo que no debe cambiar — el resto de las cadenas, la lógica de
  interacción (pasos, minijuego, XP, salir), los valores dinámicos y el flujo de
  carga/errores/peticiones a la API.
- **StudentChallenge**: El componente cliente en
  `src/components/students/student-challenge.tsx` que se renderiza en la ruta
  `/alumno/reto` y contiene las cadenas afectadas.
- **Cadena literal de interfaz**: Texto estático escrito directamente en el JSX del
  componente (no proveniente de datos, props ni API).

## Bug Details

### Bug Condition

El bug se manifiesta cuando `StudentChallenge` renderiza una de las cuatro cadenas
literales de interfaz identificadas. El texto escrito en el código fuente omite la
**ñ** o el acento requerido, por lo que el alumno ve la cadena mal escrita
ortográficamente. No depende de ninguna entrada en tiempo de ejecución: el defecto está
fijo en el texto fuente.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type RenderedUIString  // una cadena literal de interfaz de StudentChallenge
  OUTPUT: boolean

  RETURN input.isStaticLiteral = TRUE
         AND input.sourceText IN {
               "Tu avance del ano",
               "...caras de ninas ni ninos.",
               "Todavia no hay reto",
               "...Yo te acompano."
             }
         AND input.sourceText != correctSpanishSpelling(input.sourceText)
END FUNCTION
```

### Examples

- **Avance anual**: se muestra "Tu avance del ano"; se espera "Tu avance del año".
- **Subir evidencia**: se muestra "...caras de ninas ni ninos."; se espera
  "...caras de niñas ni niños.".
- **Sin reto asignado**: se muestra el encabezado "Todavia no hay reto"; se espera
  "Todavía no hay reto".
- **Mensaje de la mascota**: se muestra "...Yo te acompano."; se espera
  "...Yo te acompaño.".
- **Caso borde (no es bug)**: cadenas ya correctas como "Sube tu evidencia", "Tus
  pasos" o "Subir mi foto" no cumplen la condición y no deben tocarse.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Las cadenas de interfaz ya correctas (p. ej. "Sube tu evidencia", "Tus pasos",
  "Subir mi foto", "Salir", "Cargando tu reto...") deben permanecer sin cambios.
- La lógica de interacción debe comportarse exactamente igual: marcar/desmarcar pasos
  (`toggleStep`), el minijuego (`completeGame`), la barra de XP (`XpBar`) y el botón de
  salir (`logout`).
- Los valores dinámicos deben mostrarse tal como provienen de los datos: título del
  reto, objetivo, alias del alumno, número de semana y el calendario de 52 semanas.
- El flujo de carga, el manejo de errores y las peticiones a la API deben seguir
  funcionando sin cambios de comportamiento.

**Scope:**
Todas las entradas y comportamientos que NO correspondan a las cuatro cadenas literales
identificadas deben quedar completamente inalterados por este arreglo. Esto incluye:
- Cualquier otra cadena de interfaz del componente.
- Toda la lógica de estado, callbacks y efectos (`load`, `toggleStep`, `completeGame`,
  `logout`, `useEffect`).
- Todos los valores dinámicos derivados de datos o props (incluidas interpolaciones como
  el alias del alumno y el número de semana).

> **Nota:** El comportamiento correcto esperado para las cadenas afectadas se define en
> la sección *Correctness Properties* (Property 1). Esta sección se enfoca en lo que NO
> debe cambiar.

## Hypothesized Root Cause

La causa raíz ya está confirmada en los requisitos, pero se categoriza para claridad:

1. **Defecto literal en las cadenas de origen**: las cadenas se escribieron sin la
   **ñ** ni los acentos en el JSX de `student-challenge.tsx` (`ano`, `ninas`, `ninos`,
   `acompano`, `Todavia`). Es la causa real.

2. **Descartado — problema de codificación**: el archivo se guarda en UTF-8 válido, por
   lo que no es corrupción de bytes ni mala interpretación del charset.

3. **Descartado — problema de renderizado**: no hay transformación en tiempo de
   ejecución que elimine la **ñ** o los acentos; otras cadenas del mismo archivo sí los
   muestran correctamente.

4. **Descartado — datos/props**: las cadenas afectadas son literales estáticas, no
   provienen de la base de datos ni de props dinámicas.

## Correctness Properties

Property 1: Bug Condition - Ortografía española correcta en cadenas de interfaz

_For any_ cadena literal de interfaz de `StudentChallenge` donde la condición del bug se
cumple (isBugCondition retorna true), el componente corregido SHALL renderizar la cadena
con la ortografía española correcta: "Tu avance del año", "...caras de niñas ni niños.",
"Todavía no hay reto" y "...Yo te acompaño." respectivamente, incluyendo la **ñ** y los
acentos requeridos.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Resto de la pantalla sin cambios

_For any_ entrada o cadena donde la condición del bug NO se cumple (isBugCondition
retorna false) — otras cadenas de interfaz, lógica de interacción, valores dinámicos y
flujo de carga/errores/API —, el componente corregido SHALL producir exactamente el
mismo resultado y comportamiento que el componente original, preservando toda la
funcionalidad existente de `/alumno/reto`.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Dado que la causa raíz está confirmada, el arreglo consiste en reemplazar el texto de
las cuatro cadenas literales afectadas por su versión correctamente acentuada. No se
modifica ninguna estructura JSX, atributo, clase, lógica ni interpolación dinámica.

**File**: `src/components/students/student-challenge.tsx`

**Function/Component**: `StudentChallenge`

**Specific Changes**:
1. **Encabezado de avance anual**: cambiar `Tu avance del ano` por
   `Tu avance del año` (en el `<h2>` de la sección del calendario de 52 semanas).

2. **Aviso de evidencia**: cambiar `...caras de ninas ni ninos.` por
   `...caras de niñas ni niños.` (en el `<p>` del bloque "Sube tu evidencia").

3. **Encabezado sin reto**: cambiar `Todavia no hay reto` por
   `Todavía no hay reto` (en el `<h1>` del estado sin reto asignado).

4. **Mensaje de la mascota**: cambiar `...Yo te acompano.` por
   `...Yo te acompaño.` (en el `message` de `MascotBubble`).

5. **Sin cambios adicionales**: no se tocan interpolaciones (`${view.student.alias}`,
   número de semana), la lógica, los estilos ni ninguna otra cadena. El resto de
   comentarios internos sin acentos (p. ej. en el cálculo de XP) quedan fuera del
   alcance porque no son texto visible para el usuario.

## Testing Strategy

### Validation Approach

La estrategia sigue un enfoque de dos fases: primero, exponer contraejemplos que
demuestren el defecto en el código sin corregir; luego, verificar que el arreglo
produce la ortografía correcta y que preserva todo el comportamiento existente. Al ser
un cambio de texto estático, la verificación se apoya en pruebas de renderizado de las
cadenas y en la validación estándar del proyecto (`npm run lint` y `npm run build`),
dado que no hay suite de pruebas configurada.

### Exploratory Bug Condition Checking

**Goal**: Exponer contraejemplos que demuestren el bug ANTES de implementar el arreglo
y confirmar (o refutar) la causa raíz. Si se refuta, habría que re-hipotetizar.

**Test Plan**: Renderizar `StudentChallenge` en los escenarios relevantes (con reto
asignado y sin reto asignado) y aseverar que el DOM contiene la ortografía correcta.
Ejecutar estas aserciones sobre el código SIN corregir para observar las fallas y
confirmar que las cadenas aparecen sin la **ñ**/acentos.

**Test Cases**:
1. **Avance anual**: renderizar con `calendarWeeks` presente y aseverar el texto
   "Tu avance del año" (fallará en el código sin corregir).
2. **Subir evidencia**: renderizar con reto asignado y aseverar "...caras de niñas ni
   niños." (fallará en el código sin corregir).
3. **Sin reto asignado**: renderizar con `challenge = null` y aseverar el encabezado
   "Todavía no hay reto" (fallará en el código sin corregir).
4. **Mensaje de la mascota**: renderizar con reto asignado y aseverar que el mensaje
   contiene "Yo te acompaño." (fallará en el código sin corregir).

**Expected Counterexamples**:
- El DOM contiene "Tu avance del ano", "ninas ni ninos", "Todavia no hay reto" y
  "Yo te acompano" en lugar de las versiones acentuadas.
- Causa confirmada: defecto literal en las cadenas de origen (no codificación ni
  renderizado).

### Fix Checking

**Goal**: Verificar que para todas las entradas donde se cumple la condición del bug, el
componente corregido produce el comportamiento esperado (ortografía correcta).

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := StudentChallenge_fixed(input)
  ASSERT expectedBehavior(result)  // la cadena renderizada usa la ortografía correcta (ñ/acentos)
END FOR
```

### Preservation Checking

**Goal**: Verificar que para todas las entradas donde NO se cumple la condición del bug,
el componente corregido produce el mismo resultado que el original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT StudentChallenge_original(input) = StudentChallenge_fixed(input)
END FOR
```

**Testing Approach**: Las pruebas basadas en propiedades son útiles para la verificación
de preservación porque:
- Generan muchos casos automáticamente a lo largo del dominio de entrada.
- Capturan casos borde que las pruebas unitarias manuales podrían pasar por alto.
- Dan garantías fuertes de que el comportamiento no cambia para las entradas no
  afectadas.

Para este bugfix, dado que el cambio es exclusivamente de texto estático y no hay suite
configurada, la preservación se asegura sobre todo revisando que ninguna otra cadena,
interpolación o rama de lógica se haya modificado (diff mínimo) y que `npm run lint` y
`npm run build` pasen.

**Test Plan**: Observar el comportamiento en el código SIN corregir para las cadenas ya
correctas, los valores dinámicos y las interacciones; luego verificar que siguen
idénticos tras el arreglo.

**Test Cases**:
1. **Cadenas ya correctas**: observar que "Sube tu evidencia", "Tus pasos" y "Subir mi
   foto" se muestran correctamente antes del arreglo; verificar que siguen igual después.
2. **Valores dinámicos**: observar que el alias del alumno, el número de semana, el
   título/objetivo del reto y el calendario de 52 semanas se renderizan desde datos;
   verificar que no cambian tras el arreglo.
3. **Interacciones**: observar que marcar pasos, el minijuego, la barra de XP y el botón
   de salir funcionan antes del arreglo; verificar que su comportamiento es idéntico
   después.

### Unit Tests

- Verificar que, con reto asignado, el DOM contiene "Tu avance del año", "...caras de
  niñas ni niños." y el mensaje "...Yo te acompaño." de la mascota.
- Verificar que, sin reto asignado, el DOM contiene el encabezado "Todavía no hay reto".
- Verificar que las cadenas ya correctas y los valores dinámicos (alias, número de
  semana) permanecen sin cambios.

### Property-Based Tests

- Generar distintos `view` (variando alias, número de semana, títulos y objetivos) y
  verificar que las cuatro cadenas estáticas siempre aparecen con la ortografía correcta
  y que las interpolaciones dinámicas se mantienen intactas.
- Generar estados con y sin reto asignado para verificar que el encabezado correcto se
  muestra en cada rama sin alterar el resto de la pantalla.

### Integration Tests

- Flujo completo en `/alumno/reto` con reto asignado: cargar la pantalla y confirmar que
  todas las cadenas corregidas se muestran bien junto con los datos dinámicos.
- Flujo sin reto asignado: confirmar el encabezado "Todavía no hay reto" y que el botón
  "Salir" sigue funcionando.
- Confirmar que la navegación a "Subir mi foto" y las interacciones con pasos/minijuego
  no se ven afectadas por el cambio de texto.
