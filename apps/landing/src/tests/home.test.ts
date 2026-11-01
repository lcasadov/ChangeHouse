import { describe, expect, it } from 'vitest';

import { es } from '../i18n/es';
import Home from '../pages/index.astro';
import { renderDocument } from './render';

const doc = await renderDocument(Home);

const textOf = (selector: string): string[] =>
  [...doc.querySelectorAll(selector)].map((node) => node.textContent.replace(/\s+/g, ' ').trim());

describe('Presentación de la propuesta de valor', () => {
  it('Scenario: Primera pantalla — titular, frase explicativa y botón a la lista de espera', () => {
    const hero = doc.querySelector('main section');
    expect(hero?.querySelector('h1')?.textContent.trim()).toBe('Cambia de casa sin vender primero');
    expect(hero?.querySelector('p')?.textContent.trim().length).toBeGreaterThan(20);

    const cta = hero?.querySelector('a[href="#lista-de-espera"]');
    expect(cta?.textContent.trim()).toBe(es.hero.cta);
    expect(doc.querySelector('#lista-de-espera')).not.toBeNull();
  });

  it('Scenario: Primera pantalla — hay un único h1 y la ilustración es decorativa', () => {
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
    const illustration = doc.querySelector('main section svg');
    expect(illustration?.getAttribute('aria-hidden')).toBe('true');
  });

  it('Scenario: Cómo funciona en tres pasos — exactamente tres', () => {
    const steps = textOf('#como-funciona ol > li');
    expect(steps).toHaveLength(3);
    expect(steps[0]).toMatch(/publica/i);
    expect(steps[1]).toMatch(/marca/i);
    expect(steps[2]).toMatch(/gestor[ií]a/i);
  });

  it('muestra la sección «Cadenas de tres» con su explicación', () => {
    const section = doc.querySelector('#cadenas');
    expect(section?.querySelector('h2')?.textContent.trim()).toBe(es.chains.title);
    expect(section?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(section?.querySelectorAll('p').length).toBeGreaterThanOrEqual(2);
  });

  it('muestra las cuatro ventajas, con la comisión de agencia que se evita', () => {
    const benefits = textOf('#ventajas li');
    expect(benefits).toHaveLength(4);
    expect(benefits.join(' ')).toContain('3–5 % + IVA');
    expect(benefits.join(' ')).toMatch(/mismo día/i);
    expect(benefits.join(' ')).toMatch(/diferencia/i);
    expect(benefits.join(' ')).toMatch(/gestor[ií]a/i);
  });

  it('presenta la historia del fundador marcada como borrador', () => {
    const section = doc.querySelector('#fundador');
    expect(section?.querySelector('h2')?.textContent.trim()).toBe(es.founder.title);
    expect(section?.textContent).toContain(es.founder.draftNotice);
  });

  it('las secciones están en el orden de la propuesta', () => {
    const ids = [...doc.querySelectorAll('main > section')].map((section) => section.id);
    expect(ids).toEqual([
      'inicio',
      'como-funciona',
      'cadenas',
      'ventajas',
      'fundador',
      'preguntas',
      'lista-de-espera',
    ]);
  });

  it('cada sección está nombrada por su encabezado', () => {
    for (const section of doc.querySelectorAll('main > section')) {
      const labelledBy = section.getAttribute('aria-labelledby');
      expect(labelledBy, section.id).toBeTruthy();
      expect(section.querySelector(`#${labelledBy}`), section.id).not.toBeNull();
    }
  });

  it('Scenario: Preguntas frecuentes desplegables — cada pregunta expone su respuesta', () => {
    const items = [...doc.querySelectorAll('#preguntas [data-faq-item]')];
    expect(items.length).toBe(es.faq.items.length);
    expect(items.length).toBeGreaterThanOrEqual(6);

    for (const item of items) {
      const toggle = item.querySelector('button[aria-controls]');
      expect(toggle?.textContent.trim().length).toBeGreaterThan(5);
      expect(toggle?.getAttribute('aria-expanded')).toBe('false');
      const answer = doc.getElementById(toggle?.getAttribute('aria-controls') ?? '');
      expect(answer?.textContent.trim().length).toBeGreaterThan(20);
      expect(answer?.hasAttribute('hidden')).toBe(true);
    }
  });

  it('Scenario: Sin promesas fiscales indebidas — el texto renderizado no las contiene', () => {
    const rendered = doc.body.textContent.toLowerCase();
    expect(rendered).not.toContain('ahorro fiscal');
    expect(rendered).not.toMatch(/por debajo del valor de mercado/);
  });

  it('no carga scripts ni recursos de analítica', () => {
    const scripts = [...doc.querySelectorAll('script[src]')].map(
      (s) => s.getAttribute('src') ?? '',
    );
    expect(
      scripts.filter((src) => /analytics|gtag|gtm|hotjar|segment|plausible/i.test(src)),
    ).toEqual([]);
  });
});

describe('Presentación de la propuesta de valor — fondo fotográfico', () => {
  it('Scenario: Primera pantalla — el héroe lleva el vídeo con su imagen fija, el velo y el control de pausa', () => {
    const hero = doc.querySelector('#inicio');
    expect(hero?.querySelector('video#hero-video')).not.toBeNull();
    expect(hero?.querySelector('.hero-veil')?.getAttribute('aria-hidden')).toBe('true');
    const toggle = hero?.querySelector('button#hero-video-toggle');
    expect(toggle?.getAttribute('type')).toBe('button');
    expect(toggle?.getAttribute('aria-label')).toBe(es.hero.video.play);
    expect(hero?.querySelector('#hero-video-status')?.getAttribute('aria-live')).toBe('polite');
  });

  it('Scenario: Texto legible sobre el fondo — la cabecera de la portada va superpuesta al héroe', () => {
    expect(doc.querySelector('.site-header')?.classList.contains('overlay')).toBe(true);
  });
});

describe('Secciones con fotografía', () => {
  it('Scenario: Pasos con foto — cada paso tiene su foto con texto alternativo y carga diferida', () => {
    const photos = [...doc.querySelectorAll('#como-funciona ol > li img')];
    expect(photos).toHaveLength(3);
    for (const [index, photo] of photos.entries()) {
      expect(photo.getAttribute('alt')).toBe(es.howItWorks.steps[index]?.photoAlt);
      expect(photo.getAttribute('alt')?.length).toBeGreaterThan(10);
      expect(photo.getAttribute('loading')).toBe('lazy');
      expect(photo.getAttribute('width')).toBeTruthy();
      expect(photo.getAttribute('height')).toBeTruthy();
    }
  });

  it('Scenario: Imágenes que no bloquean la carga — las fotos de fondo de las secciones son decorativas y diferidas', () => {
    for (const id of ['cadenas', 'lista-de-espera']) {
      const photo = doc.querySelector(`#${id} img.section-photo`);
      expect(photo, id).not.toBeNull();
      expect(photo?.getAttribute('alt'), id).toBe('');
      expect(photo?.getAttribute('loading'), id).toBe('lazy');
    }
  });
});
