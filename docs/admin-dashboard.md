# Dashboard Administrativo

## Modulos implementados
- Home admin con KPIs.
- Cola de revision de evidencias.
- Gestion de experimentos (vista base para CRUD).
- Ranking con filtros basicos.
- Reportes con exportacion CSV y plantilla PDF.

## Endpoints
- `GET /api/admin/evidencias`
- `GET /api/admin/export?format=csv`
- `GET /api/admin/export?format=pdf`

## Siguiente integracion
1. Reemplazar datos mock por consultas Supabase.
2. Conectar acciones Aprobar/Rechazar a `submissions.status`.
3. Generar PDF real con `@react-pdf/renderer`.
