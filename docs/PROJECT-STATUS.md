# Estatus del proyecto — Basura Cero en 52 Semanas

> Este archivo registra el estatus del proyecto y se actualiza **cada vez que se abre o
> cierra una sesión** de trabajo con Kiro. Mantenlo siempre al día: al iniciar sesión se
> anota el estado encontrado, y al cerrarla se anota lo que se avanzó y lo que queda
> pendiente.

## Resumen actual

- **Rama de trabajo:** `fix/scoring-ajustes-auditoria`
- **Rama principal:** `main`
- **Remoto:** `origin` → https://github.com/andres-santana/basura-cero.git
- **Último commit:** `8bdfa8f` — fix(scoring): participacion por tamano de grupo, retira
  badges sin soporte y limpia breakdown
- **Sincronización:** la rama está al día con `origin/fix/scoring-ajustes-auditoria`.
- **Árbol de trabajo:** hay archivos sin trackear pendientes (docs, scripts, `.kiro/`
  —incluidos el nuevo `.kiro/steering/`, `.kiro/hooks/` y `docs/PROJECT-STATUS.md`—).
  Revisar antes de commitear para no mezclar trabajo no relacionado.

## Pendientes / notas

- Definir qué archivos sin trackear deben entrar al control de versiones y cuáles no.
- Agregar al control de versiones (en una rama de trabajo) el steering, los hooks y este
  archivo de estatus, siguiendo el flujo de git acordado.
- Al terminar el trabajo de scoring, cerrar el ciclo con commit → push → PR hacia `main`.

## Registro de sesiones

### 2026-11-09 — Cierre
- Rama: `fix/scoring-ajustes-auditoria` (al día con `origin`, último commit `8bdfa8f`).
- Avances de la sesión:
  - Creado `docs/PROJECT-STATUS.md` con el estatus del proyecto y plantilla de registro.
  - Agregada la subsección "Preflight de git (antes de escribir código)" en
    `.kiro/steering/tech.md`.
  - Creados dos hooks en `.kiro/hooks/` (SessionStart y Stop) para mantener este archivo
    al día automáticamente.
- Pendientes: agregar steering, hooks y este archivo al control de versiones en una rama
  de trabajo, siguiendo el flujo de git acordado.

### 2026-11-09 — Apertura
- Estado al abrir: rama `fix/scoring-ajustes-auditoria`, al día con el remoto, con archivos
  sin trackear.
- Objetivo de la sesión: crear este archivo de estatus y agregar la regla de preflight de
  git al steering.

<!--
  Plantilla para nuevas entradas (copiar al inicio del registro, más reciente primero):

  ### AAAA-MM-DD — Apertura / Cierre
  - Rama: ...
  - Estado de git al abrir/cerrar: ...
  - Avances de la sesión: ...
  - Pendientes: ...
-->
