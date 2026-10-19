import { describe, expect, it } from 'vitest';

import { es } from '../i18n/es';

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

describe('Contenido de la landing', () => {
  const all = strings(es);

  it('Scenario: Sin promesas fiscales indebidas — ningún texto menciona «ahorro fiscal» (RN-07)', () => {
    expect(all.length).toBeGreaterThan(50);
    expect(all.filter((text) => /ahorro\s+fiscal/i.test(text))).toEqual([]);
  });

  it('Scenario: Sin promesas fiscales indebidas — ningún texto sugiere escriturar por debajo del mercado', () => {
    expect(
      all.filter((text) => /(escritur\w+).{0,40}(por debajo|menos|inferior)/i.test(text)),
    ).toEqual([]);
  });

  it('Scenario: Cómo funciona en tres pasos — define exactamente tres pasos', () => {
    expect(es.howItWorks.steps).toHaveLength(3);
  });

  it('no deja textos vacíos', () => {
    expect(all.filter((text) => text.trim() === '')).toEqual([]);
  });

  it('las preguntas frecuentes no repiten pregunta', () => {
    const questions = es.faq.items.map((item) => item.question);
    expect(new Set(questions).size).toBe(questions.length);
  });
});
