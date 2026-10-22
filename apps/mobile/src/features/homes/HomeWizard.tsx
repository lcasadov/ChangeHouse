import { useTheme } from '@changehouse/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FormScreen, Notice, ProgressBar, Text } from '../../ui';
import { LoadingView } from '../session/LoadingView';
import { CharacteristicsStep } from './CharacteristicsStep';
import { firstIncompleteStep, TOTAL_STEPS, type WizardStep } from './home-form';
import { homeRoutes } from './home-routes';
import type { Home } from './homes-api';
import { HomesApiError } from './homes-api';
import { LocationStep } from './LocationStep';
import { ReviewStep } from './ReviewStep';
import type { StepProps } from './steps';
import { TypeStep } from './TypeStep';
import { useHome } from './use-homes';
import { ValueStep } from './ValueStep';

const STEP_TITLES = {
  1: 'homes.wizard.steps.type',
  2: 'homes.wizard.steps.features',
  3: 'homes.wizard.steps.value',
  4: 'homes.wizard.steps.location',
  5: 'homes.review.title',
} as const satisfies Record<WizardStep, string>;

const asStep = (value: number): WizardStep =>
  Math.min(Math.max(value, 1), TOTAL_STEPS) as WizardStep;

/** El paso que pide la ruta (`?step=3`), si es válido. */
function requestedStep(param: string | undefined): WizardStep | undefined {
  const step = Number(param);
  return Number.isInteger(step) && step >= 1 && step <= TOTAL_STEPS ? asStep(step) : undefined;
}

interface WizardBodyProps {
  home: Home | undefined;
  initialStep: WizardStep;
}

/** Los cinco pasos con su progreso. El avance se guarda en cada paso; salir nunca pierde datos. */
function WizardBody({ home, initialStep }: Readonly<WizardBodyProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(initialStep);

  const exit = () => {
    router.dismissTo(homeRoutes.list);
  };
  const goTo = (target: number) => {
    setStep(asStep(target));
  };
  const saved = (savedHome: Home) => {
    // El primer paso del alta crea la vivienda: desde ahí el asistente trabaja sobre ella
    if (home) goTo(step + 1);
    else router.replace(homeRoutes.edit(savedHome.id));
  };

  const stepProps: StepProps = {
    home,
    onSaved: saved,
    onBack:
      step > 1
        ? () => {
            goTo(step - 1);
          }
        : undefined,
    onExit: exit,
  };

  return (
    <FormScreen>
      <ProgressBar
        label={t('homes.wizard.step', { current: step, total: TOTAL_STEPS })}
        now={step}
        max={TOTAL_STEPS}
      />
      <Text variant="title" accessibilityRole="header">
        {t(STEP_TITLES[step])}
      </Text>
      {step === 1 ? <Text tone="textMuted">{t('homes.wizard.intro')}</Text> : null}
      <View style={{ gap: theme.space[4] }}>
        {step === 1 ? <TypeStep {...stepProps} /> : null}
        {step === 2 ? <CharacteristicsStep {...stepProps} /> : null}
        {step === 3 ? <ValueStep {...stepProps} /> : null}
        {step === 4 ? <LocationStep {...stepProps} /> : null}
        {step === 5 && home ? (
          <ReviewStep
            home={home}
            onSubmitted={(submitted) => {
              router.replace(homeRoutes.detail(submitted.id));
            }}
            onComplete={goTo}
            onBack={() => {
              goTo(step - 1);
            }}
            onExit={exit}
          />
        ) : null}
      </View>
    </FormScreen>
  );
}

/**
 * Asistente de alta de una vivienda en cinco pasos. Sin `homeId` empieza una nueva; con él continúa
 * el borrador por `step` (o por el primer paso con datos por rellenar).
 */
export function HomeWizard({ homeId, step }: Readonly<{ homeId?: string; step?: string }>) {
  const { t } = useTranslation();
  const query = useHome(homeId);

  if (homeId === undefined) return <WizardBody home={undefined} initialStep={1} />;
  if (query.isPending) return <LoadingView />;
  if (!query.data) {
    const notFound = query.error instanceof HomesApiError && query.error.kind === 'not-found';
    return (
      <FormScreen>
        <Notice
          tone="danger"
          action={
            notFound
              ? undefined
              : {
                  label: t('homes.retry'),
                  onPress: () => {
                    query.refetch().catch(() => undefined);
                  },
                }
          }
        >
          {t(notFound ? 'homes.wizard.notFound' : 'homes.wizard.loadFailed')}
        </Notice>
      </FormScreen>
    );
  }
  return (
    <WizardBody
      key={query.data.id}
      home={query.data}
      initialStep={requestedStep(step) ?? firstIncompleteStep(query.data)}
    />
  );
}
