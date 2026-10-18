import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const SCANNED_DIRS = ['app', 'src'];
const EXCLUDED = /(\.test\.tsx?|\.d\.ts|test-utils\.tsx|[\\/]locales[\\/])/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) && !EXCLUDED.test(path) ? [path] : [];
  });
}

const FILES = SCANNED_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir)));

// Colores, y medidas de espaciado/radio/tipografía/sombra con número en crudo
const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/;
const COLOR_FUNCTION = /\b(?:rgba?|hsla?)\(/;
const RAW_MEASURE =
  /\b(?:padding\w*|margin\w*|gap|rowGap|columnGap|borderRadius|border\w*Radius|fontSize|lineHeight|shadow\w*|elevation)\s*:\s*-?\d/;

describe('tokens de diseño', () => {
  it('encuentra código fuente que analizar', () => {
    expect(FILES.length).toBeGreaterThan(10);
  });

  it.each(FILES.map((file) => [file.slice(ROOT.length + 1), file] as const))(
    '%s no contiene colores ni medidas literales',
    (_name, file) => {
      const source = readFileSync(file, 'utf8');

      expect(source).not.toMatch(HEX_COLOR);
      expect(source).not.toMatch(COLOR_FUNCTION);
      expect(source).not.toMatch(RAW_MEASURE);
    },
  );
});
