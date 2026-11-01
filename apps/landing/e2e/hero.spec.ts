import { expect, type Page, test } from '@playwright/test';

import { rejectCookies } from './fixtures';

const isPaused = (page: Page) =>
  page.locator('#hero-video').evaluate((video: HTMLVideoElement) => video.paused);

test.describe('Presentación de la propuesta de valor', () => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    test(`Scenario: Primera pantalla - titular, frase y botón sobre el fondo sin desplazar (${viewport.width} px)`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await rejectCookies(page);

      for (const locator of [
        page.getByRole('heading', { level: 1, name: 'Cambia de casa sin vender primero' }),
        page.locator('#inicio .subtitle'),
        page.locator('#inicio').getByRole('link', { name: 'Apúntate a la lista de espera' }),
      ]) {
        const box = await locator.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      }
      const hero = await page.locator('#inicio').boundingBox();
      expect(hero!.height).toBeGreaterThanOrEqual(viewport.height * 0.85);
    });
  }

  test('Scenario: Texto legible sobre el fondo - el titular es blanco sobre el velo', async ({
    page,
  }) => {
    await page.goto('/');
    const color = await page
      .getByRole('heading', { level: 1 })
      .evaluate((h1) => getComputedStyle(h1).color);
    expect(color).toBe('rgb(255, 255, 255)');
    const veil = await page
      .locator('#inicio .hero-veil')
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(veil).toBe('rgba(12, 16, 28, 0.58)');
  });
});

test.describe('Vídeo de fondo del héroe', () => {
  test('Scenario: Reproducción por defecto - se reproduce silenciado y oculto a los lectores', async ({
    page,
  }) => {
    await page.goto('/');
    const video = page.locator('#hero-video');
    await expect(video).toHaveAttribute('aria-hidden', 'true');
    await expect.poll(() => isPaused(page)).toBe(false);
    expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
    await expect(page.locator('#hero-video-toggle')).toHaveAccessibleName(
      'Pausar el vídeo de fondo',
    );
  });

  test('Scenario: Pausar y reanudar - con el teclado', async ({ page }) => {
    await page.goto('/');
    await rejectCookies(page);
    const toggle = page.locator('#hero-video-toggle');
    await expect.poll(() => isPaused(page)).toBe(false);

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => isPaused(page)).toBe(true);
    await expect(toggle).toHaveAccessibleName('Reproducir el vídeo de fondo');
    await expect(page.locator('#hero-video-status')).toHaveText('Vídeo de fondo en pausa');

    await page.keyboard.press('Space');
    await expect.poll(() => isPaused(page)).toBe(false);
    await expect(toggle).toHaveAccessibleName('Pausar el vídeo de fondo');
  });

  test.describe('con movimiento reducido', () => {
    test.use({ reducedMotion: 'reduce' });

    test('Scenario: Movimiento reducido - imagen fija y el control permite iniciarlo', async ({
      page,
    }) => {
      await page.goto('/');
      await rejectCookies(page);
      await page.waitForTimeout(500);
      expect(await isPaused(page)).toBe(true);
      const toggle = page.locator('#hero-video-toggle');
      await expect(toggle).toHaveAccessibleName('Reproducir el vídeo de fondo');
      await toggle.click();
      await expect.poll(() => isPaused(page)).toBe(false);
    });
  });

  test('el control mide al menos 44 px y es visible sin pasar el ratón', async ({ page }) => {
    await page.goto('/');
    const box = await page.locator('#hero-video-toggle').boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator('#hero-video-toggle')).toBeVisible();
  });
});

test.describe('Secciones con fotografía', () => {
  test('Scenario: Imágenes que no bloquean la carga - las fotos de abajo no se piden al abrir', async ({
    page,
  }) => {
    const requested: string[] = [];
    page.on('request', (request) => requested.push(new URL(request.url()).pathname));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(requested).toContain('/media/hero-poster.jpg');
    expect(requested).not.toContain('/media/lista-espera.jpg');

    await page.locator('#lista-de-espera').scrollIntoViewIfNeeded();
    await expect
      .poll(() => requested.includes('/media/lista-espera.jpg'), { timeout: 5000 })
      .toBe(true);
  });

  test('Scenario: Pasos con foto - las tres fotos se cargan al llegar a la sección', async ({
    page,
  }) => {
    await page.goto('/');
    await rejectCookies(page);
    await page.locator('#como-funciona').scrollIntoViewIfNeeded();
    const photos = page.locator('#como-funciona ol > li img');
    await expect(photos).toHaveCount(3);
    for (const photo of await photos.all()) {
      await expect(photo).toHaveJSProperty('complete', true);
      expect(await photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    }
  });
});
