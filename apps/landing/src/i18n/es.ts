/** Textos de la landing en español de España. Ningún texto visible va escrito en las páginas. */
export const es = {
  lang: 'es',
  meta: {
    description:
      'ChangeHouse es la plataforma para permutar tu vivienda con otra persona sin tener que vender antes de comprar.',
  },
  a11y: {
    skipToContent: 'Saltar al contenido',
  },
  header: {
    brand: 'ChangeHouse',
  },
  hero: {
    title: 'Cambia de casa sin vender primero',
    subtitle:
      'Encuentra a alguien que quiera tu casa y tenga la que buscas. Veréis cuánto se compensan, sin intermediarios y sin esperar a vender.',
    cta: 'Apúntate a la lista de espera',
  },
  waitlist: {
    title: 'Lista de espera',
    placeholder: 'Muy pronto podrás apuntarte aquí para ser de los primeros en probar ChangeHouse.',
  },
  footer: {
    note: 'ChangeHouse. Cambia de casa de forma sencilla.',
  },
} as const;

export type Strings = typeof es;
