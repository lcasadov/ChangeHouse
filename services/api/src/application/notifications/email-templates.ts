import type { EmailNotification } from './notifier.js';

export interface EmailParams {
  /** Destinatario. */
  readonly to: string;
  /** Enlace a la app que abre el match. */
  readonly link: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

interface Content {
  readonly subject: string;
  readonly heading: string;
  readonly paragraph: string;
  readonly action: string;
}

/** HTML accesible: idioma, título, un solo `h1`, contraste alto y un botón que es un enlace con texto. */
function render(content: Content, params: EmailParams): EmailNotification {
  const link = escapeHtml(params.link);
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(content.subject)}</title>
</head>
<body style="margin:0;padding:24px;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
<main style="max-width:560px;margin:0 auto;padding:32px;background-color:#ffffff;">
<p style="margin:0 0 16px;font-size:16px;font-weight:bold;">ChangeHouse</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;">${escapeHtml(content.heading)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.5;">${escapeHtml(content.paragraph)}</p>
<p style="margin:0 0 24px;"><a href="${link}" style="display:inline-block;padding:12px 24px;background-color:#0b4f8a;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:underline;">${escapeHtml(content.action)}</a></p>
<p style="margin:0;font-size:14px;line-height:1.5;color:#4a4a4a;">Si el botón no funciona, copia este enlace en tu navegador: ${link}</p>
</main>
</body>
</html>
`;
  const text = `ChangeHouse

${content.heading}

${content.paragraph}

${content.action}: ${params.link}
`;
  return { to: params.to, subject: content.subject, html, text };
}

/** Email de nuevo match: solo el enlace a la app, sin importes ni datos de contacto. */
export function matchCreatedEmail(params: EmailParams): EmailNotification {
  return render(
    {
      subject: 'Tienes un match en ChangeHouse',
      heading: '¡Tienes un match!',
      paragraph: 'Hay una permuta posible para tu vivienda. Entra en la app para ver los detalles.',
      action: 'Ver mi match',
    },
    params,
  );
}

/** Email de match cerrado. */
export function matchClosedEmail(params: EmailParams): EmailNotification {
  return render(
    {
      subject: 'Tu match de ChangeHouse se ha cerrado',
      heading: 'Tu match se ha cerrado',
      paragraph:
        'Un participante se ha retirado y el match ya no está activo. Puedes consultarlo en la app.',
      action: 'Ver mi match',
    },
    params,
  );
}
