# Comandos

```bash
export PATH="/c/Program Files/Microsoft/jdk-21.0.12.101-hotspot/bin:$PATH"  # JDK para emuladores (Git Bash)

npm run emulators        # Auth, Firestore, Functions y Hosting locales (proyecto demo-kinesalud)
npm run seed             # datos de demostración (solo emuladores)
npm run dev              # web en http://localhost:5173 (o preview_start "web")

npm run check            # typecheck + lint + pruebas unitarias de los 3 paquetes
npm run test:rules       # Security Rules contra el emulador (con los emuladores apagados)
npm run test:integration # concurrencia de reservas contra el emulador
npm run format:check     # Prettier
npm run build            # shared + web + functions

npm run deploy           # producción (kinesalud-d9291): solo con confirmación
```
