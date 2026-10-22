import { parseHTML } from 'linkedom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { es } from '../i18n/es';
import Home from '../pages/index.astro';
import { renderDocument } from '../tests/render';
import { initWaitlistForm } from './waitlist-form';

const { waitlist } = es;

type Fetcher = typeof fetch;

const VALID = {
  email: 'juan@example.com',
  municipality: 'Madrid',
  homeType: 'piso',
  lookingFor: 'Un ático con terraza',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Formulario de la lista de espera', () => {
  let doc: Document;

  const form = () => doc.querySelector<HTMLFormElement>('#waitlist-form')!;
  const field = (id: string) => doc.querySelector<HTMLInputElement>(`#waitlist-${id}`)!;
  const error = (id: string) => doc.querySelector<HTMLElement>(`#waitlist-${id}-error`)!;
  const submit = () => doc.querySelector<HTMLButtonElement>('#waitlist-submit')!;
  const success = () => doc.querySelector<HTMLElement>('#waitlist-success')!;
  const failure = () => doc.querySelector<HTMLElement>('#waitlist-failure')!;
  const fire = (target: Element, type: string) =>
    target.dispatchEvent(
      new (doc.defaultView as unknown as { Event: typeof Event }).Event(type, {
        bubbles: true,
        cancelable: true,
      }),
    );
  const fillValid = () => {
    field('email').value = VALID.email;
    field('municipality').value = VALID.municipality;
    field('home-type').value = VALID.homeType;
    field('looking-for').value = VALID.lookingFor;
    field('consent').checked = true;
  };
  const send = () => fire(form(), 'submit');
  const accepted = () => Promise.resolve(new Response(null, { status: 202 }));

  beforeEach(async () => {
    doc = await renderDocument(Home);
    // linkedom no implementa `value` en <select>: se reproduce lo que hace el navegador
    let chosen = '';
    Object.defineProperty(field('home-type'), 'value', {
      get: () => chosen,
      set: (value: string) => {
        chosen = value;
      },
      configurable: true,
    });
  });

  it('el formulario vive en la sección #lista-de-espera con todos sus campos etiquetados', () => {
    const section = doc.querySelector('#lista-de-espera')!;

    expect(section.contains(form())).toBe(true);
    for (const id of ['email', 'municipality', 'home-type', 'looking-for', 'consent']) {
      const label = doc.querySelector(`label[for="waitlist-${id}"]`);
      expect(label?.textContent.trim().length, id).toBeGreaterThan(2);
      expect(field(id), id).not.toBeNull();
    }
    expect(doc.querySelector('#waitlist-home-type')!.querySelectorAll('option').length).toBe(10);
  });

  it('la casilla de privacidad enlaza con la política', () => {
    const link = doc.querySelector('label[for="waitlist-consent"] a');

    expect(link?.getAttribute('href')).toBe(es.legal.pages.privacy.path);
  });

  it('Scenario: Error de validación en un campo - al salir del campo vacío se muestra el error debajo, asociado a él', () => {
    initWaitlistForm(doc, { apiUrl: 'https://api.test', fetch: vi.fn<Fetcher>() });

    fire(field('municipality'), 'focusout');

    expect(error('municipality').hidden).toBe(false);
    expect(error('municipality').textContent.trim()).toBe(waitlist.errors.municipality.required);
    expect(field('municipality').getAttribute('aria-describedby')).toBe(
      'waitlist-municipality-error',
    );
    expect(field('municipality').getAttribute('aria-invalid')).toBe('true');
  });

  it('Scenario: Error de validación en un campo - un campo aún sin tocar no muestra error', () => {
    initWaitlistForm(doc, { apiUrl: 'https://api.test', fetch: vi.fn<Fetcher>() });

    fire(field('municipality'), 'focusout');

    expect(error('email').hidden).toBe(true);
    expect(field('email').hasAttribute('aria-invalid')).toBe(false);
    expect(field('email').hasAttribute('aria-describedby')).toBe(false);
  });

  it('el error desaparece en cuanto el valor es correcto', () => {
    initWaitlistForm(doc, { apiUrl: 'https://api.test', fetch: vi.fn<Fetcher>() });
    fire(field('email'), 'focusout');
    expect(error('email').hidden).toBe(false);

    field('email').value = 'juan@example.com';
    fire(field('email'), 'input');

    expect(error('email').hidden).toBe(true);
    expect(field('email').hasAttribute('aria-invalid')).toBe(false);
    expect(field('email').hasAttribute('aria-describedby')).toBe(false);
  });

  it('cada campo muestra su propio mensaje según la causa', () => {
    initWaitlistForm(doc, { apiUrl: 'https://api.test', fetch: vi.fn<Fetcher>() });
    field('email').value = 'juan@';
    field('consent').checked = false;

    fire(field('email'), 'focusout');
    fire(field('consent'), 'focusout');
    fire(field('home-type'), 'focusout');
    field('looking-for').value = 'x'.repeat(501);
    fire(field('looking-for'), 'focusout');

    expect(error('email').textContent.trim()).toBe(waitlist.errors.email.invalid);
    expect(error('consent').textContent.trim()).toBe(waitlist.errors.consent.invalid);
    expect(error('home-type').textContent.trim()).toBe(waitlist.errors.homeType.invalid);
    expect(error('looking-for').textContent.trim()).toBe(waitlist.errors.lookingFor.too_long);
  });

  it('Scenario: Error de validación en un campo - al enviar con errores se muestran todos y no se llama a la API', () => {
    const fetcher = vi.fn<Fetcher>();
    initWaitlistForm(doc, { apiUrl: 'https://api.test', fetch: fetcher });

    send();

    for (const id of ['email', 'municipality', 'home-type', 'looking-for', 'consent']) {
      expect(error(id).hidden, id).toBe(false);
      expect(field(id).getAttribute('aria-describedby'), id).toBe(`waitlist-${id}-error`);
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(submit().disabled).toBe(false);
  });

  it('Scenario: Envío correcto - el botón queda deshabilitado mientras se envía y no se envía dos veces', async () => {
    const pending = deferred<Response>();
    const fetcher = vi.fn<Fetcher>(() => pending.promise);
    initWaitlistForm(doc, { apiUrl: 'https://api.test', fetch: fetcher });
    fillValid();

    send();
    send();

    expect(submit().disabled).toBe(true);
    expect(submit().textContent.trim()).toBe(waitlist.sending);
    expect(form().getAttribute('aria-busy')).toBe('true');
    expect(fetcher).toHaveBeenCalledTimes(1);

    pending.resolve(new Response(null, { status: 202 }));
    await vi.waitFor(() => expect(success().textContent.trim()).not.toBe(''));
  });

  it('Scenario: Envío correcto - se muestra la confirmación en una región que se anuncia', async () => {
    initWaitlistForm(doc, { apiUrl: 'https://api.test', fetch: vi.fn<Fetcher>(accepted) });
    fillValid();

    send();

    await vi.waitFor(() => expect(success().textContent.trim()).not.toBe(''));
    expect(success().textContent).toContain(waitlist.success.title);
    expect(success().getAttribute('role')).toBe('status');
    expect(success().getAttribute('aria-live')).toBe('polite');
    expect(failure().textContent.trim()).toBe('');
    expect(form().hidden).toBe(true);
  });

  it('Scenario: Envío correcto - la región de confirmación existe, vacía, antes del envío para que se anuncie', () => {
    initWaitlistForm(doc, { apiUrl: 'https://api.test', fetch: vi.fn<Fetcher>() });

    expect(success().isConnected).toBe(true);
    expect(success().textContent.trim()).toBe('');
    expect(form().contains(success())).toBe(false);
  });

  it('envía al servidor los datos recortados y con el consentimiento', async () => {
    const fetcher = vi.fn<Fetcher>(accepted);
    initWaitlistForm(doc, { apiUrl: 'https://api.test', fetch: fetcher });
    fillValid();
    field('email').value = '  juan@example.com ';

    send();

    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetcher.mock.calls[0]![1]!.body as string) as unknown;
    expect(body).toEqual({ ...VALID, consent: true });
  });

  it('Scenario: Fallo de red o límite superado - con un 429 se invita a reintentarlo y los datos se conservan', async () => {
    const fetcher = vi.fn<Fetcher>(() => Promise.resolve(new Response('{}', { status: 429 })));
    initWaitlistForm(doc, { apiUrl: 'https://api.test', fetch: fetcher });
    fillValid();

    send();

    await vi.waitFor(() => expect(failure().textContent.trim()).not.toBe(''));
    expect(failure().textContent).toContain(waitlist.rateLimited);
    expect(failure().getAttribute('role')).toBe('alert');
    expect(field('email').value).toBe(VALID.email);
    expect(field('municipality').value).toBe(VALID.municipality);
    expect(field('consent').checked).toBe(true);
    expect(form().hidden).toBe(false);
    expect(submit().disabled).toBe(false);
    expect(submit().textContent.trim()).toBe(waitlist.submit);
    expect(success().textContent.trim()).toBe('');
  });

  it('Scenario: Fallo de red o límite superado - si la API no responde se explica y se puede reintentar', async () => {
    const fetcher = vi.fn<Fetcher>(() => Promise.reject(new TypeError('Failed to fetch')));
    initWaitlistForm(doc, { apiUrl: 'https://api.test', fetch: fetcher });
    fillValid();

    send();

    await vi.waitFor(() => expect(failure().textContent.trim()).not.toBe(''));
    expect(failure().textContent).toContain(waitlist.unavailable);
    expect(field('email').value).toBe(VALID.email);
    expect(submit().disabled).toBe(false);

    fetcher.mockImplementationOnce(accepted);
    send();
    await vi.waitFor(() => expect(success().textContent.trim()).not.toBe(''));
    expect(failure().textContent.trim()).toBe('');
  });

  it('el mensaje de fallo se retira al volver a enviar', async () => {
    const pending = deferred<Response>();
    const fetcher = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockReturnValueOnce(pending.promise);
    initWaitlistForm(doc, { apiUrl: 'https://api.test', fetch: fetcher });
    fillValid();
    send();
    await vi.waitFor(() => expect(failure().textContent.trim()).not.toBe(''));

    send();

    expect(failure().textContent.trim()).toBe('');
    pending.resolve(new Response(null, { status: 202 }));
    await vi.waitFor(() => expect(success().textContent.trim()).not.toBe(''));
  });

  it('los errores de campo que devuelve la API se muestran junto a cada campo', async () => {
    const fetcher = vi.fn<Fetcher>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ errors: [{ field: 'email', message: 'invalid' }] }), {
          status: 400,
        }),
      ),
    );
    initWaitlistForm(doc, { apiUrl: 'https://api.test', fetch: fetcher });
    fillValid();

    send();

    await vi.waitFor(() => expect(error('email').hidden).toBe(false));
    expect(error('email').textContent.trim()).toBe(waitlist.errors.email.invalid);
    expect(field('email').getAttribute('aria-invalid')).toBe('true');
    expect(submit().disabled).toBe(false);
  });

  it('deshacer el controlador deja de reaccionar a los eventos', () => {
    const dispose = initWaitlistForm(doc, { apiUrl: 'https://api.test', fetch: vi.fn<Fetcher>() });
    dispose();

    fire(field('municipality'), 'focusout');

    expect(error('municipality').hidden).toBe(true);
  });

  it('sin formulario en la página no hace nada', () => {
    const empty = parseHTML('<html><body></body></html>').document;

    expect(() => initWaitlistForm(empty, { apiUrl: 'https://api.test' })()).not.toThrow();
  });
});
