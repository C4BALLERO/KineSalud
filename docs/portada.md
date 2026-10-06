# Portada pública y video de marca

## Portada (`/`)

`kinesaludyvida.vercel.app` abre la presentación del consultorio; el personal entra con **Acceso del personal** (con sesión, el botón dice **Ir al sistema**).

- Código: `apps/web/src/features/landing/` (`LandingPage.tsx`, `landing.css`).
- Datos públicos en `content.ts`: dirección, celular, correo, Facebook, enlace de Google Maps, horario y textos de servicios. **El horario se copió de la configuración del sistema**: si cambia en Configuración, actualízalo aquí también.
- Secciones: portada con video, servicios, cómo trabajamos, sobre nosotros, ubicación (mapa de Google), contacto y botón flotante de WhatsApp con un mensaje ya escrito.
- Animaciones: titular palabra por palabra, bloques que aparecen al hacer scroll, cinta de especialidades, tarjetas que se elevan. Con "reducir movimiento", todo queda quieto y el video se reemplaza por su imagen fija.
- La CSP permite `https://www.google.com` en `frame-src` para el mapa (`firebase.json`).

## Video de marca (HyperFrames)

Fuente en `videos/kinesalud-hero/` (composición HTML + GSAP, 1080 × 1080, 10 s, en bucle). Las salidas no se versionan; la web usa las versiones optimizadas de `apps/web/public/media/` (MP4 236 KB, WebM 156 KB, imagen fija).

Para cambiarlo (requiere FFmpeg y el plugin de HyperFrames):

```bash
cd videos/kinesalud-hero
npx hyperframes check .
npx hyperframes render . -q high -o ./renders/video.mp4
ffmpeg -y -i renders/video.mp4 -vf scale=800:800:flags=lanczos -c:v libx264 -pix_fmt yuv420p -crf 26 -preset slow -movflags +faststart -an ../../apps/web/public/media/kinesalud-hero.mp4
ffmpeg -y -i renders/video.mp4 -vf scale=800:800:flags=lanczos -c:v libvpx-vp9 -crf 36 -b:v 0 -an ../../apps/web/public/media/kinesalud-hero.webm
ffmpeg -y -ss 3.3 -i renders/video.mp4 -frames:v 1 -vf scale=800:800 -q:v 4 ../../apps/web/public/media/kinesalud-hero-poster.jpg
```
