// Generador de escenas de prueba (change refresh-visual-design).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import sharp from 'sharp';

import { PALETTES, sceneJpeg, SCENES, sceneSvg, TIMES } from './media/scenes.mjs';

test('cada escena produce un JPEG del tamaño pedido', async () => {
  for (const scene of SCENES) {
    const jpeg = await sceneJpeg(scene, { width: 320, height: 400 });
    const meta = await sharp(jpeg).metadata();
    assert.equal(meta.format, 'jpeg', scene);
    assert.equal(meta.width, 320, scene);
    assert.equal(meta.height, 400, scene);
  }
});

test('la misma semilla produce los mismos bytes', async () => {
  const options = { seed: 7, time: 'atardecer', palette: 'salvia', width: 240, height: 180 };
  const first = await sceneJpeg('salon', options);
  const second = await sceneJpeg('salon', options);
  assert.ok(first.equals(second));
});

test('semillas, horas y paletas distintas producen imágenes distintas', () => {
  const base = sceneSvg('mediterranea', { seed: 1 });
  assert.notEqual(sceneSvg('mediterranea', { seed: 2 }), base);
  assert.notEqual(sceneSvg('mediterranea', { seed: 1, time: 'noche' }), base);
  assert.notEqual(sceneSvg('mediterranea', { seed: 1, palette: 'azul' }), base);
});

test('todas las horas y paletas declaradas son válidas', () => {
  for (const time of TIMES)
    for (const palette of Object.keys(PALETTES))
      assert.match(sceneSvg('cocina', { time, palette }), /^<svg /);
});

test('rechaza escenas, horas y paletas desconocidas', () => {
  assert.throws(() => sceneSvg('castillo'), /Escena desconocida/);
  assert.throws(() => sceneSvg('salon', { time: 'mediodia' }), /Hora desconocida/);
  assert.throws(() => sceneSvg('salon', { palette: 'fucsia' }), /Paleta desconocida/);
});
