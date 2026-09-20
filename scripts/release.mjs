#!/usr/bin/env node
/**
 * Release del producto: sube la versión en los DOS repos, commitea y etiqueta.
 *
 * La versión es una sola para todo el producto —API y app— porque al cliente
 * se le dice "estás en la 1.0.5", no "el front en 1.2.0 y la API en 1.0.4".
 * Los dos se despliegan juntos, así que versionarlos por separado solo
 * agregaría dos números que nadie sabe cómo leer.
 *
 * NO hace push. Nada sale a producción sin que alguien lo mande a mano.
 *
 * Uso:
 *   node scripts/release.mjs patch    # 1.0.4 -> 1.0.5  (correcciones)
 *   node scripts/release.mjs minor    # 1.0.4 -> 1.1.0  (funcionalidad nueva)
 *   node scripts/release.mjs major    # 1.0.4 -> 2.0.0  (rompe compatibilidad)
 *   node scripts/release.mjs 1.2.3    # una versión exacta
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_BACK = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ_FRONT = resolve(RAIZ_BACK, '..', 'control-produccion');

const REPOS = [
  { nombre: 'API', ruta: RAIZ_BACK },
  { nombre: 'App', ruta: RAIZ_FRONT },
];

const rojo = (t) => `\x1b[31m${t}\x1b[0m`;
const verde = (t) => `\x1b[32m${t}\x1b[0m`;
const gris = (t) => `\x1b[90m${t}\x1b[0m`;
const negrita = (t) => `\x1b[1m${t}\x1b[0m`;

const git = (ruta, args) =>
  execFileSync('git', args, { cwd: ruta, encoding: 'utf8' }).trim();

const morir = (msg) => {
  console.error('\n' + rojo('✖ ' + msg) + '\n');
  process.exit(1);
};

const leerPkg = (ruta) => {
  const p = join(ruta, 'package.json');
  return { p, json: JSON.parse(readFileSync(p, 'utf8')) };
};

/** Sube la versión respetando el formato del archivo (indentación, salto final). */
function escribirVersion(ruta, nueva) {
  const { p } = leerPkg(ruta);
  const crudo = readFileSync(p, 'utf8');
  const actualizado = crudo.replace(
    /("version"\s*:\s*")[^"]+(")/,
    `$1${nueva}$2`,
  );
  if (crudo === actualizado) morir(`No pude cambiar la versión en ${p}`);
  writeFileSync(p, actualizado);
}

function siguiente(actual, tipo) {
  if (/^\d+\.\d+\.\d+$/.test(tipo)) return tipo;
  const [may, min, par] = actual.split('.').map(Number);
  if (tipo === 'major') return `${may + 1}.0.0`;
  if (tipo === 'minor') return `${may}.${min + 1}.0`;
  if (tipo === 'patch') return `${may}.${min}.${par + 1}`;
  morir(`Tipo desconocido: "${tipo}". Usá patch, minor, major o una versión exacta.`);
}

// ─── Validaciones antes de tocar nada ──────────────────────────────────────
const tipo = process.argv[2];
if (!tipo) {
  morir('Falta el tipo. Ej: node scripts/release.mjs patch');
}

for (const r of REPOS) {
  if (!existsSync(join(r.ruta, 'package.json'))) {
    morir(`No encuentro el repo de ${r.nombre} en ${r.ruta}`);
  }
  // Un release sobre cambios a medio terminar deja un tag que no corresponde
  // a nada reproducible.
  if (git(r.ruta, ['status', '--porcelain'])) {
    morir(
      `${r.nombre} tiene cambios sin commitear (${r.ruta}).\n` +
        '  Commiteá o descartá antes de hacer el release.',
    );
  }
}

const versiones = REPOS.map((r) => leerPkg(r.ruta).json.version);
if (new Set(versiones).size > 1) {
  console.warn(
    rojo('⚠ Los repos están en versiones distintas: ') +
      REPOS.map((r, i) => `${r.nombre}=${versiones[i]}`).join(', ') +
      '\n  Se toma la más alta como base.',
  );
}
const actual = versiones.sort((a, b) =>
  a.localeCompare(b, undefined, { numeric: true }),
).pop();

const nueva = siguiente(actual, tipo);
const tag = `v${nueva}`;

for (const r of REPOS) {
  if (git(r.ruta, ['tag', '-l', tag])) {
    morir(`El tag ${tag} ya existe en ${r.nombre}. ¿Ya hiciste este release?`);
  }
}

// ─── Aplicar ───────────────────────────────────────────────────────────────
console.log(`\n${negrita('Release')} ${actual} → ${negrita(verde(nueva))}\n`);

for (const r of REPOS) {
  escribirVersion(r.ruta, nueva);
  git(r.ruta, ['add', 'package.json']);
  git(r.ruta, ['commit', '-m', `chore(release): ${tag}`]);
  git(r.ruta, ['tag', '-a', tag, '-m', `Release ${tag}`]);
  const rama = git(r.ruta, ['rev-parse', '--abbrev-ref', 'HEAD']);
  console.log(`  ${verde('✓')} ${r.nombre.padEnd(4)} ${tag} · commit y tag en ${rama}`);
}

// ─── Qué sigue ─────────────────────────────────────────────────────────────
console.log(`
${negrita('Falta desplegar. En ESTE orden:')}

  ${negrita('1.')} Migraciones, si esta entrega trae alguna
     ${gris('DATABASE_URL="<url-directa-de-neon-SIN-pooler>" pnpm migration:run:prod')}

  ${negrita('2.')} API primero, y esperar a que esté viva
     ${gris(`cd ${RAIZ_BACK}`)}
     ${gris(`git push origin HEAD --follow-tags`)}
     ${gris('# Render no tiene auto-deploy: Manual Deploy → Deploy latest commit')}
     ${gris('# verificá: curl <api>/api/v1/health  →  debe responder "version":"' + nueva + '"')}

  ${negrita('3.')} Recién ahí la app
     ${gris(`cd ${RAIZ_FRONT}`)}
     ${gris(`git push origin HEAD --follow-tags`)}

${rojo('El orden no es un detalle:')} si la app sale primero le pide a la API
endpoints que todavía no existen, y la pantalla entera queda inutilizable.
Pasó el 23-08-2026.
`);
