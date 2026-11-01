// Genera las imágenes de ambiente de la landing y la app y el vídeo de fondo del héroe a partir de
// las escenas de `scenes.mjs`. Los resultados se versionan: solo hace falta ejecutarlo al cambiar
// una escena. Uso: `pnpm media:generate` (añade `--sin-video` para saltarse el vídeo).
//
// El vídeo se graba con el Chromium de Playwright (canvas + MediaRecorder), así que no depende de
// ffmpeg: WebM VP9 siempre y MP4 H.264 si el navegador sabe codificarlo.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sceneJpeg } from './scenes.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LANDING = join(ROOT, 'apps', 'landing', 'public', 'media');
const APP = join(ROOT, 'apps', 'mobile', 'assets', 'ambient');

/** Imágenes fijas: destino, escena y tamaño. */
const IMAGES = [
  [
    LANDING,
    'hero-poster.jpg',
    'mediterranea',
    { time: 'atardecer', palette: 'arena', seed: 3 },
    1920,
    1080,
  ],
  [LANDING, 'paso-publicar.jpg', 'clasico', { time: 'dia', palette: 'ocre', seed: 5 }, 800, 600],
  [LANDING, 'paso-me-gusta.jpg', 'salon', { time: 'dia', palette: 'salvia', seed: 5 }, 800, 600],
  [
    LANDING,
    'paso-cambio.jpg',
    'atico',
    { time: 'atardecer', palette: 'terracota', seed: 5 },
    800,
    600,
  ],
  [LANDING, 'cadenas.jpg', 'moderna', { time: 'noche', palette: 'blanco', seed: 8 }, 1920, 1080],
  [LANDING, 'lista-espera.jpg', 'atico', { time: 'noche', palette: 'azul', seed: 11 }, 1920, 1080],
  [
    APP,
    'bienvenida-1.jpg',
    'mediterranea',
    { time: 'atardecer', palette: 'arena', seed: 3 },
    1080,
    1920,
  ],
  [
    APP,
    'bienvenida-2.jpg',
    'atico',
    { time: 'atardecer', palette: 'terracota', seed: 5 },
    1080,
    1920,
  ],
  [APP, 'bienvenida-3.jpg', 'moderna', { time: 'noche', palette: 'blanco', seed: 8 }, 1080, 1920],
  [APP, 'acceso.jpg', 'salon', { time: 'dia', palette: 'salvia', seed: 5 }, 1200, 1200],
  [APP, 'vacio-explorar.jpg', 'clasico', { time: 'atardecer', palette: 'ocre', seed: 2 }, 480, 480],
  [APP, 'vacio-matches.jpg', 'salon', { time: 'atardecer', palette: 'arena', seed: 2 }, 480, 480],
  [APP, 'vacio-casas.jpg', 'moderna', { time: 'dia', palette: 'salvia', seed: 2 }, 480, 480],
];

/** Escenas del vídeo, en orden; la primera se repite al final para que el bucle no salte. */
const VIDEO_SCENES = [
  ['mediterranea', { time: 'atardecer', palette: 'arena', seed: 3 }],
  ['salon', { time: 'dia', palette: 'salvia', seed: 5 }],
  ['atico', { time: 'atardecer', palette: 'terracota', seed: 5 }],
  ['moderna', { time: 'noche', palette: 'blanco', seed: 8 }],
];

async function images() {
  for (const [dir, file, scene, options, width, height] of IMAGES) {
    await mkdir(dir, { recursive: true });
    const quality = width >= 1920 || height >= 1920 ? 72 : 78;
    await writeFile(
      join(dir, file),
      await sceneJpeg(scene, { ...options, width, height, quality }),
    );
    process.stdout.write(`${file}\n`);
  }
}

/** Página que dibuja las escenas en un canvas (zoom lento y fundido) y graba el resultado. */
function recorderPage(frames, mimeType) {
  return `<!doctype html><canvas id="c" width="1280" height="720"></canvas><script>
  const sources = ${JSON.stringify(frames)};
  const HOLD = 4200, FADE = 1300, FPS = 30;
  window.record = async () => {
    const images = await Promise.all(sources.map((src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; })));
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    const draw = (img, progress, alpha) => {
      const scale = 1 + 0.08 * progress;
      const w = canvas.width * scale, h = canvas.height * scale;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, (canvas.width - w) / 2 - 20 * progress, (canvas.height - h) / 2, w, h);
    };
    const total = images.length * HOLD;
    const recorder = new MediaRecorder(canvas.captureStream(FPS), { mimeType: '${mimeType}', videoBitsPerSecond: 2_000_000 });
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise((ok) => (recorder.onstop = ok));
    recorder.start(250);
    const start = performance.now();
    await new Promise((finish) => {
      const tick = () => {
        const t = performance.now() - start;
        if (t >= total) return finish();
        const index = Math.floor(t / HOLD);
        const local = t - index * HOLD;
        const current = images[index], next = images[(index + 1) % images.length];
        ctx.globalAlpha = 1;
        draw(current, local / (HOLD + FADE), 1);
        if (local > HOLD - FADE) draw(next, (local - (HOLD - FADE)) / (HOLD + FADE), (local - (HOLD - FADE)) / FADE);
        requestAnimationFrame(tick);
      };
      tick();
    });
    recorder.stop();
    await done;
    const buffer = await new Blob(chunks).arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  };
  </script>`;
}

async function video() {
  const { chromium } = await import('@playwright/test');
  const frames = [];
  for (const [scene, options] of VIDEO_SCENES) {
    const jpeg = await sceneJpeg(scene, { ...options, width: 1440, height: 810, quality: 90 });
    frames.push(`data:image/jpeg;base64,${jpeg.toString('base64')}`);
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const [file, mimeType] of [
      ['hero.webm', 'video/webm;codecs=vp9'],
      ['hero.mp4', 'video/mp4;codecs=avc1'],
    ]) {
      await page.setContent(recorderPage(frames, mimeType));
      const supported = await page.evaluate(
        (type) => globalThis.MediaRecorder.isTypeSupported(type),
        mimeType,
      );
      if (!supported) {
        process.stdout.write(`${file}: el navegador no codifica ${mimeType}, se omite\n`);
        continue;
      }
      const base64 = await page.evaluate(() => globalThis.record());
      await writeFile(join(LANDING, file), Buffer.from(base64, 'base64'));
      process.stdout.write(`${file}\n`);
    }
  } finally {
    await browser.close();
  }
}

await images();
if (!process.argv.includes('--sin-video')) await video();
