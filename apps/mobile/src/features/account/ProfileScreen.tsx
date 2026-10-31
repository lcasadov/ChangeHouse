import type { ProfileFormData, ProfileFormValues } from '@changehouse/shared';
import { useRef, useState } from 'react';
import { type Control, Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, Checkbox, Dialog, FormScreen, Notice, Text, TextField } from '../../ui';
import { useSignOut } from '../auth/use-sign-out';
import { LoadingView } from '../session/LoadingView';
import { AccountApiError, type Me } from './account-api';
import { AccountActions } from './AccountActions';
import {
  errorKeyOf,
  formValuesOf,
  type ProfileErrorKey,
  type ProfileField,
  profileResolver,
} from './profile-form';
import { useMe, useUpsertMe } from './use-me';

type Outcome = 'saved' | 'invalid' | 'network' | 'unknown';

function outcomeOfFailure(error: unknown): Exclude<Outcome, 'saved'> {
  if (!(error instanceof AccountApiError)) return 'unknown';
  if (error.kind === 'invalid') return 'invalid';
  return error.kind === 'network' ? 'network' : 'unknown';
}

interface FieldProps {
  control: Control<ProfileFormValues, unknown, ProfileFormData>;
  /** La persona ha vuelto a editar: la confirmación o el fallo anteriores ya no valen. */
  onEdit: () => void;
  clearError: (field: ProfileField) => void;
}

function useErrorText() {
  const { t } = useTranslation();
  return (field: ProfileField, type: string | undefined): string | undefined => {
    const key: ProfileErrorKey | null = type ? errorKeyOf(field, type) : null;
    return key ? t(`profile.errors.${key}`) : undefined;
  };
}

interface TextProps extends FieldProps {
  name: 'displayName' | 'municipality' | 'phone';
  label: string;
  hint?: string;
}

const TEXT_INPUT_TRAITS = {
  displayName: { autoComplete: 'name', textContentType: 'name', autoCapitalize: 'words' },
  municipality: { autoComplete: 'off', textContentType: 'addressCity', autoCapitalize: 'words' },
  phone: {
    autoComplete: 'tel',
    textContentType: 'telephoneNumber',
    autoCapitalize: 'none',
    keyboardType: 'phone-pad',
  },
} as const;

function ProfileTextField({ control, onEdit, clearError, name, label, hint }: Readonly<TextProps>) {
  const errorText = useErrorText();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...TEXT_INPUT_TRAITS[name]}
          label={label}
          value={field.value}
          onChangeText={(value) => {
            field.onChange(value);
            // La validación se muestra al salir del campo; mientras se escribe solo se quita el error
            if (fieldState.error) clearError(name);
            onEdit();
          }}
          onBlur={field.onBlur}
          error={errorText(name, fieldState.error?.type)}
          {...(hint ? { hint } : {})}
        />
      )}
    />
  );
}

interface CheckProps extends FieldProps {
  name: 'meetsVppRequirements' | 'isOver65';
  label: string;
}

function ProfileCheckbox({ control, onEdit, name, label }: Readonly<CheckProps>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Checkbox
          label={label}
          checked={field.value}
          onChange={(checked) => {
            field.onChange(checked);
            onEdit();
          }}
        />
      )}
    />
  );
}

/** Formulario de edición del perfil: React Hook Form con el esquema que la API comparte. */
function ProfileForm({ me }: Readonly<{ me: Me }>) {
  const { t } = useTranslation();
  const upsert = useUpsertMe();
  const submitting = useRef(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // Desde que se pulsa hasta que responde la API, también durante la validación
  const [saving, setSaving] = useState(false);
  const form = useForm<ProfileFormValues, unknown, ProfileFormData>({
    resolver: profileResolver,
    defaultValues: formValuesOf(me),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
  });

  const save = form.handleSubmit(async (data) => {
    try {
      const updated = await upsert.mutateAsync(data);
      form.reset(formValuesOf(updated));
      setOutcome('saved');
    } catch (error) {
      setOutcome(outcomeOfFailure(error));
    }
  });

  const submit = async () => {
    // Un segundo toque antes de que la pantalla refleje «guardando» no lanza otra petición
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setOutcome(null);
    try {
      await save();
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const shared: FieldProps = {
    control: form.control,
    onEdit: () => {
      setOutcome(null);
    },
    clearError: (field) => {
      form.clearErrors(field);
    },
  };

  return (
    <>
      <ProfileTextField
        {...shared}
        name="displayName"
        label={t('profile.form.displayName')}
        hint={t('profile.form.displayNameHint')}
      />
      <ProfileTextField {...shared} name="municipality" label={t('profile.form.municipality')} />
      <ProfileTextField
        {...shared}
        name="phone"
        label={t('profile.form.phone')}
        hint={t('profile.form.phoneHint')}
      />
      <ProfileCheckbox
        {...shared}
        name="meetsVppRequirements"
        label={t('profile.form.meetsVppRequirements')}
      />
      <Text variant="caption" tone="textMuted">
        {t('profile.form.meetsVppRequirementsHint')}
      </Text>
      <ProfileCheckbox {...shared} name="isOver65" label={t('profile.form.isOver65')} />

      {outcome ? (
        <Notice tone={outcome === 'saved' ? 'success' : 'danger'}>
          {outcome === 'saved' ? t('profile.saved') : t(`profile.errors.${outcome}`)}
        </Notice>
      ) : null}

      <Button
        label={t('profile.form.submit')}
        loading={saving}
        onPress={() => {
          submit().catch(() => undefined);
        }}
      />
    </>
  );
}

/**
 * Pestaña «Perfil»: la ficha de la persona, su edición y el cierre de sesión (con confirmación,
 * porque obliga a volver a identificarse).
 */
export function ProfileScreen() {
  const { t } = useTranslation();
  const me = useMe();
  const signOut = useSignOut();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  if (me.isPending) return <LoadingView />;

  return (
    <FormScreen>
      <Text variant="title" accessibilityRole="header">
        {t('profile.title')}
      </Text>
      <Text tone="textMuted">{t('profile.description')}</Text>

      {me.data ? (
        <>
          <Text tone="textMuted">{t('profile.email', { email: me.data.email })}</Text>
          <ProfileForm me={me.data} />
        </>
      ) : (
        <Notice
          tone="danger"
          action={{
            label: t('profile.errors.retry'),
            onPress: () => {
              me.refetch().catch(() => undefined);
            },
          }}
        >
          {t('profile.errors.loadFailed')}
        </Notice>
      )}

      <Button
        variant="secondary"
        label={t('auth.signOut')}
        onPress={() => {
          setConfirmingSignOut(true);
        }}
      />
      <Dialog
        visible={confirmingSignOut}
        title={t('profile.signOut.title')}
        description={t('profile.signOut.description')}
        confirmLabel={t('profile.signOut.confirm')}
        cancelLabel={t('profile.signOut.cancel')}
        onConfirm={() => {
          setConfirmingSignOut(false);
          signOut().catch(() => undefined);
        }}
        onCancel={() => {
          setConfirmingSignOut(false);
        }}
      />
      <AccountActions />
    </FormScreen>
  );
}
