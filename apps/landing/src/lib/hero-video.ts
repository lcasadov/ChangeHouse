import { es } from '../i18n/es';

export interface VideoEnvironment {
  /** El sistema pide reducir el movimiento (`prefers-reduced-motion: reduce`). */
  reducedMotion: boolean;
  /** El navegador declara ahorro de datos (`navigator.connection.saveData`). */
  saveData: boolean;
}

/** El vídeo arranca solo si nadie ha pedido menos movimiento ni menos datos. */
export function shouldAutoplay({ reducedMotion, saveData }: VideoEnvironment): boolean {
  return !reducedMotion && !saveData;
}

/** Lee las preferencias del navegador; sin `matchMedia` ni `connection`, no hay preferencia. */
export function browserEnvironment(view: Window): VideoEnvironment {
  const connection = (view.navigator as Navigator & { connection?: { saveData?: boolean } })
    .connection;
  return {
    reducedMotion: view.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    saveData: connection?.saveData === true,
  };
}

type State = 'playing' | 'paused';

/**
 * Conecta el vídeo de fondo del héroe con su control de pausa: arranca si el entorno lo permite y
 * alterna con el botón, que anuncia cada cambio. Si el navegador impide reproducir, se queda la
 * imagen fija. Devuelve la función que retira el control.
 */
export function initHeroVideo(doc: Document, env: VideoEnvironment): () => void {
  const video = doc.querySelector<HTMLVideoElement>('#hero-video');
  const toggle = doc.querySelector<HTMLButtonElement>('#hero-video-toggle');
  const status = doc.querySelector<HTMLElement>('#hero-video-status');
  if (!video || !toggle) return () => undefined;

  const { video: text } = es.hero;
  const show = (state: State, announce: boolean) => {
    toggle.dataset.state = state;
    toggle.setAttribute('aria-label', state === 'playing' ? text.pause : text.play);
    if (announce && status) status.textContent = state === 'playing' ? text.playing : text.paused;
  };

  const start = (announce: boolean) =>
    video.play().then(
      () => show('playing', announce),
      () => show('paused', false),
    );

  const onClick = () => {
    if (toggle.dataset.state === 'playing') {
      video.pause();
      show('paused', true);
    } else {
      start(true).catch(() => undefined);
    }
  };

  show('paused', false);
  toggle.addEventListener('click', onClick);
  if (shouldAutoplay(env)) start(false).catch(() => undefined);

  return () => {
    toggle.removeEventListener('click', onClick);
  };
}
