import { themes, touchTarget } from '@changehouse/ui';
import { fireEvent, screen, within } from '@testing-library/react-native';

import es from '../../i18n/locales/es-ES.json';
import { renderThemed, styleOf, THEME_NAMES } from '../../test-utils';
import { DecisionActions, type DecisionActionsProps } from './DecisionActions';

const a = es.discovery.actions;

async function setup(overrides: Partial<DecisionActionsProps> = {}) {
  const props: DecisionActionsProps = {
    canUndo: true,
    onDismiss: jest.fn(),
    onUndo: jest.fn(),
    onLike: jest.fn(),
    ...overrides,
  };
  await renderThemed(<DecisionActions {...props} />, 'light');
  return props;
}

const sizeOf = (label: string) => {
  const style = styleOf(screen.getByRole('button', { name: label }));
  return Math.min(Number(style.minHeight ?? style.height), Number(style.minWidth ?? style.width));
};

describe('DecisionActions', () => {
  it('muestra Descartar, Deshacer y Me gusta, en ese orden, con su etiqueta visible y accesible', async () => {
    await setup();

    const buttons = screen.getAllByRole('button');

    expect(buttons.map((button) => button.props.accessibilityLabel as string)).toEqual([
      a.dismiss,
      a.undo,
      a.like,
    ]);
    for (const label of [a.dismiss, a.undo, a.like]) {
      expect(within(screen.getByRole('button', { name: label })).getByText(label)).toBeTruthy();
    }
  });

  it('cada botón dispara su acción', async () => {
    const props = await setup();

    await fireEvent.press(screen.getByRole('button', { name: a.dismiss }));
    await fireEvent.press(screen.getByRole('button', { name: a.undo }));
    await fireEvent.press(screen.getByRole('button', { name: a.like }));

    expect(props.onDismiss).toHaveBeenCalledTimes(1);
    expect(props.onUndo).toHaveBeenCalledTimes(1);
    expect(props.onLike).toHaveBeenCalledTimes(1);
  });

  it('Deshacer está deshabilitado, y se anuncia así, cuando no hay nada que deshacer', async () => {
    const props = await setup({ canUndo: false });
    const undo = screen.getByRole('button', { name: a.undo });

    await fireEvent.press(undo);

    expect(undo.props.accessibilityState).toMatchObject({ disabled: true });
    expect(props.onUndo).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: a.like }).props.accessibilityState).toMatchObject({
      disabled: false,
    });
  });

  it('sin tarjeta sobre la que decidir, Descartar y Me gusta se deshabilitan y Deshacer sigue disponible', async () => {
    const props = await setup({ canDecide: false });

    await fireEvent.press(screen.getByRole('button', { name: a.like }));
    await fireEvent.press(screen.getByRole('button', { name: a.dismiss }));
    await fireEvent.press(screen.getByRole('button', { name: a.undo }));

    expect(props.onLike).not.toHaveBeenCalled();
    expect(props.onDismiss).not.toHaveBeenCalled();
    expect(props.onUndo).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: a.like }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('los tres botones superan el objetivo táctil mínimo y Descartar y Me gusta son los grandes', async () => {
    await setup();

    expect(sizeOf(a.undo)).toBeGreaterThanOrEqual(touchTarget);
    expect(sizeOf(a.dismiss)).toBeGreaterThan(touchTarget);
    expect(sizeOf(a.like)).toBeGreaterThan(touchTarget);
    expect(sizeOf(a.like)).toBeGreaterThan(sizeOf(a.undo));
  });

  it.each(THEME_NAMES)('en el tema %s Me gusta usa la acción principal del tema', async (theme) => {
    await renderThemed(
      <DecisionActions canUndo onDismiss={jest.fn()} onUndo={jest.fn()} onLike={jest.fn()} />,
      theme,
    );

    expect(styleOf(screen.getByRole('button', { name: a.like })).backgroundColor).toBe(
      themes[theme].color.primary,
    );
  });
});
