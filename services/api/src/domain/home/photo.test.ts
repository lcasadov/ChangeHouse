import { describe, expect, it } from 'vitest';

import { HomeMinPhotosError, PhotoLimitReachedError } from './errors.js';
import {
  assertCanAddPhoto,
  assertCanDeletePhoto,
  firstFreePosition,
  type HomePhoto,
  MAX_PHOTOS,
  MIN_PHOTOS,
} from './photo.js';

const photo = (overrides: Partial<HomePhoto> = {}): HomePhoto => ({
  id: 'photo-1',
  homeId: 'home-1',
  status: 'ready',
  storagePath: 'homes/home-1/photo-1.webp',
  position: 1,
  createdAt: new Date('2026-10-19T10:00:00.000Z'),
  ...overrides,
});

describe('límites de fotos', () => {
  it('una vivienda admite de 3 a 20 fotos', () => {
    expect([MIN_PHOTOS, MAX_PHOTOS]).toEqual([3, 20]);
  });
});

describe('firstFreePosition', () => {
  it('sin fotos es la primera posición', () => {
    expect(firstFreePosition([])).toBe(1);
  });

  it('ocupa el primer hueco que dejó una foto borrada, estén o no en orden', () => {
    expect(firstFreePosition([1, 2, 3])).toBe(4);
    expect(firstFreePosition([3, 1, 4])).toBe(2);
  });

  it('con las 20 posiciones ocupadas no hay hueco', () => {
    const all = Array.from({ length: MAX_PHOTOS }, (_, index) => index + 1);

    expect(firstFreePosition(all)).toBeNull();
  });
});

describe('assertCanAddPhoto', () => {
  it('Scenario: Límite de 20 fotos - con 19 todavía cabe una; con 20 lanza PhotoLimitReachedError', () => {
    expect(() => {
      assertCanAddPhoto(19);
    }).not.toThrow();
    expect(() => {
      assertCanAddPhoto(20);
    }).toThrow(PhotoLimitReachedError);
  });
});

describe('assertCanDeletePhoto', () => {
  it('Scenario: Borrar por debajo del mínimo en una vivienda publicada - con 3 fotos listas lanza HomeMinPhotosError', () => {
    expect(() => {
      assertCanDeletePhoto('published', photo(), 3);
    }).toThrow(HomeMinPhotosError);
  });

  it.each(['in_review', 'paused'] as const)(
    'una vivienda en %s tampoco puede bajar de 3 fotos',
    (status) => {
      expect(() => {
        assertCanDeletePhoto(status, photo(), 3);
      }).toThrow(HomeMinPhotosError);
    },
  );

  it('con 4 fotos listas se puede borrar una en una vivienda publicada', () => {
    expect(() => {
      assertCanDeletePhoto('published', photo(), 4);
    }).not.toThrow();
  });

  it('un borrador puede quedarse sin fotos', () => {
    expect(() => {
      assertCanDeletePhoto('draft', photo(), 1);
    }).not.toThrow();
  });

  it('una foto pendiente no cuenta: borrarla nunca baja del mínimo', () => {
    expect(() => {
      assertCanDeletePhoto('published', photo({ status: 'pending', position: null }), 3);
    }).not.toThrow();
  });
});
