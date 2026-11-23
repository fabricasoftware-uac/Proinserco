import type { ContenidoSitio } from '../domain/esquemas'

/**
 * Contenido del sitio público. Fuente: docs/01 - Cliente/Contenido fuente.md,
 * sección "Textos corregidos propuestos" (pendientes de revisión del cliente)
 * y ficha consolidada. NADA aquí es inventado: lo que falta va marcado
 * `TODO-CONTENIDO` (ver PENDIENTES_CONTENIDO al final).
 */
export const CONTENIDO_SITIO = {
  organizacion: {
    nombre: 'Fundación Proinserco',
    nombreCorto: 'Proinserco',
    razonSocial:
      'FUNDACIÓN DE PROFESIONALES INTERDISCIPLINARIOS PARA INVESTIGACIÓN Y EJECUCIÓN DE PROYECTOS COMUNITARIOS MUNICIPALES Y REGIONALES',
    lema: 'Al servicio de la comunidad',
    aniosExperiencia: 22,
    descripcionCorta:
      'Fundación caucana no gubernamental, sin ánimo de lucro, de profesionales interdisciplinarios dedicada a la investigación, formulación y ejecución de proyectos comunitarios en el departamento del Cauca.',
    nit: '817.004.531-1',
  },

  contacto: {
    telefono: '+57 300 651 8013',
    /** Al pulsar el número se abre WhatsApp (no la app de llamadas/correo de Windows). Saludo neutro, sin datos personales. */
    whatsapp: 'https://wa.me/573006518013?text=Hola%2C%20Fundaci%C3%B3n%20Proinserco',
    direccion: 'Reserva del Bosque Bl 4 Ca 19',
    barrio: 'Bella Vista',
    ciudad: 'Popayán',
    departamento: 'Cauca',
    pais: 'Colombia',
    correo: 'proiserco@gmail.com',
    redes: [],
  },

  quienesSomos: {
    titulo: '¿Quiénes somos?',
    parrafos: [
      'Somos una fundación caucana no gubernamental con 22 años de experiencia en el sector social, cultural y educativo. Nos hemos consolidado como un aliado estratégico de las comunidades, del Estado y de las empresas privadas. La fundación se ha caracterizado por la investigación, formulación y ejecución de proyectos comunitarios en el departamento del Cauca.',
      'Somos una fundación de profesionales interdisciplinarios para la investigación y ejecución de proyectos comunitarios municipales y regionales. Consideramos que Colombia puede mejorar las condiciones de vida de su población a través de programas, planes y proyectos que propendan a un desarrollo igualitario y armónico en los municipios. Por eso apostamos a la implementación de nuevos proyectos educativos en investigación, ciencia, tecnología y cultura. Así, PROINSERCO desarrolla habilidades de talento humano que le permiten alcanzar las metas trazadas.',
    ],
    resaltadas: ['22 años', 'aliado estratégico', 'proyectos comunitarios', 'Cauca'],
    cifra: { valor: 22, etiqueta: 'años de experiencia' },
  },

  misionVision: {
    mision:
      'Somos una fundación sin ánimo de lucro, conformada por profesionales interdisciplinarios, comprometida con el desarrollo social, cultural, turístico y ambiental de los municipios; especialista en formulación, gestión, implementación, cooperación y ejecución de proyectos y actividades de interés público e iniciativas privadas.',
    vision: [
      'Afianzarnos como el mejor socio estratégico de las entidades públicas y privadas de la región en la formulación y ejecución de proyectos sociales, culturales, ambientales y turísticos de alto impacto, que logren el crecimiento y el desarrollo sostenible de la región.',
      'PROINSERCO será reconocida por la excelencia en la ejecución de sus compromisos y como una organización experta en la construcción de tejido social.',
    ],
  },

  queHacemos: {
    titulo: '¿Qué hacemos?',
    items: [
      { id: 'elaboracion', titulo: 'Elaboración y diseño de proyectos' },
      { id: 'impulso', titulo: 'Impulso', nota: 'TODO-CONTENIDO: el PPTX dice solo "Impulso"; el cliente debe completarlo' },
      { id: 'asesoramiento', titulo: 'Asesoramiento' },
      { id: 'capacitaciones', titulo: 'Capacitaciones educativas, de salud y agropecuarias' },
      {
        id: 'estudios',
        titulo:
          'Coordinación y aplicación de todo tipo de estudios para la investigación de programas, proyectos y acciones de carácter científico, técnico, empresarial, cultural y ambiental',
      },
      { id: 'programas-sociales', titulo: 'Desarrollo de programas sociales, en especial con población vulnerable' },
    ],
  },

  comoTrabajamos: {
    titulo: 'Cómo trabajamos',
    elaboracion: {
      titulo: 'Elaboración de proyectos',
      puntos: [
        'Apoyo en la búsqueda de licitaciones y en el análisis de factibilidad de proyectos para comunidades vulnerables del municipio de El Tambo.',
        'Diseño, presentación y sustentación de proyectos acordes con las convocatorias.',
        'Diseño interdisciplinario, de acuerdo con las diversas áreas de la Fundación, de los planes operativos, planes de adquisición y cronogramas para la ejecución de los proyectos.',
        'Establecimiento de mecanismos de control, evaluación y gestión para el cumplimiento de las metas y objetivos pactados en cada proyecto.',
      ],
    },
    ejecucion: {
      titulo: 'Ejecución de proyectos',
      puntos: [
        'Supervisión de los procesos de contratación que se requieran para la ejecución de los proyectos.',
        'Control de la gestión profesional, técnica, administrativa y operativa del equipo humano vinculado específicamente a cada proyecto.',
        'Establecimiento de mecanismos de control, evaluación y gestión para el cumplimiento de las metas y objetivos pactados en cada proyecto.',
        'Apoyo en la elaboración y presentación de los informes exigidos por los organismos de cooperación y las entidades del Gobierno que participen en la ejecución, gestión o financiación de los proyectos.',
      ],
    },
  },

  capacitaciones: {
    titulo: 'Capacitaciones por sector',
    sectores: [
      {
        sector: 'educacion',
        titulo: 'Educación',
        puntos: [
          'Diplomado en Ciencia, Tecnología e Innovación (SRCTEI) con la Universidad del Cauca. Este diplomado, como recurso de capacitación de talento humano, se enmarca en un contexto de crisis sistémica en la estructura de ciencia, tecnología e innovación (CTeI) en el departamento del Cauca, que presenta bajas capacidades institucionales, falta de gobernanza, débil articulación de actores y problemáticas en la transformación real y el impacto de la CTeI.',
          'Este diplomado fortalece las conexiones entre los actores del sistema regional de CTeI y otros actores como la academia, los empresarios, las personas del común y las entidades públicas y privadas, entre otros. En este contexto también fortalece las capacidades de los diferentes actores territoriales para que puedan incidir en la creación de políticas públicas y así generar estrategias que mejoren la dinámica y la efectividad de la CTeI en el Cauca, como medio para generar desarrollo sostenible y adecuadas condiciones de vida para todos los habitantes del departamento.',
          'La meta era capacitar a 80 personas; no obstante, se superó y en total se certificaron 103.',
        ],
        destacado: { valor: 103, etiqueta: 'personas certificadas', meta: 80 },
        nota: 'TODO-CONTENIDO: confirmar el significado de la sigla SRCTEI',
      },
      {
        sector: 'salud',
        titulo: 'Salud',
        puntos: [
          'Formación a operadores y educadores en salud en centros de privación de la libertad.',
          'Educación para la salud dirigida a personas privadas de la libertad.',
          'Orientación en servicio a equipos de salud que atienden en centros de privación de la libertad.',
          'Orientación personalizada para el aprendizaje y el empleo.',
          'Programa de formación para personas en riesgo de exclusión social.',
        ],
      },
      {
        sector: 'agricola',
        titulo: 'Agrícola',
        puntos: [
          'Capacitación a los productores en Buenas Prácticas Agrícolas y Buenas Prácticas de higiene para la cosecha, el beneficio húmedo, el empaque y el almacenamiento, para mejorar la producción del café.',
          'Charlas técnicas y capacitaciones a pequeños productores de los municipios de La Plata (Huila) y El Tambo (Cauca), buscando la integración y divulgación de las diferentes técnicas de producción.',
          'Capacitaciones sobre los procesos productivos bajo lineamientos de Buenas Prácticas Agrícolas (BPA).',
        ],
      },
    ],
  },

  territorio: {
    titulo: 'Territorio',
    departamento: 'Cauca',
    municipios: [
      { nombre: 'El Tambo', departamento: 'Cauca', confirmado: true },
      { nombre: 'La Plata', departamento: 'Huila', confirmado: true },
      // Inferidos a ojo del mapa del PPTX (slide 15). TODO-CONTENIDO: confirmar con el cliente.
      { nombre: 'Popayán', departamento: 'Cauca', confirmado: false },
      { nombre: 'Timbío', departamento: 'Cauca', confirmado: false },
      { nombre: 'Cajibío', departamento: 'Cauca', confirmado: false },
      { nombre: 'Morales', departamento: 'Cauca', confirmado: false },
      { nombre: 'Silvia', departamento: 'Cauca', confirmado: false },
      { nombre: 'Totoró', departamento: 'Cauca', confirmado: false },
      { nombre: 'Patía', departamento: 'Cauca', confirmado: false },
    ],
  },

  aliados: {
    titulo: 'Algunas entidades con las que hemos trabajado',
    nota: 'TODO-CONTENIDO: pedir autorización de cada entidad para usar su logo y versiones en buena resolución',
    lista: [
      {
        id: 'universidad-del-cauca',
        nombre: 'Universidad del Cauca',
        logo: { src: '/img/aliados/universidad-del-cauca.png', ancho: 412, alto: 580 },
      },
      {
        id: 'cabildo-indigena-guambia',
        nombre: 'Cabildo Indígena de Guambia',
        logo: { src: '/img/aliados/cabildo-indigena-guambia.png', ancho: 423, alto: 109 },
      },
      {
        id: 'ips-mama-dominga-guambia',
        nombre: 'Cabildo Indígena de Guambia IPS - I Hospital Mama Dominga',
        logo: { src: '/img/aliados/ips-mama-dominga-guambia.png', ancho: 960, alto: 240 },
      },
      { id: 'osteosalud', nombre: 'OsteoSalud', logo: { src: '/img/aliados/osteosalud.png', ancho: 225, alto: 225 } },
      {
        id: 'fes-ips-sas',
        nombre: 'FES IPS SAS (Fundación de Excelencia en Salud)',
        logo: { src: '/img/aliados/fes-ips-sas.png', ancho: 257, alto: 196 },
      },
      {
        id: 'forjadores-del-futuro',
        nombre: 'Corporación Forjadores del Futuro',
        logo: { src: '/img/aliados/forjadores-del-futuro.png', ancho: 960, alto: 343 },
      },
      {
        id: 'integrales-colombia',
        nombre: 'Integrales Colombia S.A.S.',
        logo: { src: '/img/aliados/integrales-colombia.png', ancho: 200, alto: 154 },
        nota: 'TODO-CONTENIDO: logo de muy baja resolución, pedir original',
      },
    ],
  },

  valores: {
    titulo: 'Nuestros valores',
    lista: ['Respeto', 'Solidaridad', 'Compromiso', 'Honestidad', 'Servicio', 'Confianza', 'Adaptabilidad', 'Diligencia'],
  },

  principios: {
    titulo: 'Nuestros principios',
    lista: [
      'Altruismo',
      'Respeto',
      'Justicia',
      'Honestidad',
      'Tolerancia',
      'Responsabilidad',
      'Verdad',
      'Integridad',
      'Equidad',
      'Compromiso',
      'Transparencia',
      'Imparcialidad',
    ],
  },

  equipo: {
    titulo: 'Nuestro equipo',
    introduccion:
      'Nos complace presentar al equipo que impulsa el éxito de cada uno de nuestros proyectos, combinando experiencia, visión y conocimiento técnico para alcanzar los más altos estándares.',
    cierre:
      'Juntos, este equipo multidisciplinario trabaja con dedicación y sinergia para convertir cada desafío en una oportunidad, garantizando la excelencia en cada proyecto que emprendemos.',
    miembros: [
      {
        id: 'jorge-eduardo-orozco-alvarez',
        nombre: 'Jorge Eduardo Orozco Álvarez',
        rol: 'Representante Legal',
        descripcion:
          'Jorge Eduardo es la cabeza visible de nuestra organización, asegurando la legalidad y transparencia en todas nuestras operaciones. Su liderazgo y visión estratégica son fundamentales para establecer alianzas duraderas y garantizar la solidez de cada iniciativa.',
        foto: { src: '/img/equipo/jorge-eduardo-orozco-alvarez.jpg', ancho: 354, alto: 472 },
      },
      {
        id: 'sharly',
        nombre: 'Sharly',
        rol: 'Directora de Proyectos',
        descripcion:
          'Con una trayectoria probada en la gestión y dirección, Sharly es la fuerza motriz detrás de la ejecución de cada proyecto. Su capacidad para coordinar equipos, optimizar recursos y mantener el enfoque en los objetivos nos permite entregar resultados eficientes y de alta calidad en cada etapa.',
        foto: { src: '/img/equipo/sharly-v2.jpg', ancho: 1000, alto: 1365 },
      },
      {
        id: 'jorge-e-orozco-zuniga',
        nombre: 'Jorge E. Orozco Zúñiga',
        rol: 'Ingeniero',
        descripcion:
          'Jorge aporta el rigor técnico y la precisión que garantizan la viabilidad y robustez de nuestras soluciones. Su profundo conocimiento en Ingeniería Mecánica es clave para superar desafíos y asegurar que cada diseño sea innovador y funcional.',
        foto: { src: '/img/equipo/jorge-e-orozco-zuniga-v2.jpg', ancho: 1000, alto: 1250 },
      },
      {
        id: 'dora-stella',
        nombre: 'Dora Stella',
        rol: 'Arquitecta',
        descripcion:
          'La visión creativa y el ojo experto de Dora Stella son esenciales para transformar ideas en espacios funcionales y estéticamente atractivos. Su habilidad para diseñar entornos que combinan belleza y utilidad nos permite crear proyectos que no solo cumplen con las expectativas, sino que las superan.',
        foto: { src: '/img/equipo/dora-stella-v2.jpg', ancho: 1000, alto: 1125 },
      },
      {
        id: 'luisa-maria',
        nombre: 'Luisa María',
        rol: 'Diseñadora',
        descripcion:
          'Luisa María da forma y voz visual a cada proyecto. Su sensibilidad estética y su atención al detalle convierten ideas complejas en piezas claras y cercanas, para que cada iniciativa llegue a la comunidad con una imagen coherente, honesta y fácil de comprender.',
        foto: { src: '/img/equipo/luisa-maria-v2.jpg', ancho: 1000, alto: 1250 },
      },
    ],
  },

  donar: {
    titulo: 'Dona hoy',
    llamado: 'Tu generosidad tiene el poder de transformar vidas.',
    montosSugeridosPesos: [20_000, 50_000, 100_000, 200_000],
    nota: 'TODO-CONTENIDO: confirmar montos sugeridos, destino de los fondos y si la fundación expide certificado de donación (RTE)',
    transferenciaInternacional: {
      banco: 'Banco Bilbao Vizcaya Argentaria Colombia S.A. (BBVA Colombia)',
      codigoSwift: 'GEROCOBB',
      tipoCuenta: 'Cuenta de Ahorros',
      numeroCuenta: '0721467348',
      correoComprobante: 'pagos@proinserco.org',
    },
  },

  cierre: 'Gracias. Proinserco, al servicio de la comunidad.',

  legal: {
    versionPoliticaDatos: 'borrador-2026-11-16',
    estado: 'borrador',
    aviso: 'Borrador pendiente de validación por el abogado de la fundación. No es un texto legal definitivo.',
  },

  creditos: [{ texto: 'Created by Fábrica de Software', url: 'https://www.fabsoft.app/' }],
} as const satisfies ContenidoSitio

/** Lo que el cliente debe entregar o confirmar antes de publicar. */
export const PENDIENTES_CONTENIDO = [
  'NIT, razón social, registro y calificación en el Régimen Tributario Especial (certificados de donación)',
  'Correo oficial, WhatsApp y redes sociales',
  'Completar "Impulso" en ¿Qué hacemos?',
  'Significado de la sigla SRCTEI',
  'Lista oficial de municipios aliados (los no confirmados vienen del mapa del PPTX)',
  'Autorización y logos en buena resolución de los aliados',
  'Retratos del equipo en buena resolución, apellidos de Sharly y Dora Stella y descripción de Luisa María',
  'Montos sugeridos y destino de los fondos donados',
  'Elegir o fusionar la misión del PPTX y la del sitio Wix',
  'Validación legal de todos los textos de /legal',
] as const
