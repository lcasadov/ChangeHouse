import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { applyOrigins, cspOf, extendDirective, parseOrigin, withOrigins } from './hosting-csp.mjs';

const config = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'));

function directives(policy) {
  return Object.fromEntries(
    policy.split(';').map((part) => {
      const [name, ...sources] = part.trim().split(/\s+/);
      return [name, sources];
    }),
  );
}

const headersOf = (target) =>
  Object.fromEntries(
    config.hosting
      .find((site) => site.target === target)
      .headers.flatMap((rule) => rule.headers)
      .map((header) => [header.key, header.value]),
  );

for (const target of ['landing', 'app']) {
  test(`${target}: prohíbe la incrustación y los objetos`, () => {
    const headers = headersOf(target);
    assert.equal(headers['X-Frame-Options'], 'DENY');
    const csp = directives(headers['Content-Security-Policy']);
    assert.deepEqual(csp['frame-ancestors'], ["'none'"]);
    assert.deepEqual(csp['object-src'], ["'none'"]);
    assert.deepEqual(csp['base-uri'], ["'self'"]);
    assert.deepEqual(csp['default-src'], ["'self'"]);
  });

  test(`${target}: no permite scripts en línea ni de terceros`, () => {
    const csp = directives(headersOf(target)['Content-Security-Policy']);
    assert.deepEqual(csp['script-src'], ["'self'"]);
  });
}

test('la landing solo se conecta a sí misma hasta que se añade la API', () => {
  const csp = directives(cspOf(config, 'landing'));
  assert.deepEqual(csp['connect-src'], ["'self'"]);
});

test('la app permite Firebase, Storage y Places pero no comodines', () => {
  const policy = cspOf(config, 'app');
  const csp = directives(policy);
  for (const origin of [
    'https://identitytoolkit.googleapis.com',
    'https://securetoken.googleapis.com',
    'https://firestore.googleapis.com',
    'https://storage.googleapis.com',
  ]) {
    assert.ok(csp['connect-src'].includes(origin), origin);
  }
  assert.ok(csp['img-src'].includes('https://storage.googleapis.com'));
  assert.ok(!policy.includes('*'));
});

test('applyOrigins añade API y Sentry a la landing y a la app', () => {
  const result = applyOrigins(config, {
    API_ORIGIN: 'https://api.example.app',
    SENTRY_ORIGIN: 'https://o1.ingest.sentry.io',
    STORAGE_PUBLIC_ORIGIN: 'https://cdn.example.app',
  });
  const landing = directives(cspOf(result, 'landing'));
  assert.deepEqual(landing['connect-src'], [
    "'self'",
    'https://api.example.app',
    'https://o1.ingest.sentry.io',
  ]);
  const app = directives(cspOf(result, 'app'));
  assert.ok(app['connect-src'].includes('https://api.example.app'));
  assert.ok(app['connect-src'].includes('https://o1.ingest.sentry.io'));
  assert.ok(app['img-src'].includes('https://cdn.example.app'));
});

test('applyOrigins no modifica el original ni duplica orígenes', () => {
  const before = JSON.stringify(config);
  const once = applyOrigins(config, { API_ORIGIN: 'https://api.example.app' });
  const twice = applyOrigins(once, { API_ORIGIN: 'https://api.example.app' });
  assert.equal(JSON.stringify(config), before);
  assert.equal(cspOf(twice, 'app'), cspOf(once, 'app'));
});

test('rechaza orígenes que podrían inyectar directivas', () => {
  for (const bad of [
    'http://api.example.app',
    'https://api.example.app/v1',
    "https://a.example; script-src 'unsafe-eval'",
    'https://*.example.app',
    'not a url',
  ]) {
    assert.throws(() => parseOrigin('API_ORIGIN', bad), /API_ORIGIN/, bad);
  }
});

test('un origen vacío se ignora', () => {
  assert.equal(parseOrigin('SENTRY_ORIGIN', ''), undefined);
  assert.equal(parseOrigin('SENTRY_ORIGIN', undefined), undefined);
  const policy = "default-src 'self'; connect-src 'self'";
  assert.equal(withOrigins(policy, 'landing', { SENTRY_ORIGIN: '' }), policy);
});

test('extendDirective añade orígenes a una directiva existente', () => {
  const policy = "default-src 'self'; connect-src 'self'";
  assert.equal(
    extendDirective(policy, 'connect-src', ['http://localhost:9099']),
    "default-src 'self'; connect-src 'self' http://localhost:9099",
  );
});
