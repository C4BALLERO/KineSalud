// Empaqueta las Functions en lib/index.js. El código de @kinesalud/shared se
// incluye dentro del bundle; las dependencias de npm quedan externas y Cloud
// Functions las instala a partir de package.json durante el despliegue.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: Object.keys(pkg.dependencies ?? {}),
  logLevel: 'info',
});
