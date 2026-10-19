import { useTheme } from '@changehouse/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Dialog, FormScreen, Notice, ProgressBar, Text } from '../../ui';
import { LoadingView } from '../session/LoadingView';
import { CharacteristicsStep } from './CharacteristicsStep';
import { firstIncompleteStep, TOTAL_STEPS, type WizardStep } from './home-form';
import { homeRoutes } from './home-routes';
import type { Home } from './homes-api';
import { HomesApiError } from './homes-api';
import { LocationStep } from './LocationStep';
import { PhotosStep } from './PhotosStep';
import { ReviewStep } from './ReviewStep';
import type { StepProps } from './steps';
import { TypeStep } from './TypeStep';
import { UploadsBanner } from './UploadsBanner';
import { useHome } from './use-homes';
import { type PhotoUploads, usePhotoUploads } from './use-photo-uploads';
import { ValueStep } from './ValueStep';

const STEP_TITLES = {
  1: 'homes.wizard.steps.photos',
  2: 'homes.wizard.steps.type',
  3: 'homes.wizard.steps.features',
  4: 'homes.wizard.steps.value',
  5: 'homes.wizard.steps.location',
  6: 'homes.review.title',
} as const satisfies Record<WizardStep, string>;

const PHOTOS_STEP: WizardStep = 1;

const asStep = (value: number): WizardStep =>
  Math.min(Math.max(value, 1), TOTAL_STEPS) as WizardStep;

/** El paso que pide la ruta (`?step=3`), si es válido. */
function requestedStep(param: string | undefined): WizardStep | undefined {
  const step = Number(param);
  return Number.isInteger(step) && step >= 1 && step <= TOTAL_STEPS ? asStep(step) : undefined;
}

interface StepViewProps {
  step: WizardStep;
  home: Home | undefined;
  uploads: PhotoUploads;
  stepProps: StepProps;
  onGoTo: (step: number) => void;
  onSubmitted: (home: Home) => void;
}

/** El contenido del paso en curso. */
function StepView({
  step,
  home,
  uploads,
  stepProps,
  onGoTo,
  onSubmitted,
}: Readonly<StepViewProps>) {
  switch (step) {
    case 1:
      return (
        <PhotosStep
          home={home}
          uploads={uploads}
          onNext={() => {
            onGoTo(2);
          }}
          onExit={stepProps.onExit}
        />
      );
    case 2:
      return <TypeStep {...stepProps} />;
    case 3:
      return <CharacteristicsStep {...stepProps} />;
    case 4:
      return <ValueStep {...stepProps} />;
    case 5:
      return <LocationStep {...stepProps} />;
    default:
      return home ? (
        <ReviewStep
          home={home}
          onSubmitted={onSubmitted}
          onComplete={onGoTo}
          onBack={() => {
            onGoTo(step - 1);
          }}
          onExit={stepProps.onExit}
        />
      ) : null;
  }
}

interface WizardBodyProps {
  home: Home | undefined;
  initialStep: WizardStep;
  /** El primer paso con datos crea el borrador: desde ahí el asistente trabaja sobre él. */
  onCreated: (homeId: string) => void;
}

/**
 * Los seis pasos con su progreso. El avance se guarda en cada paso; salir nunca pierde datos
 * guardados. Las fotos elegidas antes de que exista el borrador esperan en el dispositivo y se suben
 * al crearlo, así que el asistente es quien las gestiona.
 */
function WizardBody({ home, initialStep, onCreated }: Readonly<WizardBodyProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const uploads = usePhotoUploads();
  const [step, setStep] = useState<WizardStep>(initialStep);
  const [confirmingExit, setConfirmingExit] = useState(false);
  // Una vivienda ya enviada solo permite gestionar sus fotos, no repetir el alta
  const photosOnly = home !== undefined && home.status !== 'draft';

  const leave = () => {
    router.dismissTo(homeRoutes.list);
  };
  const exit = () => {
    // Las fotos sin subir no se guardan en ningún sitio: se pide confirmación antes de perderlas
    if (uploads.items.length > 0) setConfirmingExit(true);
    else leave();
  };
  const goTo = (target: number) => {
    setStep(asStep(target));
  };
  const saved = (savedHome: Home) => {
    if (!home) {
      onCreated(savedHome.id);
      uploads.flush(savedHome.id);
    }
    goTo(step + 1);
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

  if (photosOnly) {
    return (
      <FormScreen>
        <Text variant="title" accessibilityRole="header">
          {t(STEP_TITLES[PHOTOS_STEP])}
        </Text>
        <PhotosStep
          home={home}
          uploads={uploads}
          onDone={() => {
            router.dismissTo(homeRoutes.detail(home.id));
          }}
        />
      </FormScreen>
    );
  }

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
      {step === PHOTOS_STEP ? null : (
        <UploadsBanner
          items={uploads.items}
          onShowPhotos={() => {
            goTo(PHOTOS_STEP);
          }}
        />
      )}
      <View style={{ gap: theme.space[4] }}>
        <StepView
          step={step}
          home={home}
          uploads={uploads}
          stepProps={stepProps}
          onGoTo={goTo}
          onSubmitted={(submitted) => {
            router.replace(homeRoutes.detail(submitted.id));
          }}
        />
      </View>
      <Dialog
        visible={confirmingExit}
        title={t('homes.photos.exit.title')}
        description={t('homes.photos.exit.description')}
        confirmLabel={t('homes.photos.exit.confirm')}
        cancelLabel={t('homes.photos.exit.cancel')}
        onConfirm={() => {
          setConfirmingExit(false);
          leave();
        }}
        onCancel={() => {
          setConfirmingExit(false);
        }}
      />
    </FormScreen>
  );
}

/**
 * Asistente de alta de una vivienda en seis pasos, empezando por las fotos. Sin `homeId` empieza una
 * nueva; con él continúa el borrador por `step` (o por el primer paso con datos por rellenar).
 */
export function HomeWizard({ homeId, step }: Readonly<{ homeId?: string; step?: string }>) {
  const { t } = useTranslation();
  const [createdId, setCreatedId] = useState<string>();
  const currentId = homeId ?? createdId;
  const query = useHome(currentId);
  const key = homeId ?? 'new';

  if (currentId === undefined) {
    return <WizardBody key={key} home={undefined} initialStep={1} onCreated={setCreatedId} />;
  }
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
      key={key}
      home={query.data}
      initialStep={requestedStep(step) ?? firstIncompleteStep(query.data)}
      onCreated={setCreatedId}
    />
  );
}
