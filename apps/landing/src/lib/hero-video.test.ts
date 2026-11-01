import { beforeEach, describe, expect, it, vi } from 'vitest';

import { es } from '../i18n/es';
import Home from '../pages/index.astro';
import { renderDocument } from '../tests/render';
import { browserEnvironment, initHeroVideo, shouldAutoplay } from './hero-video';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('shouldAutoplay', () => {
  it('reproduce sin preferencias de movimiento reducido ni de ahorro de datos', () => {
    expect(shouldAutoplay({ reducedMotion: false, saveData: false })).toBe(true);
  });

  it('se queda en la imagen fija con movimiento reducido', () => {
    expect(shouldAutoplay({ reducedMotion: true, saveData: false })).toBe(false);
  });

  it('se queda en la imagen fija con ahorro de datos', () => {
    expect(shouldAutoplay({ reducedMotion: false, saveData: true })).toBe(false);
  });
});

describe('Vídeo de fondo del héroe', () => {
  let doc: Document;
  let video: HTMLVideoElement;
  let toggle: HTMLButtonElement;
  let play: ReturnType<typeof vi.fn<() => Promise<void>>>;
  let pause: ReturnType<typeof vi.fn<() => void>>;

  const click = () => {
    toggle.dispatchEvent(
      new (doc.defaultView as unknown as { Event: typeof Event }).Event('click', { bubbles: true }),
    );
  };

  beforeEach(async () => {
    doc = await renderDocument(Home);
    video = doc.querySelector<HTMLVideoElement>('#hero-video')!;
    toggle = doc.querySelector<HTMLButtonElement>('#hero-video-toggle')!;
    play = vi.fn<() => Promise<void>>(() => Promise.resolve());
    pause = vi.fn<() => void>();
    Object.assign(video, { play, pause });
  });

  it('el vídeo es decorativo, silencioso, en bucle, sin autoplay ni descarga previa y con imagen fija', () => {
    expect(video.getAttribute('aria-hidden')).toBe('true');
    expect(video.hasAttribute('muted')).toBe(true);
    expect(video.hasAttribute('loop')).toBe(true);
    expect(video.hasAttribute('playsinline')).toBe(true);
    expect(video.hasAttribute('autoplay')).toBe(false);
    expect(video.getAttribute('preload')).toBe('none');
    expect(video.getAttribute('poster')).toBe('/media/hero-poster.jpg');
    const types = [...video.querySelectorAll('source')].map((s) => s.getAttribute('type'));
    expect(types).toEqual(['video/webm', 'video/mp4']);
  });

  it('Scenario: Reproducción por defecto - se reproduce y el control ofrece pausarlo', async () => {
    initHeroVideo(doc, { reducedMotion: false, saveData: false });
    await flush();
    expect(play).toHaveBeenCalledTimes(1);
    expect(toggle.getAttribute('aria-label')).toBe(es.hero.video.pause);
    expect(toggle.dataset.state).toBe('playing');
  });

  it('Scenario: Pausar y reanudar - el control alterna y anuncia el estado', async () => {
    initHeroVideo(doc, { reducedMotion: false, saveData: false });
    await flush();

    click();
    expect(pause).toHaveBeenCalledTimes(1);
    expect(toggle.getAttribute('aria-label')).toBe(es.hero.video.play);
    expect(doc.querySelector('#hero-video-status')?.textContent.trim()).toBe(es.hero.video.paused);

    click();
    await flush();
    expect(play).toHaveBeenCalledTimes(2);
    expect(toggle.getAttribute('aria-label')).toBe(es.hero.video.pause);
    expect(doc.querySelector('#hero-video-status')?.textContent.trim()).toBe(es.hero.video.playing);
  });

  it('Scenario: Movimiento reducido - no se reproduce y el control permite iniciarlo', async () => {
    initHeroVideo(doc, { reducedMotion: true, saveData: false });
    await flush();
    expect(play).not.toHaveBeenCalled();
    expect(toggle.getAttribute('aria-label')).toBe(es.hero.video.play);

    click();
    await flush();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('Scenario: Ahorro de datos - no se reproduce ni se descarga', async () => {
    initHeroVideo(doc, { reducedMotion: false, saveData: true });
    await flush();
    expect(play).not.toHaveBeenCalled();
    expect(toggle.dataset.state).toBe('paused');
  });

  it('si el navegador impide reproducir, se queda la imagen fija y el control ofrece reproducir', async () => {
    play.mockImplementation(() => Promise.reject(new Error('NotAllowedError')));
    initHeroVideo(doc, { reducedMotion: false, saveData: false });
    await flush();
    expect(toggle.dataset.state).toBe('paused');
    expect(toggle.getAttribute('aria-label')).toBe(es.hero.video.play);
  });

  it('la limpieza retira el control', async () => {
    const dispose = initHeroVideo(doc, { reducedMotion: true, saveData: false });
    dispose();
    click();
    await flush();
    expect(play).not.toHaveBeenCalled();
  });

  it('sin vídeo en la página no hace nada', () => {
    video.remove();
    expect(() => initHeroVideo(doc, { reducedMotion: false, saveData: false })()).not.toThrow();
  });
});

describe('browserEnvironment', () => {
  const view = (reduce: boolean, connection?: { saveData?: boolean }) =>
    ({
      matchMedia: (query: string) => ({ matches: reduce && query.includes('reduce') }),
      navigator: { connection },
    }) as unknown as Window;

  it('lee «reducir movimiento» y el ahorro de datos del navegador', () => {
    expect(browserEnvironment(view(true, { saveData: true }))).toEqual({
      reducedMotion: true,
      saveData: true,
    });
  });

  it('sin `connection` no hay ahorro de datos', () => {
    expect(browserEnvironment(view(false))).toEqual({ reducedMotion: false, saveData: false });
  });
});
