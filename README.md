# Kinesalud y Vida — Sistema de gestión

**Sistema inteligente de gestión de clientes, personal y seguimiento de tratamientos estéticos y de rehabilitación** para el consultorio de fisioterapia y estética _Kinesalud y Vida_ (Cochabamba, Bolivia).

Es un Proyecto de Grado de Ingeniería de Sistemas.

> **Versión 1:** usuarios y roles, clientes, personal, agenda y citas, tratamientos con seguimiento, recordatorios y reportes.
> El chatbot queda fuera de esta versión, aunque la arquitectura ya está preparada para incorporarlo ([ver integración](docs/integracion-chatbot.md)).

## Stack

| Capa           | Tecnología                                                              |
| -------------- | ----------------------------------------------------------------------- |
| Frontend       | React 19 · TypeScript · Vite · Tailwind CSS 4 · Radix UI · React Router |
| Backend        | Node.js 22 en Cloud Functions for Firebase (2.ª generación)             |
| Datos          | Cloud Firestore                                                         |
| Autenticación  | Firebase Authentication (roles mediante custom claims)                  |
| Notificaciones | Firebase Cloud Messaging                                                |
| Pruebas        | Vitest · Testing Library · Firebase Emulator Suite · Playwright         |

## Estructura

```
apps/web/          Aplicación React (SPA)
functions/         Backend Node.js (Cloud Functions)
packages/shared/   Tipos, enumeraciones, permisos y reglas de negocio compartidas
docs/              Documentación técnica del proyecto
```

## Inicio rápido

```bash
npm install
npm run dev          # http://localhost:5173
npm run check        # typecheck + lint + pruebas
```

La guía completa, con los emuladores y las variables de entorno, está en [docs/instalacion.md](docs/instalacion.md).

## Documentación

- [Arquitectura](docs/arquitectura.md)
- [Modelo de datos en Firestore](docs/firestore.md)
- [Roles y permisos](docs/roles-permisos.md)
- [Design System](docs/design-system.md)
- [Navegación, pantallas y flujos](docs/flujos.md)
- [Instalación, configuración y despliegue](docs/instalacion.md)
- [Despliegue gratuito sin tarjeta (Firebase Spark + Vercel)](docs/despliegue-gratuito.md), rama `despliegue-gratuito`
- [Preparación para el chatbot](docs/integracion-chatbot.md)
- [Decisiones de arquitectura (ADR)](docs/adr/)
- [Avance por fases](docs/fases.md)
