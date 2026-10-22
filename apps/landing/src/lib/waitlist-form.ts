import { type FieldErrorCode, validateWaitlistInput } from '@changehouse/shared';

import { es } from '../i18n/es';
import { type SubmitDependencies, submitWaitlist, type WaitlistValues } from './waitlist-api';

const { waitlist } = es;

const FIELDS = [
  { name: 'email', id: 'email' },
  { name: 'municipality', id: 'municipality' },
  { name: 'homeType', id: 'home-type' },
  { name: 'lookingFor', id: 'looking-for' },
  { name: 'consent', id: 'consent' },
] as const;

type FieldName = (typeof FIELDS)[number]['name'];
type FieldInput = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

interface FieldView {
  name: FieldName;
  input: FieldInput;
  error: HTMLElement;
}

function findFields(doc: Document): FieldView[] | null {
  const views: FieldView[] = [];
  for (const { name, id } of FIELDS) {
    const input = doc.querySelector<FieldInput>(`#waitlist-${id}`);
    const error = doc.querySelector<HTMLElement>(`#waitlist-${id}-error`);
    if (!input || !error) return null;
    views.push({ name, input, error });
  }
  return views;
}

function readRaw(fields: FieldView[]): Record<string, unknown> {
  return Object.fromEntries(
    fields.map(({ name, input }) => [
      name,
      name === 'consent' ? (input as HTMLInputElement).checked : input.value,
    ]),
  );
}

/** Muestra u oculta el error de un campo y lo asocia (o no) a él para los lectores de pantalla. */
function showError({ name, input, error }: FieldView, code: FieldErrorCode | undefined): void {
  if (code === undefined) {
    error.hidden = true;
    error.textContent = '';
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
    return;
  }
  error.textContent = waitlist.errors[name][code];
  error.hidden = false;
  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', error.id);
}

function errorCodes(fields: FieldView[]): Map<string, FieldErrorCode> {
  const result = validateWaitlistInput(readRaw(fields));
  const codes = new Map<string, FieldErrorCode>();
  if (!result.success) for (const error of result.errors) codes.set(error.field, error.code);
  return codes;
}

/**
 * Conecta el formulario de la lista de espera (`#waitlist-form`): valida junto a cada campo
 * con el mismo esquema que la API, evita el doble envío y explica cada desenlace. Devuelve la
 * función que deshace todo.
 */
export function initWaitlistForm(doc: Document, dependencies: SubmitDependencies): () => void {
  const form = doc.querySelector<HTMLFormElement>('#waitlist-form');
  const submit = doc.querySelector<HTMLButtonElement>('#waitlist-submit');
  const success = doc.querySelector<HTMLElement>('#waitlist-success');
  const failure = doc.querySelector<HTMLElement>('#waitlist-failure');
  const heading = doc.querySelector<HTMLElement>('#waitlist-title');
  const fields = findFields(doc);
  if (!form || !submit || !success || !failure || !fields) return () => undefined;

  let sending = false;

  const viewOf = (target: EventTarget | null) => fields.find((field) => field.input === target);

  const setSending = (value: boolean) => {
    sending = value;
    submit.disabled = value;
    submit.textContent = value ? waitlist.sending : waitlist.submit;
    if (value) form.setAttribute('aria-busy', 'true');
    else form.removeAttribute('aria-busy');
  };

  const validateOne = (event: Event) => {
    const view = viewOf(event.target);
    if (view) showError(view, errorCodes(fields).get(view.name));
  };

  // Mientras se escribe solo se corrige un error ya mostrado: no se regaña antes de tiempo
  const revalidate = (event: Event) => {
    const view = viewOf(event.target);
    if (view && !view.error.hidden) showError(view, errorCodes(fields).get(view.name));
  };

  const showFailure = (message: string) => {
    failure.textContent = message;
    submit.focus();
  };

  const apply = async () => {
    const codes = errorCodes(fields);
    for (const view of fields) showError(view, codes.get(view.name));
    const first = fields.find((view) => codes.has(view.name));
    if (first) {
      first.input.focus();
      return;
    }

    const values = validateWaitlistInput(readRaw(fields));
    if (!values.success) return;
    await send(values.data);
  };

  const send = async (values: WaitlistValues) => {
    failure.textContent = '';
    setSending(true);
    const result = await submitWaitlist(values, dependencies);
    setSending(false);

    if (result.kind === 'accepted') {
      form.hidden = true;
      success.textContent = `${waitlist.success.title} ${waitlist.success.text}`;
      heading?.focus();
    } else if (result.kind === 'rate-limited') {
      showFailure(waitlist.rateLimited);
    } else if (result.kind === 'rejected') {
      const known = result.errors.filter((error) =>
        fields.some((view) => view.name === error.field),
      );
      for (const error of known) {
        const view = fields.find((candidate) => candidate.name === error.field);
        if (view) showError(view, error.code);
      }
      if (known.length === 0) showFailure(waitlist.unavailable);
    } else {
      showFailure(waitlist.unavailable);
    }
  };

  const onSubmit = (event: Event) => {
    event.preventDefault();
    if (!sending) void apply();
  };

  form.addEventListener('submit', onSubmit);
  form.addEventListener('focusout', validateOne);
  form.addEventListener('input', revalidate);
  form.addEventListener('change', revalidate);

  return () => {
    form.removeEventListener('submit', onSubmit);
    form.removeEventListener('focusout', validateOne);
    form.removeEventListener('input', revalidate);
    form.removeEventListener('change', revalidate);
  };
}
