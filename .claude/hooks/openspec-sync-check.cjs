#!/usr/bin/env node
// Comprueba que PLAN.md y el gestor de trabajo reflejan el estado de los changes
// de OpenSpec. Dos modos:
//   sin argumentos → hook `Stop` del agente (lee el evento por stdin)
//   --ci           → comprobación de integración continua (código de salida)
// No escribe nada ni llama al gestor: solo comprueba. La sincronización la hace
// el agente siguiendo .claude/harness/openspec-extensions/.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CI = process.argv.includes('--ci');
const PLAN_START = '<!-- catalogo:generado:inicio -->';
const PLAN_END = '<!-- catalogo:generado:fin -->';
const CONFIG_MARK = 'Extensiones del catálogo';

function readStdin() {
  if (CI) return Promise.resolve({});
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
  });
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function repoRoot(start) {
  try { return git(start, ['rev-parse', '--show-toplevel']).trim(); } catch { return start; }
}

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}

// Lee `| `$NAME` | `valor` |` de docs/project.md. Devuelve null si falta o está pendiente.
function projectVar(root, name) {
  const text = readText(path.join(root, 'docs', 'project.md'));
  if (!text) return null;
  const re = new RegExp('\\|\\s*`\\$' + name + '`\\s*\\|\\s*`?([^`|\\n]+?)`?\\s*\\|');
  const m = text.match(re);
  if (!m) return null;
  const value = m[1].trim();
  return /PENDIENTE/i.test(value) ? null : value;
}

function countTasks(tasksText) {
  const lines = tasksText.split(/\r?\n/);
  const done = lines.filter((l) => /^\s*-\s*\[x\]/i.test(l)).length;
  const open = lines.filter((l) => /^\s*-\s*\[ \]/.test(l)).length;
  return { done, total: done + open };
}

function touchedChanges(root, osDir) {
  const out = git(root, ['status', '--porcelain', '-uall', '--', osDir]);
  const active = new Set();
  const archived = new Set();
  const prefix = osDir.replace(/\\/g, '/').replace(/\/$/, '') + '/changes/';
  for (const line of out.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let p = line.slice(3).trim().replace(/^"|"$/g, '');
    if (p.includes(' -> ')) p = p.split(' -> ')[1];
    if (!p.startsWith(prefix)) continue;
    const parts = p.slice(prefix.length).split('/');
    if (parts[0] === 'archive') { if (parts[1]) archived.add(parts[1]); }
    else if (parts[0]) active.add(parts[0]);
  }
  return { active: [...active], archived: [...archived] };
}

function listDirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch { return []; }
}

function mentions(line, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^\\w-])' + esc + '([^\\w-]|$)').test(line);
}

function checkChange(ctx, slug) {
  const dir = path.join(ctx.changesDir, slug);
  if (!fs.existsSync(dir)) return;
  const tasksText = readText(path.join(dir, 'tasks.md'));
  const { done, total } = tasksText ? countTasks(tasksText) : { done: 0, total: 0 };

  // PLAN.md: el change debe figurar en la zona derivada con su recuento real.
  if (ctx.planZone === null) {
    ctx.errors.push('PLAN.md no existe o no tiene la zona generada: ejecuta plan-sync.md.');
  } else {
    const row = ctx.planZone.split(/\r?\n/).find((l) => mentions(l, slug));
    if (!row) ctx.errors.push(`«${slug}» no aparece en PLAN.md: ejecuta plan-sync.md.`);
    else if (total > 0 && !row.includes(`${done}/${total}`)) {
      ctx.errors.push(`PLAN.md no refleja el avance de «${slug}» (real: ${done}/${total}): ejecuta plan-sync.md.`);
    }
  }

  if (!ctx.trackerEnabled) return;

  const proposal = readText(path.join(dir, 'proposal.md'));
  if (proposal !== null && !/^##\s+Trazabilidad\b/m.test(proposal)) {
    ctx.errors.push(`proposal.md de «${slug}» no tiene la sección «## Trazabilidad».`);
  }
  if (total === 0) return;

  const linksText = readText(path.join(dir, 'tracker-links.json'));
  if (linksText === null) {
    ctx.errors.push(`«${slug}» tiene tareas pero no tracker-links.json: ejecuta tracker-sync.md, «Al proponer un change».`);
    return;
  }
  let links;
  try { links = JSON.parse(linksText); } catch {
    ctx.errors.push(`tracker-links.json de «${slug}» no es JSON válido.`);
    return;
  }
  const pending = Array.isArray(links.pending) ? links.pending.length : 0;
  if (pending > 0) {
    const msg = `«${slug}» tiene ${pending} operación(es) pendiente(s) con el gestor: reintenta tracker-sync.md.`;
    (CI ? ctx.errors : ctx.warnings).push(msg);
    return; // Registrado aunque no sincronizado: el resto de huecos se explica por el pendiente.
  }
  // Genérico para cualquier jerarquía: no se exigen niveles por nombre (Epic,
  // Feature…), que no existen en todos los procesos. Se exige que cada tarea
  // esté en el gestor y colgada de algún padre.
  const tasks = Array.isArray(links.tasks) ? links.tasks.filter((t) => t && t.id > 0) : [];
  if (tasks.length < total) {
    ctx.errors.push(`«${slug}» tiene ${total} tareas y solo ${tasks.length} en el gestor: ejecuta tracker-sync.md.`);
  }
  const orphans = tasks.filter((t) => !(t.parent > 0)).map((t) => t.key || t.id);
  if (orphans.length > 0) {
    ctx.errors.push(`Tareas de «${slug}» sin padre en tracker-links.json (${orphans.join(', ')}): aplica la regla de colgado de tracker-sync.md.`);
  }
}

function report(ctx, stopHookActive) {
  if (CI) {
    for (const w of ctx.warnings) console.log(`AVISO  ${w}`);
    for (const e of ctx.errors) console.log(`ERROR  ${e}`);
    if (ctx.errors.length === 0) console.log('OK  plan y gestor de trabajo al día.');
    process.exitCode = ctx.errors.length > 0 ? 1 : 0;
    return;
  }
  const lines = [...ctx.errors, ...ctx.warnings];
  if (lines.length === 0) return;
  // Bloquea una sola vez: si el agente ya continuó por este hook, solo avisa.
  // Evita un bucle cuando el gestor no responde.
  if (ctx.errors.length > 0 && !stopHookActive) {
    // Formato de Claude Code para los hooks Stop: decision/reason en el nivel superior.
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: 'Sincronización de OpenSpec incompleta. Corrige antes de terminar:\n- ' + lines.join('\n- '),
    }));
    return;
  }
  process.stdout.write(JSON.stringify({
    systemMessage: 'OpenSpec: sincronización incompleta.\n- ' + lines.join('\n- '),
  }));
}

async function main() {
  const event = await readStdin();
  const root = repoRoot(event.cwd || process.cwd());
  const osDir = (projectVar(root, 'OPENSPEC_PATH') || 'openspec').replace(/[\\/]+$/, '');
  const osAbs = path.join(root, osDir);
  if (!fs.existsSync(osAbs)) return; // Sin OpenSpec no hay nada que comprobar.

  const tracker = projectVar(root, 'TRACKER');
  const planText = readText(path.join(osAbs, 'PLAN.md'));
  let planZone = null;
  if (planText) {
    const a = planText.indexOf(PLAN_START);
    const b = planText.indexOf(PLAN_END);
    if (a >= 0 && b > a) planZone = planText.slice(a, b);
  }

  const ctx = {
    changesDir: path.join(osAbs, 'changes'),
    planZone,
    trackerEnabled: !!tracker && tracker.toLowerCase() !== 'ninguno',
    errors: [],
    warnings: [],
  };
  if (!tracker) ctx.warnings.push('$TRACKER no está resuelto en docs/project.md: no se comprueba el gestor.');

  const config = readText(path.join(osAbs, 'config.yaml'));
  if (!config || !config.includes(CONFIG_MARK)) {
    const msg = `${osDir}/config.yaml no contiene las extensiones del catálogo: cópialas de .claude/harness/openspec-extensions/config.yaml.`;
    (CI ? ctx.errors : ctx.warnings).push(msg);
  }

  let active;
  let archived = [];
  if (CI) {
    active = listDirs(ctx.changesDir).filter((d) => d !== 'archive');
  } else {
    try { ({ active, archived } = touchedChanges(root, osDir)); }
    catch { active = listDirs(ctx.changesDir).filter((d) => d !== 'archive'); }
    if (active.length === 0 && archived.length === 0) return; // Esta sesión no tocó ningún change.
  }

  for (const slug of active) checkChange(ctx, slug);
  for (const name of archived) {
    if (ctx.planZone !== null && !mentions(ctx.planZone, name)) {
      ctx.errors.push(`El change archivado «${name}» no figura en PLAN.md: ejecuta plan-sync.md.`);
    }
  }

  report(ctx, event.stop_hook_active === true);
}

// Otros hooks del catálogo reutilizan estas utilidades.
module.exports = { readStdin, git, repoRoot, readText, projectVar };

if (require.main === module) {
  main().catch((err) => {
    // Un fallo del propio hook nunca debe bloquear al agente.
    if (CI) { console.error(err); process.exitCode = 2; }
    else process.stdout.write(JSON.stringify({ systemMessage: `openspec-sync-check falló: ${err.message}` }));
  });
}
