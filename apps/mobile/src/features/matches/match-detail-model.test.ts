import { fakeChainMatchDetail, fakeMatchDetail } from '../../test-support/fake-matches';
import { detailViewOf } from './match-detail-model';

const MINE = 'home-mine';
const THEIRS = 'home-theirs';
const own = new Set([MINE]);

describe('detailViewOf', () => {
  it('reconoce la participación propia por sus viviendas y deja al resto en otros', () => {
    const view = detailViewOf(fakeMatchDetail({ mineHomeId: MINE, theirHomeId: THEIRS }), own);

    expect(view.mine?.homeId).toBe(MINE);
    expect(view.others.map((participant) => participant.homeId)).toEqual([THEIRS]);
  });

  it('un match open con mi estado pendiente permite confirmar, retirarse y compartir el teléfono', () => {
    const view = detailViewOf(fakeMatchDetail({ mineHomeId: MINE, theirHomeId: THEIRS }), own);

    expect(view).toMatchObject({
      canConfirm: true,
      hasConfirmed: false,
      canWithdraw: true,
      canSharePhone: true,
      showContact: true,
      confirmedCount: 0,
      total: 2,
    });
  });

  it('tras confirmar ya no se puede confirmar, pero sí retirarse', () => {
    const view = detailViewOf(
      fakeMatchDetail({ mineHomeId: MINE, theirHomeId: THEIRS, mineStatus: 'confirmed' }),
      own,
    );

    expect(view).toMatchObject({
      canConfirm: false,
      hasConfirmed: true,
      canWithdraw: true,
      confirmedCount: 1,
    });
  });

  it('un match confirmed solo admite retirarse y compartir el teléfono', () => {
    const view = detailViewOf(
      fakeMatchDetail({
        mineHomeId: MINE,
        theirHomeId: THEIRS,
        status: 'confirmed',
        mineStatus: 'confirmed',
        theirStatus: 'confirmed',
      }),
      own,
    );

    expect(view).toMatchObject({
      canConfirm: false,
      canWithdraw: true,
      canSharePhone: true,
      showContact: true,
      confirmedCount: 2,
    });
  });

  it.each(['closed', 'expired', 'in_operation'] as const)(
    'un match %s no admite ninguna acción ni enseña el contacto',
    (status) => {
      const view = detailViewOf(
        fakeMatchDetail({ mineHomeId: MINE, theirHomeId: THEIRS, status }),
        own,
      );

      expect(view).toMatchObject({
        canConfirm: false,
        canWithdraw: false,
        canSharePhone: false,
        showContact: false,
      });
    },
  );

  it('Scenario: Match cerrado sin datos de contacto - quien se ha retirado no ve contacto ni puede compartir su teléfono', () => {
    const view = detailViewOf(
      fakeMatchDetail({
        mineHomeId: MINE,
        theirHomeId: THEIRS,
        status: 'open',
        mineStatus: 'withdrawn',
      }),
      own,
    );

    expect(view).toMatchObject({ canSharePhone: false, showContact: false });
  });

  it('indica quién se ha retirado', () => {
    const view = detailViewOf(
      fakeMatchDetail({
        mineHomeId: MINE,
        theirHomeId: THEIRS,
        status: 'closed',
        theirStatus: 'withdrawn',
      }),
      own,
    );

    expect(view.withdrawn?.homeId).toBe(THEIRS);
  });

  it('sin saber cuál es mi vivienda no hay acciones y todos son otros', () => {
    const view = detailViewOf(
      fakeMatchDetail({ mineHomeId: MINE, theirHomeId: THEIRS }),
      new Set(['otra']),
    );

    expect(view.mine).toBeUndefined();
    expect(view.others).toHaveLength(2);
    expect(view).toMatchObject({ canConfirm: false, canWithdraw: false, canSharePhone: false });
  });

  it('une cada participante con la vivienda que entrega', () => {
    const detail = fakeMatchDetail({ mineHomeId: MINE, theirHomeId: THEIRS });
    const view = detailViewOf(detail, own);

    expect(view.homeOf(THEIRS)?.id).toBe(THEIRS);
    expect(view.homeOf('desconocida')).toBeUndefined();
  });
});

describe('detailViewOf de un match en cadena', () => {
  const A = 'home-c';
  const B = 'home-a';
  const C = 'home-b';
  const detail = fakeChainMatchDetail({ mineHomeId: A, fromHomeId: B, toHomeId: C });

  it('muestra las tres viviendas en el orden del ciclo empezando por la mía', () => {
    const view = detailViewOf(detail, new Set([A]));

    expect(view.isChain).toBe(true);
    expect(view.sections.map((participant) => participant.displayName)).toEqual([
      'Ana',
      'Beto',
      'Carla',
    ]);
    expect(view.total).toBe(3);
  });

  it('un match directo no es una cadena y conserva su orden', () => {
    const view = detailViewOf(fakeMatchDetail({ mineHomeId: A, theirHomeId: B }), new Set([A]));

    expect(view.isChain).toBe(false);
    expect(view.sections.map((participant) => participant.homeId)).toEqual([B, A]);
  });
});
