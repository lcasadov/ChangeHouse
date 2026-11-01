// Escenas de viviendas generadas por código: SVG compuesto a mano que sharp rasteriza a JPEG.
// Sirven de imágenes de prueba para la landing, la app y los datos de demostración. Son
// deterministas: la misma escena con la misma semilla produce siempre los mismos bytes.
import sharp from 'sharp';

/** Lienzo de diseño: todas las escenas se dibujan en 1600 × 1200 y se recortan al tamaño pedido. */
const W = 1600;
const H = 1200;

export const SCENES = Object.freeze([
  'mediterranea',
  'clasico',
  'moderna',
  'atico',
  'salon',
  'cocina',
  'dormitorio',
]);

export const TIMES = Object.freeze(['dia', 'atardecer', 'noche']);

/** Paletas de acabados: fachada, carpintería, textil principal y acento. */
export const PALETTES = Object.freeze({
  arena: { facade: '#EAD9C0', trim: '#7B5B3A', fabric: '#C9B79C', accent: '#C8553D' },
  salvia: { facade: '#DCE3D3', trim: '#4F6B4A', fabric: '#8FA58A', accent: '#E0A458' },
  terracota: { facade: '#E9C3A6', trim: '#6E3B2A', fabric: '#B8644A', accent: '#2F5D62' },
  azul: { facade: '#E4E8EE', trim: '#2E4A6B', fabric: '#5B7DA3', accent: '#E8505B' },
  ocre: { facade: '#F0D9A8', trim: '#5C4A2E', fabric: '#D19A3F', accent: '#3E6B5C' },
  blanco: { facade: '#F5F3EE', trim: '#3B3F45', fabric: '#D8D2C7', accent: '#E8505B' },
});

/** Generador pseudoaleatorio con semilla (mulberry32). */
export function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rnd, min, max) => min + (max - min) * rnd();
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];
const f = (n) => Math.round(n * 10) / 10;

const SKIES = {
  dia: ['#5B9BD5', '#8EC3EA', '#CFE7F6', '#F4F8F2'],
  atardecer: ['#2C3E70', '#B65C7A', '#F29E6B', '#FFD7A0'],
  noche: ['#0B1530', '#1D2B57', '#3A4A7D', '#6E6A8E'],
};

/** Luz de las ventanas según la hora: de reflejo frío de día a cálida e intensa de noche. */
const WINDOW_LIGHT = {
  dia: { from: '#A9C7DD', to: '#E8F1F7', glow: 0 },
  atardecer: { from: '#F7C873', to: '#FFE8B5', glow: 0.35 },
  noche: { from: '#FFB648', to: '#FFE3A1', glow: 0.7 },
};

function defs(time, extra = '') {
  const sky = SKIES[time];
  const light = WINDOW_LIGHT[time];
  return `<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${sky[0]}"/><stop offset="0.45" stop-color="${sky[1]}"/>
      <stop offset="0.8" stop-color="${sky[2]}"/><stop offset="1" stop-color="${sky[3]}"/>
    </linearGradient>
    <linearGradient id="win" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${light.from}"/><stop offset="1" stop-color="${light.to}"/>
    </linearGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.38"/>
    </radialGradient>
    <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFF6D8" stop-opacity="1"/><stop offset="0.25" stop-color="#FFE3A1" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#FFC27A" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFD27A" stop-opacity="0.9"/><stop offset="1" stop-color="#FFB648" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.18"/>
    </linearGradient>
    <filter id="blur8" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="8"/></filter>
    <filter id="blur24" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="24"/></filter>
    <filter id="blur60" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="60"/></filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.09 0"/>
    </filter>
    <filter id="stucco" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.10 0"/>
    </filter>
    ${extra}
  </defs>`;
}

/** Acabado fotográfico: tinte de la hora, viñeta y grano. */
function finish(time) {
  const tint = { dia: ['#FFF4E0', 0.06], atardecer: ['#FF9A5C', 0.12], noche: ['#1B2A5A', 0.22] }[
    time
  ];
  return `<rect width="${W}" height="${H}" fill="${tint[0]}" opacity="${tint[1]}"/>
    <rect width="${W}" height="${H}" fill="url(#vignette)"/>
    <rect width="${W}" height="${H}" filter="url(#grain)"/>`;
}

function sky(time, rnd) {
  let out = `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  if (time === 'noche') {
    for (let i = 0; i < 70; i++) {
      out += `<circle cx="${f(between(rnd, 0, W))}" cy="${f(between(rnd, 0, H * 0.45))}" r="${f(between(rnd, 0.8, 2.2))}" fill="#FFF" opacity="${f(between(rnd, 0.3, 0.9))}"/>`;
    }
    out += `<circle cx="${f(between(rnd, 1100, 1400))}" cy="170" r="46" fill="#F4F1E1"/><circle cx="1250" cy="170" r="160" fill="#F4F1E1" opacity="0.08" filter="url(#blur24)"/>`;
  } else {
    const sunX = between(rnd, 250, 1350);
    const sunY = time === 'dia' ? 160 : 560;
    out += `<circle cx="${f(sunX)}" cy="${sunY}" r="${time === 'dia' ? 260 : 420}" fill="url(#sun)" opacity="${time === 'dia' ? 0.55 : 0.95}"/>`;
    for (let i = 0; i < 5; i++) {
      const cx = between(rnd, -100, W);
      const cy = between(rnd, 80, 380);
      const tone = time === 'dia' ? '#FFFFFF' : '#FFC9A8';
      out += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(between(rnd, 120, 260))}" ry="${f(between(rnd, 22, 46))}" fill="${tone}" opacity="${f(between(rnd, 0.35, 0.7))}" filter="url(#blur24)"/>`;
    }
  }
  return out;
}

function tree(x, y, size, rnd, time) {
  const dark = time === 'noche' ? '#14261D' : '#2F5233';
  const mid = time === 'noche' ? '#1E3528' : '#3F6B3F';
  const light = time === 'noche' ? '#28432F' : '#5F8F4E';
  let out = `<ellipse cx="${x}" cy="${y + 6}" rx="${size * 0.9}" ry="${size * 0.16}" fill="#000" opacity="0.25" filter="url(#blur8)"/>`;
  out += `<rect x="${x - size * 0.06}" y="${y - size * 0.9}" width="${size * 0.12}" height="${size * 0.9}" fill="#4A3424"/>`;
  for (let i = 0; i < 9; i++) {
    const cx = x + between(rnd, -size * 0.55, size * 0.55);
    const cy = y - size * 0.95 + between(rnd, -size * 0.5, size * 0.3);
    const r = between(rnd, size * 0.28, size * 0.48);
    out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${pick(rnd, [dark, mid, light])}"/>`;
  }
  return out;
}

function palm(x, y, size, time) {
  const leaf = time === 'noche' ? '#1E3528' : '#3C6B3A';
  let out = `<path d="M${x} ${y} C ${x + 10} ${y - size * 0.5}, ${x + 30} ${y - size * 0.8}, ${x + 24} ${y - size}" stroke="#6B5139" stroke-width="${size * 0.06}" fill="none"/>`;
  const top = [x + 24, y - size];
  for (const a of [-160, -125, -90, -55, -20, 15, 200]) {
    const rad = (a * Math.PI) / 180;
    const ex = top[0] + Math.cos(rad) * size * 0.55;
    const ey = top[1] + Math.sin(rad) * size * 0.3 + size * 0.12;
    out += `<path d="M${top[0]} ${top[1]} Q ${f((top[0] + ex) / 2)} ${f(top[1] - size * 0.15)} ${f(ex)} ${f(ey)}" stroke="${leaf}" stroke-width="${size * 0.07}" fill="none" stroke-linecap="round"/>`;
  }
  return out;
}

function windowPane(x, y, w, h, trim, time, opts = {}) {
  const light = WINDOW_LIGHT[time];
  let out = '';
  if (light.glow > 0)
    out += `<rect x="${x - w * 0.4}" y="${y - h * 0.3}" width="${w * 1.8}" height="${h * 1.6}" fill="url(#glow)" opacity="${light.glow * 0.6}" filter="url(#blur24)"/>`;
  out += `<rect x="${x - 6}" y="${y - 6}" width="${w + 12}" height="${h + 12}" fill="${trim}"/>`;
  out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#win)"/>`;
  if (time === 'dia')
    out += `<polygon points="${x},${y + h} ${x + w * 0.55},${y} ${x + w * 0.8},${y} ${x + w * 0.25},${y + h}" fill="#FFF" opacity="0.28"/>`;
  out += `<line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + h}" stroke="${trim}" stroke-width="5"/>`;
  if (opts.cross !== false)
    out += `<line x1="${x}" y1="${y + h * 0.42}" x2="${x + w}" y2="${y + h * 0.42}" stroke="${trim}" stroke-width="5"/>`;
  if (opts.shutters) {
    out += `<rect x="${x - w * 0.42}" y="${y - 6}" width="${w * 0.36}" height="${h + 12}" fill="${opts.shutters}"/>`;
    out += `<rect x="${x + w + w * 0.06}" y="${y - 6}" width="${w * 0.36}" height="${h + 12}" fill="${opts.shutters}"/>`;
    for (let i = 1; i < 9; i++) {
      const yy = y - 6 + ((h + 12) * i) / 9;
      out += `<line x1="${x - w * 0.42}" y1="${f(yy)}" x2="${x - w * 0.06}" y2="${f(yy)}" stroke="#000" stroke-opacity="0.18" stroke-width="2"/>`;
      out += `<line x1="${x + w * 1.06}" y1="${f(yy)}" x2="${x + w * 1.42}" y2="${f(yy)}" stroke="#000" stroke-opacity="0.18" stroke-width="2"/>`;
    }
  }
  return out;
}

function plantPot(x, y, s, rnd, accent) {
  let out = `<ellipse cx="${x}" cy="${y + 4}" rx="${s * 0.7}" ry="${s * 0.12}" fill="#000" opacity="0.22" filter="url(#blur8)"/>`;
  out += `<path d="M${x - s * 0.45} ${y - s * 0.7} L${x + s * 0.45} ${y - s * 0.7} L${x + s * 0.34} ${y} L${x - s * 0.34} ${y} Z" fill="${accent}"/>`;
  for (let i = 0; i < 9; i++) {
    const a = between(rnd, -2.6, -0.5);
    const len = between(rnd, s * 0.8, s * 1.6);
    const ex = x + Math.cos(a) * len * 0.8;
    const ey = y - s * 0.7 + Math.sin(a) * len;
    out += `<path d="M${x} ${y - s * 0.7} Q ${f(x + Math.cos(a) * len * 0.2)} ${f(ey + len * 0.2)} ${f(ex)} ${f(ey)}" stroke="${pick(rnd, ['#3F6B3F', '#5F8F4E', '#2F5233'])}" stroke-width="${f(s * 0.16)}" fill="none" stroke-linecap="round"/>`;
  }
  return out;
}

// ─── Exteriores ──────────────────────────────────────────────────────────────

function mediterranea({ rnd, palette, time }) {
  const ground = time === 'noche' ? '#24331F' : '#7C9A4F';
  let out = sky(time, rnd);
  out += `<path d="M0 720 Q 400 650 800 700 T 1600 690 L1600 800 L0 800 Z" fill="${time === 'noche' ? '#1C2B3F' : '#8DA4B8'}" opacity="0.6"/>`;
  out += `<rect y="780" width="${W}" height="420" fill="${ground}"/>`;
  out += palm(180, 800, 380, time) + palm(1400, 790, 320, time);
  // Volumen principal y ala
  const wall = time === 'noche' ? '#B9B4C8' : '#F7F3EC';
  out += `<rect x="360" y="430" width="760" height="360" fill="${wall}"/><rect x="360" y="430" width="760" height="360" filter="url(#stucco)"/>`;
  out += `<rect x="1120" y="520" width="260" height="270" fill="${wall}"/><rect x="1120" y="520" width="260" height="270" fill="#000" opacity="0.08"/>`;
  out += `<polygon points="330,440 740,300 1150,440" fill="#B5583A"/><polygon points="330,440 740,300 1150,440" fill="url(#shade)"/>`;
  out += `<polygon points="1100,530 1250,460 1400,530" fill="#A24E34"/>`;
  for (let i = 0; i < 12; i++)
    out += `<line x1="${350 + i * 68}" y1="440" x2="${f(740 + (i - 5.5) * 8)}" y2="305" stroke="#8E3F29" stroke-opacity="0.35" stroke-width="3"/>`;
  out += windowPane(430, 520, 120, 150, palette.trim, time, { shutters: palette.accent });
  out += windowPane(930, 520, 120, 150, palette.trim, time, { shutters: palette.accent });
  out += `<path d="M680 790 L680 600 Q 740 540 800 600 L800 790 Z" fill="${palette.trim}"/><path d="M692 790 L692 606 Q 740 556 788 606 L788 790 Z" fill="url(#win)" opacity="0.85"/>`;
  out += windowPane(1180, 590, 140, 110, palette.trim, time, {});
  // Bugambilla sobre la fachada
  for (let i = 0; i < 40; i++)
    out += `<circle cx="${f(between(rnd, 360, 520))}" cy="${f(between(rnd, 430, 560))}" r="${f(between(rnd, 10, 22))}" fill="${pick(rnd, ['#C2306B', '#D9488A', '#9E2457'])}" opacity="0.9"/>`;
  // Piscina en primer plano, en perspectiva
  const water = time === 'noche' ? ['#1E6F8C', '#3FB3C9'] : ['#2E9CC1', '#7FD8E8'];
  out += `<defs><linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${water[1]}"/><stop offset="1" stop-color="${water[0]}"/></linearGradient></defs>`;
  out += `<polygon points="240,900 1360,900 1560,1200 40,1200" fill="#EFE7D8"/>`;
  out += `<polygon points="330,940 1270,940 1420,1200 180,1200" fill="url(#water)"/>`;
  for (let i = 0; i < 18; i++) {
    const y = between(rnd, 960, 1180);
    const x = between(rnd, 260, 1300);
    out += `<path d="M${f(x)} ${f(y)} q 30 -10 60 0 t 60 0" stroke="#FFF" stroke-opacity="${f(between(rnd, 0.25, 0.55))}" stroke-width="4" fill="none"/>`;
  }
  out += `<rect x="560" y="860" width="220" height="40" rx="8" fill="${palette.fabric}"/><rect x="820" y="860" width="220" height="40" rx="8" fill="${palette.fabric}"/>`;
  out += plantPot(250, 900, 70, rnd, palette.accent) + plantPot(1350, 900, 80, rnd, palette.accent);
  return out;
}

/** Ventana con balcón de forja, macetas y contraventanas al azar. */
function balconyWindow(x, y, { rnd, palette, time, shutters }) {
  const lit = time !== 'dia' && rnd() > 0.35;
  let out = windowPane(x, y, 140, 190, palette.trim, lit ? time : 'dia', { cross: false });
  out += `<rect x="${x - 40}" y="${y + 186}" width="220" height="14" fill="#5A5048"/>`;
  out += `<rect x="${x - 40}" y="${y + 196}" width="220" height="10" fill="#000" opacity="0.25" filter="url(#blur8)"/>`;
  for (let b = 0; b <= 14; b++)
    out += `<line x1="${x - 36 + b * 15}" y1="${y + 110}" x2="${x - 36 + b * 15}" y2="${y + 186}" stroke="#2A2522" stroke-width="3"/>`;
  out += `<line x1="${x - 40}" y1="${y + 110}" x2="${x + 180}" y2="${y + 110}" stroke="#2A2522" stroke-width="6"/>`;
  if (rnd() > 0.4) out += plantPot(x + between(rnd, 0, 140), y + 186, 40, rnd, palette.accent);
  if (rnd() > 0.5)
    out += `<rect x="${x - 34}" y="${y - 6}" width="30" height="202" fill="${shutters}"/><rect x="${x + 144}" y="${y - 6}" width="30" height="202" fill="${shutters}"/>`;
  return out;
}

function clasico({ rnd, palette, time }) {
  let out = sky(time, rnd);
  const stone = time === 'noche' ? '#8C7F78' : palette.facade;
  out += `<rect x="60" y="120" width="1480" height="1080" fill="${stone}"/><rect x="60" y="120" width="1480" height="1080" filter="url(#stucco)"/>`;
  out += `<rect x="40" y="100" width="1520" height="40" fill="#000" opacity="0.18"/><rect x="40" y="96" width="1520" height="20" fill="${stone}"/>`;
  const shutters = pick(rnd, ['#3E5C45', '#6B3A2E', '#2E4A6B', palette.trim]);
  for (let row = 0; row < 3; row++) {
    const y = 210 + row * 300;
    out += `<rect x="60" y="${y + 196}" width="1480" height="14" fill="#000" opacity="0.12"/>`;
    for (let col = 0; col < 4; col++)
      out += balconyWindow(170 + col * 360, y, { rnd, palette, time, shutters });
  }
  // Farola y luz cálida
  out += `<rect x="1480" y="760" width="12" height="440" fill="#1E1E1E"/><rect x="1458" y="720" width="56" height="60" rx="8" fill="#2A2522"/>`;
  out += `<circle cx="1486" cy="760" r="${time === 'dia' ? 0 : 160}" fill="url(#glow)" opacity="0.7"/>`;
  return out;
}

function moderna({ rnd, time }) {
  let out = sky(time, rnd);
  const ground = time === 'noche' ? '#18261C' : '#5E8A47';
  out += tree(140, 820, 260, rnd, time) + tree(1470, 830, 230, rnd, time);
  out += `<rect y="800" width="${W}" height="400" fill="${ground}"/>`;
  // Volúmenes: caja inferior acristalada y caja superior volada
  out += `<rect x="280" y="560" width="1040" height="260" fill="#2B2E33"/>`;
  out += `<rect x="300" y="580" width="700" height="220" fill="url(#win)"/>`;
  for (let i = 1; i < 6; i++)
    out += `<line x1="${300 + i * 116}" y1="580" x2="${300 + i * 116}" y2="800" stroke="#2B2E33" stroke-width="6"/>`;
  out += `<rect x="1020" y="580" width="280" height="220" fill="#7B5B3A"/>`;
  for (let i = 0; i < 14; i++)
    out += `<line x1="${1020 + i * 20}" y1="580" x2="${1020 + i * 20}" y2="800" stroke="#5C4128" stroke-width="3"/>`;
  out += `<rect x="440" y="330" width="980" height="230" fill="${time === 'noche' ? '#C9C6CF' : '#F2F0EB'}"/>`;
  out += `<rect x="440" y="540" width="980" height="24" fill="#000" opacity="0.25"/>`;
  out += `<rect x="520" y="380" width="520" height="130" fill="url(#win)"/>`;
  out += `<rect x="1100" y="380" width="240" height="130" fill="#2B2E33"/><rect x="1110" y="390" width="220" height="110" fill="url(#win)" opacity="0.8"/>`;
  if (time !== 'dia') {
    out += `<rect x="300" y="580" width="700" height="220" fill="url(#glow)" opacity="0.55" filter="url(#blur24)"/>`;
    // Interior: siluetas de muebles tras el cristal
    out += `<rect x="380" y="720" width="260" height="70" rx="14" fill="#5A3B2A" opacity="0.6"/><circle cx="820" cy="640" r="26" fill="#FFF3D0" opacity="0.9"/>`;
  }
  // Reflejo en la lámina de agua y camino de luces
  out += `<rect x="240" y="860" width="1120" height="120" fill="${time === 'noche' ? '#203A56' : '#6FB3D2'}" opacity="0.9"/>`;
  out += `<rect x="300" y="860" width="700" height="80" fill="url(#win)" opacity="0.35" filter="url(#blur8)"/>`;
  for (let i = 0; i < 7; i++) {
    const x = 220 + i * 190;
    out += `<rect x="${x}" y="1040" width="10" height="40" fill="#222"/>`;
    if (time !== 'dia')
      out += `<circle cx="${x + 5}" cy="1040" r="50" fill="url(#glow)" opacity="0.8"/>`;
  }
  out += `<polygon points="700,1200 900,1200 860,990 740,990" fill="#CFC8BC" opacity="0.9"/>`;
  return out;
}

const ROOFTOPS = {
  dia: ['#A7B6C4', '#8C9DAB', '#6F8090'],
  atardecer: ['#B98A86', '#8E6A72', '#6A4E5E'],
  noche: ['#2B3352', '#202741', '#161B30'],
};

/** Una línea de tejados de la ciudad; cuanto más cerca (`depth`), más alta y más baja en el cuadro. */
function rooftops(depth, color, rnd, time) {
  let x = -40;
  const base = 560 + depth * 70;
  let path = `M0 ${base + 200}`;
  while (x < W + 40) {
    const w = between(rnd, 60, 160);
    const h = between(rnd, 40, 180) * (1 + depth * 0.3);
    path += ` L${f(x)} ${f(base - h)} L${f(x + w)} ${f(base - h)}`;
    if (rnd() > 0.7)
      path += ` L${f(x + w + 20)} ${f(base - h - 40)} L${f(x + w + 40)} ${f(base - h)}`;
    x += w + 40;
  }
  let out = `<path d="${path} L${W} ${base + 200} Z" fill="${color}"/>`;
  if (time === 'dia') return out;
  for (let i = 0; i < 30; i++)
    out += `<rect x="${f(between(rnd, 0, W))}" y="${f(between(rnd, base - 120, base + 60))}" width="8" height="10" fill="#FFD27A" opacity="${f(between(rnd, 0.4, 0.9))}"/>`;
  return out;
}

/** Guirnalda de bombillas colgada de lado a lado. */
function stringLights(time) {
  let out = `<path d="M0 160 Q 800 420 1600 160" stroke="#2A2522" stroke-width="3" fill="none"/>`;
  for (let i = 0; i <= 20; i++) {
    const x = i * 80;
    const y = 160 + Math.sin((i / 20) * Math.PI) * 120 + ((i % 5) - 2) * 6;
    out += `<circle cx="${x}" cy="${f(y)}" r="7" fill="#FFE3A1"/>`;
    if (time !== 'dia')
      out += `<circle cx="${x}" cy="${f(y)}" r="40" fill="url(#glow)" opacity="0.8"/>`;
  }
  return out;
}

function atico({ rnd, palette, time }) {
  let out = sky(time, rnd);
  const planes = ROOFTOPS[time];
  for (const [depth, color] of planes.entries()) out += rooftops(depth, color, rnd, time);
  // Cúpula a lo lejos
  out += `<path d="M1180 520 Q 1250 400 1320 520 Z" fill="${planes[0]}"/><rect x="1246" y="370" width="8" height="40" fill="${planes[0]}"/>`;
  // Tarima en perspectiva
  out += `<polygon points="0,820 1600,820 1600,1200 0,1200" fill="#9C7552"/>`;
  for (let i = 0; i < 26; i++) {
    const x = -800 + i * 128;
    out += `<line x1="${f(800 + (x - 800) * 0.35)}" y1="820" x2="${x}" y2="1200" stroke="#6E5038" stroke-width="3"/>`;
  }
  out += `<rect y="820" width="${W}" height="380" fill="url(#shade)"/>`;
  // Barandilla de vidrio
  out += `<rect y="700" width="${W}" height="120" fill="#BFE0EE" opacity="0.18"/><line x1="0" y1="700" x2="${W}" y2="700" stroke="#C8CED6" stroke-width="6"/>`;
  for (let i = 0; i < 9; i++)
    out += `<rect x="${i * 200}" y="700" width="8" height="120" fill="#AEB6BF"/>`;
  out += stringLights(time);
  // Tumbonas, mesa y plantas
  for (const x of [260, 620]) {
    out += `<ellipse cx="${x + 120}" cy="1010" rx="170" ry="20" fill="#000" opacity="0.3" filter="url(#blur8)"/>`;
    out += `<polygon points="${x},980 ${x + 240},980 ${x + 220},1000 ${x + 20},1000" fill="#EDE6DA"/><polygon points="${x},980 ${x + 60},880 ${x + 80},880 ${x + 20},980" fill="#EDE6DA"/>`;
    out += `<rect x="${x + 10}" y="960" width="230" height="22" rx="8" fill="${palette.fabric}"/>`;
  }
  out += `<ellipse cx="1080" cy="990" rx="90" ry="22" fill="#2A2522"/><rect x="1074" y="990" width="12" height="70" fill="#2A2522"/>`;
  out += `<rect x="1050" y="950" width="30" height="40" rx="4" fill="#FFF" opacity="0.8"/><circle cx="1110" cy="972" r="16" fill="${palette.accent}"/>`;
  out +=
    plantPot(1340, 1040, 120, rnd, palette.accent) + plantPot(110, 1060, 100, rnd, palette.accent);
  return out;
}

// ─── Interiores ──────────────────────────────────────────────────────────────

/** Habitación en perspectiva de un punto: pared del fondo, laterales, suelo de madera y techo. */
function room({ wall, floor, time }) {
  const back = { x1: 330, y1: 230, x2: 1270, y2: 820 };
  let out = `<rect width="${W}" height="${H}" fill="${wall}"/>`;
  out += `<polygon points="0,0 ${back.x1},${back.y1} ${back.x1},${back.y2} 0,${H}" fill="#000" opacity="0.10"/>`;
  out += `<polygon points="${W},0 ${back.x2},${back.y1} ${back.x2},${back.y2} ${W},${H}" fill="#000" opacity="0.16"/>`;
  out += `<polygon points="0,0 ${W},0 ${back.x2},${back.y1} ${back.x1},${back.y1}" fill="#FFF" opacity="0.35"/>`;
  out += `<polygon points="${back.x1},${back.y2} ${back.x2},${back.y2} ${W},${H} 0,${H}" fill="${floor}"/>`;
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    const xb = back.x1 + (back.x2 - back.x1) * t;
    const xf = -300 + (W + 600) * t;
    out += `<line x1="${f(xb)}" y1="${back.y2}" x2="${f(xf)}" y2="${H}" stroke="#000" stroke-opacity="0.12" stroke-width="2"/>`;
  }
  out += `<polygon points="${back.x1},${back.y2} ${back.x2},${back.y2} ${W},${H} 0,${H}" fill="url(#shade)"/>`;
  out += `<rect x="${back.x1}" y="${back.y2 - 14}" width="${back.x2 - back.x1}" height="14" fill="#FFF" opacity="0.5"/>`;
  if (time === 'noche') out += `<rect width="${W}" height="${H}" fill="#0B1530" opacity="0.25"/>`;
  return { out, back };
}

/** Ventanal en la pared del fondo con la luz entrando sobre el suelo. */
function bigWindow(x, y, w, h, time, trim) {
  const outside = SKIES[time];
  let out = `<defs><linearGradient id="outside" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${outside[1]}"/><stop offset="1" stop-color="${outside[3]}"/></linearGradient></defs>`;
  out += `<rect x="${x - 10}" y="${y - 10}" width="${w + 20}" height="${h + 20}" fill="${trim}"/>`;
  out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#outside)"/>`;
  out += `<path d="M${x} ${y + h * 0.8} Q ${x + w * 0.3} ${y + h * 0.6} ${x + w * 0.6} ${y + h * 0.75} T ${x + w} ${y + h * 0.7} L${x + w} ${y + h} L${x} ${y + h} Z" fill="#4F6B4A" opacity="0.7"/>`;
  out += `<line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + h}" stroke="${trim}" stroke-width="10"/>`;
  if (time !== 'noche') {
    out += `<polygon points="${x},${y + h} ${x + w},${y + h} ${x + w + 260},1200 ${x - 160},1200" fill="#FFF3D6" opacity="0.28" filter="url(#blur24)"/>`;
  }
  return out;
}

function lamp(x, y, time, color = '#F3E7D3') {
  let out = `<line x1="${x}" y1="0" x2="${x}" y2="${y}" stroke="#2A2522" stroke-width="3"/>`;
  out += `<path d="M${x - 46} ${y + 50} L${x - 22} ${y} L${x + 22} ${y} L${x + 46} ${y + 50} Z" fill="${color}"/>`;
  out += `<circle cx="${x}" cy="${y + 70}" r="${time === 'dia' ? 60 : 140}" fill="url(#glow)" opacity="${time === 'dia' ? 0.35 : 0.85}"/>`;
  return out;
}

function salon({ rnd, palette, time }) {
  const { out: base, back } = room({ wall: palette.facade, floor: '#B48A62', time });
  let out = base + bigWindow(820, 290, 400, 420, time, '#FFFFFF');
  // Cuadro y estantería
  out += `<rect x="420" y="320" width="280" height="190" fill="#FFF"/><rect x="434" y="334" width="252" height="162" fill="${palette.accent}" opacity="0.85"/>`;
  out += `<circle cx="520" cy="410" r="44" fill="${palette.fabric}"/><rect x="560" y="380" width="100" height="90" fill="#FFF" opacity="0.5"/>`;
  // Alfombra
  out += `<polygon points="360,900 1240,900 1420,1110 180,1110" fill="${palette.fabric}" opacity="0.55"/>`;
  // Sofá
  const sofa = palette.trim;
  out += `<ellipse cx="760" cy="960" rx="470" ry="40" fill="#000" opacity="0.35" filter="url(#blur24)"/>`;
  out += `<rect x="320" y="720" width="880" height="170" rx="40" fill="${sofa}"/>`;
  out += `<rect x="290" y="800" width="940" height="150" rx="36" fill="${sofa}"/><rect x="290" y="800" width="940" height="150" rx="36" fill="url(#shade)"/>`;
  out += `<rect x="350" y="790" width="400" height="80" rx="30" fill="#FFF" opacity="0.12"/><rect x="770" y="790" width="400" height="80" rx="30" fill="#FFF" opacity="0.12"/>`;
  out += `<rect x="250" y="760" width="90" height="200" rx="40" fill="${sofa}"/><rect x="1180" y="760" width="90" height="200" rx="40" fill="${sofa}"/>`;
  out += `<rect x="1180" y="760" width="90" height="200" rx="40" fill="#000" opacity="0.12"/>`;
  for (const [x, c] of [
    [380, palette.accent],
    [520, '#F1E9DA'],
    [1040, palette.accent],
  ])
    out += `<rect x="${x}" y="${f(730 + rnd() * 10)}" width="110" height="100" rx="24" fill="${c}" transform="rotate(${f(between(rnd, -8, 8))} ${x + 55} 780)"/>`;
  // Mesa de centro
  out += `<ellipse cx="760" cy="1080" rx="260" ry="40" fill="#000" opacity="0.3" filter="url(#blur8)"/>`;
  out += `<ellipse cx="760" cy="1030" rx="250" ry="56" fill="#3B2B20"/><ellipse cx="760" cy="1020" rx="250" ry="56" fill="#6B4E37"/>`;
  out += `<rect x="690" y="980" width="70" height="20" fill="#E9E1D3"/><circle cx="830" cy="998" r="22" fill="${palette.accent}"/>`;
  out += plantPot(170, 960, 150, rnd, '#EDE6DA');
  out += lamp(1380, 300, time);
  out += `<rect x="${back.x1}" y="${back.y1}" width="0" height="0"/>`;
  return out;
}

function cocina({ rnd, palette, time }) {
  const { out: base } = room({ wall: '#F2EFEA', floor: '#C9BBA6', time });
  let out = base + bigWindow(640, 280, 320, 220, time, '#FFFFFF');
  // Muebles altos y bajos de la pared del fondo
  const fronts = palette.trim;
  out += `<rect x="330" y="240" width="290" height="250" fill="${fronts}"/><rect x="980" y="240" width="290" height="250" fill="${fronts}"/>`;
  for (const x of [330, 475, 980, 1125])
    out += `<rect x="${x + 8}" y="248" width="129" height="234" fill="#FFF" opacity="0.06"/><rect x="${x + 120}" y="420" width="6" height="50" fill="#D9D2C5"/>`;
  // Frente de azulejo
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 24; c++)
      out += `<rect x="${330 + c * 39}" y="${510 + r * 30}" width="37" height="28" fill="${r % 2 === c % 2 ? '#E7E2DA' : '#DCD5CA'}"/>`;
  out += `<rect x="330" y="630" width="940" height="26" fill="#EEEAE3"/><rect x="330" y="656" width="940" height="164" fill="${fronts}"/>`;
  for (let i = 0; i < 6; i++)
    out += `<rect x="${340 + i * 156}" y="676" width="140" height="130" fill="#FFF" opacity="0.07"/><rect x="${400 + i * 156}" y="690" width="24" height="5" fill="#D9D2C5"/>`;
  // Isla en primer plano
  out += `<ellipse cx="800" cy="1150" rx="620" ry="40" fill="#000" opacity="0.35" filter="url(#blur24)"/>`;
  out += `<rect x="200" y="860" width="1200" height="44" fill="#F4F1EC"/><rect x="200" y="900" width="1200" height="260" fill="${palette.fabric}"/>`;
  out += `<rect x="200" y="900" width="1200" height="260" fill="url(#shade)"/>`;
  for (let i = 0; i < 8; i++)
    out += `<line x1="${200 + i * 150}" y1="904" x2="${200 + i * 150}" y2="1160" stroke="#000" stroke-opacity="0.12" stroke-width="3"/>`;
  out += `<ellipse cx="560" cy="856" rx="80" ry="14" fill="#FFF"/><circle cx="560" cy="830" r="30" fill="${palette.accent}"/><circle cx="600" cy="840" r="22" fill="#E0A458"/>`;
  out += plantPot(1150, 860, 70, rnd, '#EDE6DA');
  // Lámparas colgantes
  out +=
    lamp(560, 220, time, palette.accent) +
    lamp(800, 200, time, palette.accent) +
    lamp(1040, 220, time, palette.accent);
  return out;
}

function dormitorio({ rnd, palette, time }) {
  const { out: base } = room({ wall: palette.facade, floor: '#A88160', time });
  let out = base + bigWindow(1060, 290, 180, 380, time, '#FFFFFF');
  // Cortinas
  out += `<rect x="1020" y="270" width="50" height="560" fill="#F4EFE6" opacity="0.9"/><rect x="1230" y="270" width="50" height="560" fill="#F4EFE6" opacity="0.9"/>`;
  // Cabecero, cama y ropa
  out += `<ellipse cx="700" cy="1100" rx="560" ry="50" fill="#000" opacity="0.35" filter="url(#blur24)"/>`;
  out += `<rect x="330" y="470" width="740" height="330" rx="24" fill="${palette.trim}"/>`;
  for (let i = 0; i < 8; i++)
    out += `<rect x="${348 + i * 90}" y="490" width="74" height="290" rx="20" fill="#FFF" opacity="0.07"/>`;
  out += `<rect x="290" y="760" width="820" height="160" rx="30" fill="#F4F1EC"/>`;
  out += `<path d="M260 840 L1140 840 L1180 1120 L220 1120 Z" fill="${palette.fabric}"/><path d="M260 840 L1140 840 L1180 1120 L220 1120 Z" fill="url(#shade)"/>`;
  out += `<path d="M240 960 L1160 960 L1180 1120 L220 1120 Z" fill="#000" opacity="0.08"/>`;
  out += `<rect x="360" y="700" width="300" height="130" rx="40" fill="#FFFFFF"/><rect x="740" y="700" width="300" height="130" rx="40" fill="#FFFFFF"/>`;
  out += `<rect x="460" y="760" width="200" height="90" rx="30" fill="${palette.accent}" opacity="0.9"/>`;
  // Mesillas con lámparas
  for (const x of [160, 1150]) {
    out += `<rect x="${x}" y="800" width="160" height="160" fill="#6B4E37"/><rect x="${x}" y="800" width="160" height="20" fill="#7E5C42"/>`;
    out += `<rect x="${x + 72}" y="730" width="16" height="70" fill="#2A2522"/><path d="M${x + 30} 740 L${x + 50} 680 L${x + 110} 680 L${x + 130} 740 Z" fill="#F3E7D3"/>`;
    if (time !== 'dia')
      out += `<circle cx="${x + 80}" cy="720" r="150" fill="url(#glow)" opacity="0.8"/>`;
  }
  out += plantPot(1440, 1080, 150, rnd, '#EDE6DA');
  return out;
}

const RENDERERS = { mediterranea, clasico, moderna, atico, salon, cocina, dormitorio };

/**
 * SVG de una escena. `width` y `height` fijan el tamaño de salida: el dibujo se recorta centrado
 * («cover»), así que cualquier proporción sale sin bandas.
 */
export function sceneSvg(name, options = {}) {
  const render = RENDERERS[name];
  if (!render) throw new Error(`Escena desconocida: ${name}`);
  const { seed = 1, time = 'dia', width = W, height = H } = options;
  if (!TIMES.includes(time)) throw new Error(`Hora desconocida: ${time}`);
  const palette = PALETTES[options.palette ?? 'arena'];
  if (!palette) throw new Error(`Paleta desconocida: ${options.palette}`);
  const rnd = random(seed);
  const body = render({ rnd, palette, time });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${defs(time)}${body}${finish(time)}</svg>`;
}

/** JPEG progresivo de una escena, listo para la web. */
export function sceneJpeg(name, options = {}) {
  const quality = options.quality ?? 80;
  return sharp(Buffer.from(sceneSvg(name, options)))
    .jpeg({ quality, progressive: true, mozjpeg: true })
    .toBuffer();
}
