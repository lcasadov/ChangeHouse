import { themes } from '@changehouse/ui';
import { fireEvent, screen } from '@testing-library/react-native';
import { processColor } from 'react-native';

import es from '../../i18n/locales/es-ES.json';
import { discoveryCard } from '../../test-support/fake-discovery';
import { renderThemed, styleOf, THEME_NAMES } from '../../test-utils';
import { formatEuros } from '../homes/home-form';
import type { Compensation } from './discovery-api';
import { DiscoveryCardView } from './DiscoveryCardView';

const d = es.discovery;

const PAY: Compensation = { kind: 'pay', amountCents: 1_200_000 };
const RECEIVE: Compensation = { kind: 'receive', amountCents: 800_000 };
const FAIR: Compensation = { kind: 'fair', amountCents: 150_000 };

const pillLabel = (compensation: Compensation) =>
  compensation.kind === 'fair'
    ? d.compensation.fair
    : d.compensation[compensation.kind].replace(
        '{{amount}}',
        formatEuros(compensation.amountCents),
      );

const photoUri = () =>
  (screen.getByTestId('discovery-photo').props.source as { uri: string }[])[0]?.uri;

describe('píldora de compensación', () => {
  describe.each(THEME_NAMES)('tema %s', (theme) => {
    it.each([
      [PAY, 'compensationPay'],
      [RECEIVE, 'compensationReceive'],
      [FAIR, 'compensationEven'],
    ] as const)('muestra %j con el token %s', async (compensation, token) => {
      await renderThemed(
        <DiscoveryCardView card={discoveryCard({ compensation })} onOpen={jest.fn()} />,
        theme,
      );

      const pill = screen.getByTestId('compensation-pill');
      const label = screen.getByText(pillLabel(compensation));

      expect(styleOf(pill).backgroundColor).toBe(themes[theme].color[token]);
      expect(styleOf(label).color).toBe(themes[theme].color.textOnPrimary);
    });
  });

  it('«Tú pagas 12.000 €»: dice el importe exacto y que es una estimación orientativa', async () => {
    await renderThemed(
      <DiscoveryCardView card={discoveryCard({ compensation: PAY })} onOpen={jest.fn()} />,
    );

    expect(screen.getByText(`Tú pagas ${formatEuros(1_200_000)}`)).toBeTruthy();
    expect(screen.getByText(d.compensation.disclaimer)).toBeTruthy();
  });

  it('«Cambio justo» no enseña el importe de la diferencia', async () => {
    await renderThemed(
      <DiscoveryCardView card={discoveryCard({ compensation: FAIR })} onOpen={jest.fn()} />,
    );

    expect(screen.getByText(d.compensation.fair)).toBeTruthy();
    expect(screen.queryByText(new RegExp(formatEuros(150_000)))).toBeNull();
  });

  it('en modo buscador (sin compensación) no hay píldora ni aviso de estimación', async () => {
    await renderThemed(
      <DiscoveryCardView card={discoveryCard({ compensation: null })} onOpen={jest.fn()} />,
    );

    expect(screen.queryByTestId('compensation-pill')).toBeNull();
    expect(screen.queryByText(d.compensation.disclaimer)).toBeNull();
  });
});

describe('datos de la vivienda', () => {
  it('muestra la zona, los metros, los dormitorios y los baños sobre el degradado, con el texto sobre foto', async () => {
    await renderThemed(
      <DiscoveryCardView
        card={discoveryCard({ usefulM2: 82, bedrooms: 3, bathrooms: 2 })}
        onOpen={jest.fn()}
      />,
      'dark',
    );

    const title = screen.getByText(
      es.homes.card.title.replace('{{type}}', es.homes.type.piso).replace('{{area}}', 'Lavapiés'),
    );
    expect(styleOf(title).color).toBe(themes.dark.color.textOnPhoto);
    expect(screen.getByText('82 m²')).toBeTruthy();
    expect(screen.getByText('3 dormitorios')).toBeTruthy();
    expect(screen.getByText('2 baños')).toBeTruthy();
    // El degradado convierte los colores al formato nativo
    expect(screen.getByTestId('photo-scrim').props.colors).toEqual([
      processColor(themes.dark.color.photoScrimStart),
      processColor(themes.dark.color.photoScrimEnd),
    ]);
  });

  it('usa el singular y omite lo que la API no informa', async () => {
    await renderThemed(
      <DiscoveryCardView
        card={discoveryCard({ usefulM2: null, builtM2: null, bedrooms: 1, bathrooms: null })}
        onOpen={jest.fn()}
      />,
    );

    expect(screen.getByText('1 dormitorio')).toBeTruthy();
    expect(screen.queryByText(/m²/)).toBeNull();
    expect(screen.queryByText(/baño/)).toBeNull();
  });
});

describe('accesibilidad', () => {
  it('la tarjeta es un único elemento con el resumen completo y abre el detalle', async () => {
    const onOpen = jest.fn();
    await renderThemed(
      <DiscoveryCardView card={discoveryCard({ compensation: PAY })} onOpen={onOpen} />,
    );

    const card = screen.getByRole('button', { name: /Piso en Lavapiés/ });
    const label = card.props.accessibilityLabel as string;

    for (const part of [
      '82 m²',
      '3 dormitorios',
      '2 baños',
      pillLabel(PAY),
      d.compensation.disclaimer,
      'Foto 1 de 3',
    ]) {
      expect(label).toContain(part);
    }
    expect(card.props.accessibilityHint).toBe(d.card.openHint);

    await fireEvent.press(card);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('las fotos y el indicador no se anuncian por separado: ya van en el resumen', async () => {
    await renderThemed(<DiscoveryCardView card={discoveryCard()} onOpen={jest.fn()} />);

    expect(screen.getByTestId('discovery-photo').props.accessible).toBe(false);
    // Oculto a los productos de apoyo: se consulta incluyendo lo oculto
    const indicator = screen.getByTestId('photo-indicator', { includeHiddenElements: true });
    expect(indicator.props.accessible).toBe(false);
    expect(indicator.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});

describe('carrusel de fotos', () => {
  it('los botones laterales recorren las fotos y el resumen sigue la posición', async () => {
    const card = discoveryCard({ photoCount: 3 });
    await renderThemed(<DiscoveryCardView card={card} onOpen={jest.fn()} />);
    expect(photoUri()).toBe(card.photos[0]?.url);

    await fireEvent.press(screen.getByRole('button', { name: d.photos.next }));
    expect(photoUri()).toBe(card.photos[1]?.url);
    expect(screen.getByRole('button', { name: /Foto 2 de 3/ })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: d.photos.next }));
    expect(photoUri()).toBe(card.photos[2]?.url);

    await fireEvent.press(screen.getByRole('button', { name: d.photos.previous }));
    expect(photoUri()).toBe(card.photos[1]?.url);
  });

  it('en los extremos el botón correspondiente queda deshabilitado y no se sale de la lista', async () => {
    const card = discoveryCard({ photoCount: 2 });
    await renderThemed(<DiscoveryCardView card={card} onOpen={jest.fn()} />);

    const previous = screen.getByRole('button', { name: d.photos.previous });
    expect(previous.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(previous);
    expect(photoUri()).toBe(card.photos[0]?.url);

    await fireEvent.press(screen.getByRole('button', { name: d.photos.next }));
    const next = screen.getByRole('button', { name: d.photos.next });
    expect(next.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(next);
    expect(photoUri()).toBe(card.photos[1]?.url);
  });

  it('el indicador tiene un tramo por foto y marca la actual además del color', async () => {
    await renderThemed(
      <DiscoveryCardView card={discoveryCard({ photoCount: 4 })} onOpen={jest.fn()} />,
    );
    // El indicador está oculto a los productos de apoyo: se consulta incluyendo lo oculto
    const hidden = { includeHiddenElements: true };

    expect(screen.getAllByTestId(/^photo-indicator-segment-/, hidden)).toHaveLength(4);
    const growOf = (index: number) =>
      styleOf(screen.getByTestId(`photo-indicator-segment-${String(index)}`, hidden)).flexGrow;
    expect(growOf(0)).not.toBe(growOf(1));

    await fireEvent.press(screen.getByRole('button', { name: d.photos.next }));

    expect(growOf(1)).not.toBe(growOf(0));
    expect(growOf(0)).toBe(growOf(2));
  });

  it('los botones laterales miden al menos el objetivo táctil de 44 pt', async () => {
    await renderThemed(<DiscoveryCardView card={discoveryCard()} onOpen={jest.fn()} />);

    const next = styleOf(screen.getByRole('button', { name: d.photos.next }));

    expect(next.minWidth).toBeGreaterThanOrEqual(44);
    expect(next.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('con una sola foto no hay carrusel ni indicador', async () => {
    await renderThemed(
      <DiscoveryCardView card={discoveryCard({ photoCount: 1 })} onOpen={jest.fn()} />,
    );

    expect(screen.queryByRole('button', { name: d.photos.next })).toBeNull();
    expect(screen.queryByRole('button', { name: d.photos.previous })).toBeNull();
    expect(screen.queryByTestId('photo-indicator')).toBeNull();
  });

  it('sin fotos reserva el espacio con un marcador en lugar de romperse', async () => {
    await renderThemed(
      <DiscoveryCardView card={discoveryCard({ photoCount: 0 })} onOpen={jest.fn()} />,
    );

    expect(screen.queryByTestId('discovery-photo')).toBeNull();
    expect(screen.getByText(es.homes.card.noPhotos)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Piso en Lavapiés/ })).toBeTruthy();
  });
});
