# CLAUDE.md

Guía rápida para Claude Code. El detalle está en `docs/` (índice en `docs/INDEX.md`).

## Proyecto

**Kinesalud y Vida**: sistema de gestión de un consultorio de fisioterapia, rehabilitación y estética en Cochabamba, Bolivia. Es un Proyecto de Grado. La UI y la documentación están en español (es-BO) y el código en inglés.

**Stack**: monorepo con npm workspaces.

- `apps/web`: React 19, Vite, TypeScript, Tailwind 4 (tokens), Radix, React Router 7, TanStack Query, RHF + zod.
- `functions`: Cloud Functions 2.ª gen. (Node 22, `southamerica-east1`), firebase-admin, empaquetado con esbuild.
- `packages/shared`: esquemas zod, enumeraciones, permisos y reglas de negocio puras. Lo usan la web y el servidor.

## Forma de trabajo

- Se trabaja **una fase por vez** (`docs/fases.md`). Cada fase se explica y se verifica (`npm run check`, reglas, build); luego se hace commit y push, y se **espera la aprobación** del usuario antes de seguir.
- Hablarle al usuario en español.
- El repositorio es **público**: nunca subir credenciales, `.env*` ni datos reales de pacientes.
- Desplegar (`npm run deploy`) solo con confirmación explícita. Ver `docs/despliegue.md`.

## Esenciales

@.claude/COMMON_MISTAKES.md
@.claude/QUICK_START.md
@.claude/ARCHITECTURE_MAP.md
