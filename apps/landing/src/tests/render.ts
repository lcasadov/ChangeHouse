import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { parseHTML } from 'linkedom';

type AstroComponent = Parameters<AstroContainer['renderToString']>[0];

/** Renderiza un componente o página de Astro y devuelve el documento para consultarlo. */
export async function renderDocument(
  component: AstroComponent,
  props: Record<string, unknown> = {},
  path = '/',
  slots: Record<string, string> = {},
): Promise<Document> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(component, {
    props,
    slots,
    request: new Request(`https://changehouse.app${path}`),
  });
  return parseHTML(html).document;
}
