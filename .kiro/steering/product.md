# Product

**Basura Cero en 52 Semanas** is a school-focused web platform for running a year-long
ecological program: 52 weekly experiments ("retos") that student groups complete,
document with evidence, and get scored on for an environmental-impact competition.

## Who uses it (roles)
- **admin**: manages experiments, weekly challenges, users (teachers/groups/jury),
  reviews submitted evidence, and exports reports.
- **teacher** (`maestro`): manages their groups, views the current challenge, and
  submits evidence on behalf of groups.
- **group**: the participating student team whose submissions are scored.
- **jury** (`jurado`): reviews/ranks entries.

## Core concepts
- **Experiment**: a weekly activity template (objective, instructions, materials,
  video, curious fact, conclusion; status draft/published/archived).
- **Weekly challenge**: an experiment scheduled for a date range.
- **Submission (evidencia)**: a group's response to a challenge, with uploaded files,
  self-reported impact metrics, and a status (draft/submitted/approved/rejected).
- **Impact metrics**: kg separated, reused items, waste-reduced estimate.
- **Scoring & badges**: submissions earn points and unlock badges, feeding a gamified
  leaderboard/ranking and progress toward the full 52 weeks.

## Notes
- Domain language is **Spanish** (semanas, evidencias, experimentos, grupos, jurado,
  maestros). UI copy and user-facing strings are Spanish; keep them consistent.
- Data is scoped per **school** (`school_id`); admin actions filter by the admin's school.
