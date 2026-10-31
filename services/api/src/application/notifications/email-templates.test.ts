import { describe, expect, it } from 'vitest';

import { matchClosedEmail, matchCreatedEmail } from './email-templates.js';

const LINK = 'https://app.changehouse.test/match/m-1';

describe('matchCreatedEmail', () => {
  it('Scenario: Email de nuevo match - asunto, enlace a la app en el botón y en el texto, en español', () => {
    const email = matchCreatedEmail({ to: 'ana@example.com', link: LINK });

    expect(email.to).toBe('ana@example.com');
    expect(email.subject).toBe('Tienes un match en ChangeHouse');
    expect(email.html).toContain(`<a href="${LINK}"`);
    expect(email.html).toContain('<html lang="es">');
    expect(email.html).toContain('ChangeHouse');
    expect(email.text).toContain(LINK);
    expect(email.text).toContain('ChangeHouse');
  });

  it('GIVEN un match nuevo WHEN se genera el email THEN no incluye importes ni datos de contacto', () => {
    const email = matchCreatedEmail({ to: 'ana@example.com', link: LINK });

    for (const body of [email.html, email.text, email.subject]) {
      expect(body).not.toMatch(/€|euro/i);
      expect(body).not.toMatch(/tel[ée]fono|calle|direcci[oó]n/i);
    }
  });

  it('el HTML es accesible: título, idioma, un solo encabezado de primer nivel y el botón es un enlace con texto', () => {
    const { html } = matchCreatedEmail({ to: 'ana@example.com', link: LINK });

    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toMatch(/<a href="[^"]+"[^>]*>[^<]+<\/a>/);
    expect(html).not.toContain('<img');
  });

  it('escapa el enlace y la dirección de destino no se inserta en el HTML', () => {
    const email = matchCreatedEmail({
      to: 'ana@example.com',
      link: 'https://a.test/?x="><script>',
    });

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&quot;&gt;&lt;script&gt;');
    expect(email.html).not.toContain('ana@example.com');
  });
});

describe('matchClosedEmail', () => {
  it('avisa del cierre con el enlace a la app y sin importes', () => {
    const email = matchClosedEmail({ to: 'beto@example.com', link: LINK });

    expect(email.subject).toBe('Tu match de ChangeHouse se ha cerrado');
    expect(email.html).toContain(`<a href="${LINK}"`);
    expect(email.text).toContain(LINK);
    expect(email.html + email.text).not.toMatch(/€|euro/i);
  });
});
