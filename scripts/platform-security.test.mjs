// Comprobaciones estáticas de los workflows y del script de infraestructura (change harden-security-before-launch).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const workflows = readdirSync(new URL('.github/workflows/', root)).map((name) => ({
  name,
  text: read(`.github/workflows/${name}`),
}));
const deploy = read('.github/workflows/deploy.yml');

/** Cuerpos de todos los bloques `run:` de un workflow. */
function runBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const match = /^(\s*)(?:- )?run:\s*(.*)$/.exec(lines[i]);
    if (!match) continue;
    const indent = match[1].length;
    let body = match[2];
    if (/^[|>][-+]?$/.test(body)) {
      body = '';
      while (
        i + 1 < lines.length &&
        (lines[i + 1].trim() === '' || /^\s*/.exec(lines[i + 1])[0].length > indent)
      ) {
        body += `${lines[++i]}\n`;
      }
    }
    blocks.push(body);
  }
  return blocks;
}

test('ningún run: interpola datos de entrada (inputs ni github.event)', () => {
  for (const { name, text } of workflows) {
    for (const block of runBlocks(text)) {
      assert.doesNotMatch(block, /\$\{\{\s*(inputs|github\.event|github\.head_ref)/, name);
    }
  }
});

test('todas las acciones de terceros están fijadas por SHA', () => {
  for (const { name, text } of workflows) {
    for (const [, ref] of text.matchAll(/^\s*(?:- )?uses:\s*(\S+)/gm)) {
      if (ref.startsWith('./')) continue;
      assert.match(ref, /@[0-9a-f]{40}$/, `${name}: ${ref}`);
    }
  }
  const composite = read('.github/actions/setup/action.yml');
  for (const [, ref] of composite.matchAll(/uses:\s*(\S+)/g)) {
    assert.match(ref, /@[0-9a-f]{40}$/, ref);
  }
});

test('la promoción a PROD valida el digest con el formato y el registro esperados', () => {
  const [, pattern] = /pattern='([^']+)'/.exec(deploy);
  const digest = `europe-southwest1-docker.pkg.dev/changehouse-des/changehouse/api@sha256:${'a'.repeat(64)}`;
  const regex = new RegExp(pattern);
  assert.match(digest, regex);
  for (const bad of [
    `${digest}$(id)`,
    `${digest}; curl evil`,
    `${digest}\nmás`,
    `europe-west1-docker.pkg.dev/p/changehouse/api@sha256:${'a'.repeat(64)}`,
    `europe-southwest1-docker.pkg.dev/p/otro/api@sha256:${'a'.repeat(64)}`,
    `europe-southwest1-docker.pkg.dev/p/changehouse/api@sha256:${'A'.repeat(64)}`,
    `europe-southwest1-docker.pkg.dev/p/changehouse/api:latest`,
    `europe-southwest1-docker.pkg.dev/p/changehouse/api@sha256:${'a'.repeat(63)}`,
  ]) {
    assert.doesNotMatch(bad, regex, bad);
  }
  assert.match(deploy, /IMAGE_DIGEST: \$\{\{ inputs\.image_digest \}\}/);
});

test('el job de PROD solo corre desde master y despliega las reglas', () => {
  const prod = deploy.slice(deploy.indexOf('\n  prod:'));
  assert.match(prod, /github\.ref == 'refs\/heads\/master'/);
  assert.match(prod, /firebase deploy --only firestore:rules,storage/);
  assert.ok(prod.indexOf('Validar la imagen') < prod.indexOf('google-github-actions/auth'));
});

test('bootstrap.sh: lectura pública sin listado y ciclo de vida de un día', () => {
  const script = read('infra/gcp/bootstrap.sh');
  const code = script
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
  assert.match(code, /--member=allUsers --role=roles\/storage\.legacyObjectReader/);
  assert.doesNotMatch(code, /objectViewer/);
  assert.doesNotMatch(code, /roles\/storage\.objectAdmin" --condition/);
  assert.match(code, /"age": 1/);
  assert.match(code, /"matchesPrefix": \["originals\/", "chat-uploads\/"\]/);
  assert.match(code, /--public-access-prevention/);
});

test('.dockerignore excluye secretos y el historial', () => {
  const lines = read('.dockerignore')
    .split('\n')
    .map((line) => line.trim());
  for (const pattern of ['**/.env*', '**/*.pem', '**/*-key.json', '.git']) {
    assert.ok(lines.includes(pattern), pattern);
  }
});
