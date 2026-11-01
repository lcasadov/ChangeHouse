/** Textos de la landing en español de España. Ningún texto visible va escrito en las páginas. */

const draftNotice = 'Borrador pendiente de revisión jurídica';

export const es = {
  lang: 'es',
  locale: 'es_ES',
  meta: {
    description:
      'ChangeHouse es la plataforma para permutar tu vivienda con otra persona sin tener que vender antes de comprar.',
    ogImageAlt:
      'Dos casas que se intercambian entre sí, con el lema «Cambia de casa sin vender primero».',
  },
  a11y: {
    skipToContent: 'Saltar al contenido',
    decorativeNote: 'Ilustración decorativa',
  },
  header: {
    brand: 'ChangeHouse',
    brandLabel: 'ChangeHouse, ir al inicio',
    navLabel: 'Principal',
    waitlist: 'Lista de espera',
    guides: 'Guías',
  },
  guides: {
    path: '/guias',
    feedPath: '/guias/rss.xml',
    title: 'Guías',
    lead: 'Respuestas claras sobre la permuta de viviendas, las cadenas de tres y los impuestos.',
    description:
      'Guías de ChangeHouse sobre la permuta de viviendas: cómo funciona, las cadenas de tres y nociones fiscales orientativas.',
    feedTitle: 'Guías de ChangeHouse',
    feedLabel: 'Suscribirse por RSS',
    listLabel: 'Listado de guías',
    empty: 'Estamos preparando las primeras guías. Vuelve pronto.',
    draftBadge: 'Borrador',
    readMore: 'Leer la guía',
    allGuides: 'Todas las guías',
    readingTime: 'min de lectura',
    tocLabel: 'Índice de secciones',
    tocTitle: 'En esta guía',
    cta: {
      title: '¿Quieres cambiar de casa sin vender primero?',
      text: 'Apúntate a la lista de espera y te avisaremos cuando ChangeHouse llegue a Madrid.',
      button: 'Apúntate a la lista de espera',
    },
  },
  hero: {
    eyebrow: 'Permuta de viviendas · Madrid',
    title: 'Cambia de casa sin vender primero',
    subtitle:
      'ChangeHouse te pone en contacto con quien quiere tu casa y tiene la que tú buscas, para cambiarlas directamente, sin agencias y sin esperar a vender.',
    cta: 'Apúntate a la lista de espera',
    secondary: 'Cómo funciona',
    video: {
      play: 'Reproducir el vídeo de fondo',
      pause: 'Pausar el vídeo de fondo',
      playing: 'Vídeo de fondo en reproducción',
      paused: 'Vídeo de fondo en pausa',
    },
  },
  howItWorks: {
    title: 'Cómo funciona',
    intro: 'Tres pasos, sin papeleo al principio.',
    stepLabel: 'Paso',
    steps: [
      {
        title: 'Publica tu casa',
        text: 'Sube las fotos, cuéntanos cómo es y dinos dónde te gustaría vivir. Tu casa es tu escaparate.',
        photo: '/media/paso-publicar.jpg',
        photoAlt: 'Fachada de un edificio clásico con balcones de forja y macetas',
      },
      {
        title: 'Marca las que te gustan',
        text: 'Descubre viviendas y marca con un corazón las que te encantaría tener. Cuando a su dueño le guste la tuya, hay match.',
        photo: '/media/paso-me-gusta.jpg',
        photoAlt: 'Salón luminoso con sofá verde, ventanal y plantas',
      },
      {
        title: 'Cierra el cambio con una gestoría',
        text: 'Una gestoría asociada tramita el cambio hasta la notaría y las dos partes firmáis el mismo día.',
        photo: '/media/paso-cambio.jpg',
        photoAlt: 'Terraza de un ático al atardecer con tumbonas y vistas a los tejados',
      },
    ],
  },
  chains: {
    title: 'Cadenas de tres',
    lead: '¿Y si la casa que te gusta no quiere la tuya? Todavía puede haber cambio.',
    paragraphs: [
      'A quiere la casa de B, B quiere la de C y C quiere la de A. Ninguna pareja encaja por sí sola, pero las tres juntas sí: cada persona se queda con la casa que quería.',
      'Nosotros detectamos estos ciclos por ti. Las tres personas confirmáis cada una por separado, y el cambio se cierra con una única gestoría y firmas el mismo día.',
    ],
    caption: 'Tres casas que se intercambian en círculo',
  },
  benefits: {
    title: 'Por qué cambiar así',
    items: [
      {
        title: 'Sin agencia',
        text: 'Evitas la comisión de venta, que habitualmente es del 3–5 % + IVA por cada parte.',
      },
      {
        title: 'Sin quedarte sin casa',
        text: 'Las transmisiones se firman el mismo día: no hay un hueco en el que no tengas vivienda.',
      },
      {
        title: 'Menos hipoteca',
        text: 'Solo financias la diferencia de valor entre las dos viviendas, no la compra completa.',
      },
      {
        title: 'Acompañamiento',
        text: 'Una gestoría asociada se ocupa de los trámites hasta la notaría.',
      },
    ],
  },
  founder: {
    title: 'Por qué nace ChangeHouse',
    draftNotice: 'Borrador: esta historia está pendiente de que el equipo la revise y la complete.',
    paragraphs: [
      'Cambiar de casa cuando eres propietario suele significar vender y comprar a la vez: dos operaciones, dos comisiones y la duda de qué pasa si una de las dos se cae.',
      'ChangeHouse nace de una pregunta sencilla: ¿y si pudieras cambiar tu casa directamente con alguien que quiere la tuya y tiene la que tú buscas?',
      'Empezamos por Madrid y su área metropolitana, y queremos construirlo escuchando a quienes están pensando en mudarse.',
    ],
    signature: '[Nombre del fundador o la fundadora]',
  },
  faq: {
    title: 'Preguntas frecuentes',
    items: [
      {
        question: '¿Tengo que vender mi casa antes de cambiarla?',
        answer:
          'No. Esa es la idea: cambias tu casa directamente por otra, sin vender primero y sin quedarte sin vivienda, porque las transmisiones se firman el mismo día.',
      },
      {
        question: '¿Qué es una permuta?',
        answer:
          'Es un contrato por el que dos o más personas se intercambian bienes, en este caso viviendas (arts. 1538–1541 del Código Civil). Puede incluir una compensación en dinero para equilibrar la diferencia de valor.',
      },
      {
        question: '¿Y si mi casa vale más o menos que la otra?',
        answer:
          'La diferencia se compensa en dinero y solo financias esa diferencia, no la compra completa. Cada tarjeta te muestra cuánto recibes o cuánto pagas, siempre como estimación orientativa.',
      },
      {
        question: '¿Cómo funcionan las cadenas de tres?',
        answer:
          'Si A quiere la casa de B, B la de C y C la de A, el ciclo se cierra entre las tres. Hay un máximo de tres participantes, cada uno confirma de forma explícita y una única gestoría lleva toda la operación.',
      },
      {
        question: '¿Cuánto cuesta?',
        answer:
          'Solo cobramos una comisión de éxito cuando la operación se firma, nunca por un match. Todavía estamos definiendo el importe y lo explicaremos con claridad antes de que lo necesites.',
      },
      {
        question: '¿Puedo cambiar una vivienda de protección oficial (VPP)?',
        answer:
          'Sí, respetando el precio máximo legal, la autorización de la Comunidad de Madrid y el derecho de tanteo y retracto. Las viviendas protegidas solo se muestran a quien cumple los requisitos de acceso. Estamos confirmando con asesoramiento jurídico algunos detalles de las permutas de VPP.',
      },
      {
        question: '¿Qué impuestos tengo que pagar?',
        answer:
          'Una permuta tributa como cualquier otra transmisión: ITP, IRPF por la ganancia patrimonial y plusvalía municipal, además de notaría y registro. Ofreceremos un simulador con estimaciones orientativas, que incluye las exenciones por reinversión en vivienda habitual y para mayores de 65 años. No es asesoramiento: lo valida tu gestoría. Nunca recomendamos valores de escritura, que deben ser valores de mercado defendibles.',
      },
      {
        question: '¿Dónde está disponible?',
        answer:
          'Empezamos en Madrid capital y su área metropolitana, incluido el cambio entre la ciudad y un municipio cercano. Apúntate a la lista de espera y te avisaremos cuando lleguemos.',
      },
    ],
  },
  waitlist: {
    title: 'Lista de espera',
    lead: 'Apúntate y serás de los primeros en probar ChangeHouse en Madrid. Solo te pedimos lo necesario para avisarte.',
    formLabel: 'Formulario de la lista de espera',
    fields: {
      email: { label: 'Email' },
      municipality: { label: 'Municipio de tu vivienda' },
      homeType: {
        label: 'Tipo de vivienda',
        placeholder: 'Elige una opción',
        options: {
          piso: 'Piso',
          atico: 'Ático',
          duplex: 'Dúplex',
          estudio: 'Estudio',
          bajo: 'Bajo',
          chalet: 'Chalet',
          adosado: 'Adosado',
          pareado: 'Pareado',
          casa: 'Casa',
        },
      },
      lookingFor: { label: 'Qué buscas' },
      consent: {
        label: 'Acepto la política de privacidad',
        linkText: 'política de privacidad',
      },
    },
    submit: 'Apuntarme a la lista',
    sending: 'Enviando…',
    success: {
      title: '¡Listo, ya estás en la lista!',
      text: 'Te escribiremos cuando ChangeHouse esté disponible en Madrid.',
    },
    rateLimited:
      'Se han hecho demasiados intentos desde tu conexión. Espera unos minutos e inténtalo de nuevo; tus datos siguen en el formulario.',
    unavailable:
      'No hemos podido enviar tu solicitud. Inténtalo de nuevo más tarde; tus datos siguen en el formulario.',
    errors: {
      email: {
        required: 'Escribe tu email.',
        invalid: 'Revisa el email: parece incompleto o tiene un error.',
        too_long: 'El email es demasiado largo (máximo 254 caracteres).',
      },
      municipality: {
        required: 'Dinos en qué municipio está tu vivienda.',
        invalid: 'Revisa el municipio.',
        too_long: 'El municipio es demasiado largo (máximo 120 caracteres).',
      },
      homeType: {
        required: 'Elige el tipo de vivienda.',
        invalid: 'Elige el tipo de vivienda de la lista.',
        too_long: 'Elige el tipo de vivienda de la lista.',
      },
      lookingFor: {
        required: 'Cuéntanos qué buscas.',
        invalid: 'Revisa lo que buscas.',
        too_long: 'El texto es demasiado largo (máximo 500 caracteres).',
      },
      consent: {
        required: 'Debes aceptar la política de privacidad para apuntarte.',
        invalid: 'Debes aceptar la política de privacidad para apuntarte.',
        too_long: 'Debes aceptar la política de privacidad para apuntarte.',
      },
    },
  },
  footer: {
    note: 'ChangeHouse. Cambia de casa de forma sencilla.',
    legalNavLabel: 'Información legal',
    links: {
      legalNotice: 'Aviso legal',
      privacy: 'Privacidad',
      cookies: 'Cookies',
      terms: 'Términos de uso',
    },
    configureCookies: 'Configurar cookies',
  },
  cookies: {
    banner: {
      title: 'Tu privacidad, tu decisión',
      text: 'Solo usamos cookies y almacenamiento no esenciales si tú nos lo permites. Ahora mismo no cargamos ninguno.',
      policyLink: 'Más información en la política de cookies',
      accept: 'Aceptar',
      reject: 'Rechazar',
      configure: 'Configurar',
      settingsTitle: 'Elige qué permites',
      essentialLabel: 'Esenciales',
      essentialHint: 'Recuerdan tu decisión sobre cookies. Siempre activas.',
      analyticsLabel: 'Analítica',
      analyticsHint:
        'Nos ayuda a entender qué partes de la web resultan útiles. Desactivada por defecto.',
      save: 'Guardar mi elección',
      saved: 'Tu elección sobre cookies se ha guardado.',
    },
  },
  legal: {
    draftNotice,
    backHome: 'Volver al inicio',
    pages: {
      legalNotice: {
        path: '/aviso-legal',
        title: 'Aviso legal',
        description:
          'Aviso legal de ChangeHouse: titular del sitio web, condiciones de uso, propiedad intelectual y legislación aplicable.',
        intro: 'Información general del sitio web de ChangeHouse conforme a la LSSI.',
        sections: [
          {
            title: 'Titular del sitio',
            text: 'Este sitio web pertenece a [Razón social], con NIF [NIF], domicilio en [Domicilio social] e inscrita en [Datos registrales]. Contacto: [Correo electrónico de contacto].',
          },
          {
            title: 'Objeto',
            text: 'El sitio web informa sobre ChangeHouse, una plataforma de permuta de viviendas, y recoge solicitudes de acceso anticipado. [Texto definitivo por redactar].',
          },
          {
            title: 'Condiciones de uso',
            text: 'La persona usuaria se compromete a hacer un uso lícito del sitio. [Texto definitivo por redactar].',
          },
          {
            title: 'Propiedad intelectual',
            text: 'Los contenidos, marcas y diseños del sitio pertenecen a [Razón social] o a sus licenciantes. [Texto definitivo por redactar].',
          },
          {
            title: 'Responsabilidad',
            text: 'La información del sitio es orientativa y no constituye asesoramiento jurídico ni fiscal. [Texto definitivo por redactar].',
          },
          {
            title: 'Legislación aplicable y jurisdicción',
            text: 'Este aviso se rige por la legislación española. [Jurisdicción por definir].',
          },
        ],
      },
      privacy: {
        path: '/privacidad',
        title: 'Política de privacidad',
        description:
          'Política de privacidad de ChangeHouse: quién trata tus datos, con qué finalidad, durante cuánto tiempo y cómo ejercer tus derechos.',
        intro: 'Cómo tratamos los datos personales conforme al RGPD y la LOPDGDD.',
        sections: [
          {
            title: 'Responsable del tratamiento',
            text: '[Razón social], con NIF [NIF] y domicilio en [Domicilio social]. Contacto de privacidad: [Correo electrónico de privacidad].',
          },
          {
            title: 'Datos que tratamos y finalidades',
            text: '[Por definir cuando se incorpore la lista de espera: datos, finalidad y base jurídica de cada tratamiento].',
          },
          {
            title: 'Destinatarios y encargados',
            text: '[Por definir: proveedores que tratan datos por cuenta del responsable y transferencias internacionales, si las hay].',
          },
          {
            title: 'Plazo de conservación',
            text: '[Por definir: plazo de conservación de cada categoría de datos].',
          },
          {
            title: 'Tus derechos',
            text: 'Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a [Correo electrónico de privacidad]. Si no estás conforme, puedes reclamar ante la Agencia Española de Protección de Datos.',
          },
        ],
      },
      cookies: {
        path: '/cookies',
        title: 'Política de cookies',
        description:
          'Política de cookies de ChangeHouse: qué almacenamiento usamos, para qué y cómo cambiar tu elección en cualquier momento.',
        intro: 'Qué almacenamos en tu dispositivo y cómo puedes controlarlo.',
        sections: [
          {
            title: 'Qué son las cookies y el almacenamiento local',
            text: 'Son pequeños datos que un sitio web guarda en tu dispositivo. Responsable: [Razón social].',
          },
          {
            title: 'Qué usamos hoy',
            text: 'Solo guardamos tu decisión sobre las cookies en el almacenamiento local del navegador, y únicamente después de que decidas. No cargamos analítica ni cookies de terceros antes de tu consentimiento.',
          },
          {
            title: 'Cookies de analítica',
            text: '[Por definir cuando se incorpore la analítica: herramienta, finalidad, duración y proveedor].',
          },
          {
            title: 'Cómo cambiar tu elección',
            text: 'Puedes aceptar, rechazar o configurar las cookies en cualquier momento con el enlace «Configurar cookies» del pie de página. El cambio se aplica de inmediato.',
          },
        ],
      },
      terms: {
        path: '/terminos',
        title: 'Términos de uso',
        description:
          'Términos de uso de ChangeHouse: condiciones del servicio, comisión de éxito, estimaciones orientativas y legislación aplicable.',
        intro: 'Condiciones que regulan el uso del sitio web y del servicio.',
        sections: [
          {
            title: 'Objeto y aceptación',
            text: 'Estos términos regulan el uso del sitio web y del servicio de [Razón social]. [Texto definitivo por redactar].',
          },
          {
            title: 'Descripción del servicio',
            text: 'ChangeHouse pone en contacto a propietarios que desean permutar sus viviendas y les acompaña hasta la notaría a través de gestorías asociadas. [Texto definitivo por redactar].',
          },
          {
            title: 'Comisión de éxito',
            text: 'La comisión solo se devenga con la firma de la operación, nunca por un match. [Importe y condiciones por definir: cuándo se devenga y cómo se cancela].',
          },
          {
            title: 'Estimaciones orientativas',
            text: 'Las estimaciones económicas y fiscales son orientativas, no constituyen asesoramiento y deben ser validadas por tu gestoría.',
          },
          {
            title: 'Modificaciones y legislación aplicable',
            text: '[Razón social] podrá modificar estos términos. Se rigen por la legislación española. [Jurisdicción por definir].',
          },
        ],
      },
    },
  },
} as const;

export type Strings = typeof es;
