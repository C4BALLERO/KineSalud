# Portada pública y video de marca

## Portada (`/`)

`kinesaludyvida.vercel.app` abre la presentación del consultorio; el personal entra con **Acceso del personal** (con sesión, el botón dice **Ir al sistema**).

- Código: `apps/web/src/features/landing/` (`LandingPage.tsx`, `landing.css`).
- Datos públicos en `content.ts`: dirección, celular, correo, Facebook, enlace de Google Maps, horario y textos de servicios. **El horario se copió de la configuración del sistema**: si cambia en Configuración, actualízalo aquí también.
- Secciones: portada con video, servicios, cómo trabajamos, sobre nosotros, ubicación (mapa de Google), contacto y botón flotante de WhatsApp con un mensaje ya escrito.
- Estética: la del video de marca en toda la página (verde azulado profundo `#0B2F31`, luces difusas que derivan, textos menta `#C9F1E0` y salvia `#84C3A6`, tarjetas de vidrio y etiquetas claras). Igual en modo claro y oscuro: `landing.css` redefine los tokens solo dentro de `.lp`. Contraste del texto sobre el fondo y el vidrio: principal 9,9:1 o más, secundario 6,9:1, salvia 5,1:1; botón salvia con texto oscuro 8,2:1.
- Animaciones: titular palabra por palabra, bloques que aparecen al hacer scroll, cinta de especialidades, tarjetas que se elevan. Con "reducir movimiento", todo queda quieto y el video se reemplaza por su imagen fija.
- La CSP permite `https://www.google.com` en `frame-src` para el mapa (`firebase.json`).

## Videos (HyperFrames)

- **Fondo de ambiente** (`videos/kinesalud-ambient`, 1280 × 720, 12 s en bucle exacto): auroras, ondas de movimiento con destellos y partículas en la paleta de marca. Va a pantalla completa y translúcido en la portada (con un velo hacia el texto, acercamiento lento y paralaje al hacer scroll) y detrás de "Cómo trabajamos" y "Contacto". En la web: `kinesalud-ambient.webm` (206 KB) y `.mp4` (507 KB).
- **Video de marca** (`videos/kinesalud-hero`): el recuadro con el logo, junto al titular.
- **Artlist:** el conector está configurado, pero sus modelos de video con IA requieren una suscripción de pago (la cuenta actual es de prueba). Con suscripción, un video realista de fisioterapia puede reemplazar el fondo de ambiente: misma ruta en `/media`, mismo nombre.

### Video de marca

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
