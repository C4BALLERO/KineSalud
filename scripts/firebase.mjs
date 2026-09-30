// Ejecuta la CLI de Firebase con un ajuste para Windows: el JDK 21 abre un
// canal interno con sockets Unix en la carpeta temporal y falla ("Unable to
// establish loopback connection") con algunas rutas de usuario. Se le indica
// una carpeta temporal simple dentro del proyecto.
//
// La CLI se invoca con Node directamente (sin shell) para conservar intactos
// los argumentos, p. ej. el comando entre comillas de `emulators:exec`.
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const env = { ...process.env };
if (process.platform === 'win32' && !env.JAVA_TOOL_OPTIONS?.includes('jdk.net.unixdomain.tmpdir')) {
  const dir = fileURLToPath(new URL('../.firebase/uds', import.meta.url));
  mkdirSync(dir, { recursive: true });
  env.JAVA_TOOL_OPTIONS =
    `${env.JAVA_TOOL_OPTIONS ?? ''} -Djdk.net.unixdomain.tmpdir=${dir}`.trim();
}
// El primer arranque en Windows puede superar los 10 s por defecto al cargar
// las Functions (antivirus escaneando node_modules); con 30 s a veces no alcanza.
env.FUNCTIONS_DISCOVERY_TIMEOUT ??= '60';

const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
const cli = join(globalRoot, 'firebase-tools', 'lib', 'bin', 'firebase.js');
if (!existsSync(cli)) {
  console.error('No se encontró la CLI de Firebase. Instálala con: npm i -g firebase-tools');
  process.exit(1);
}

const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 1));
