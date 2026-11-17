/**
 * Reglas de capas del vault (02 - Arquitectura/Capas y Reglas de Dependencia).
 * ROMPEN `pnpm verify`. Comprobar con `pnpm depcruise:grafo` que el grafo no
 * está vacío (un verde sobre un grafo vacío también es verde).
 * @type {import('dependency-cruiser').IConfiguration}
 */
const SIN_TESTS = '\\.test\\.tsx?$'

module.exports = {
  forbidden: [
    {
      name: 'dominio-sin-dependencias-externas',
      comment: 'LISTA BLANCA: domain solo importa zod, su propio domain y shared/domain.',
      severity: 'error',
      from: { path: '^apps/web/src/(modules/[^/]+|shared)/domain/', pathNot: SIN_TESTS },
      to: {
        pathNot: ['^apps/web/src/modules/[^/]+/domain/', '^apps/web/src/shared/domain/', 'node_modules/zod/'],
      },
    },
    {
      name: 'application-no-conoce-infraestructura-ni-ui',
      severity: 'error',
      from: { path: '^apps/web/src/(modules/[^/]+|shared)/application/', pathNot: SIN_TESTS },
      to: { path: ['/(infrastructure|ui)/', '^apps/web/src/(server|app|flujos)/'] },
    },
    {
      name: 'application-sin-frameworks',
      severity: 'error',
      from: { path: '^apps/web/src/(modules/[^/]+|shared)/application/', pathNot: SIN_TESTS },
      to: { path: 'node_modules/(next|react|react-dom)/' },
    },
    {
      name: 'infraestructura-no-conoce-ui',
      severity: 'error',
      from: { path: '/infrastructure/' },
      to: { path: ['/ui/', '^apps/web/src/(app|flujos)/'] },
    },
    {
      name: 'ui-no-conoce-infraestructura',
      severity: 'error',
      from: { path: '^apps/web/src/modules/[^/]+/ui/' },
      to: { path: '/infrastructure/' },
    },
    {
      name: 'rutas-sin-infraestructura',
      comment: 'app/ y flujos/ hablan con el contenedor, nunca con adaptadores.',
      severity: 'error',
      from: { path: '^apps/web/src/(app|flujos)/' },
      to: { path: '/infrastructure/' },
    },
    {
      name: 'modulos-aislados',
      comment: 'Un módulo no importa a otro. Los conecta el composition root (src/server/container.ts).',
      severity: 'error',
      from: { path: '^apps/web/src/modules/([^/]+)/', pathNot: SIN_TESTS },
      to: { path: '^apps/web/src/modules/([^/]+)/', pathNot: '^apps/web/src/modules/$1/' },
    },
    {
      name: 'fuera-de-modulo-solo-por-barrel',
      comment: 'Rutas y flujos entran a un módulo por su index.ts (o por su ui/ para server actions).',
      severity: 'error',
      from: { path: '^apps/web/src/(app|flujos)/' },
      to: { path: '^apps/web/src/modules/[^/]+/(domain|application)/' },
    },
    {
      name: 'shared-no-conoce-modulos',
      severity: 'error',
      from: { path: '^apps/web/src/shared/', pathNot: SIN_TESTS },
      to: { path: '^apps/web/src/(modules|app|flujos)/', pathNot: '^apps/web/src/modules/contenido/' }, // contenido estático sin lógica: lo consumen sitio/ y legal/
    },
    {
      name: 'packages-no-conocen-la-app',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    { name: 'sin-ciclos', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'sin-huerfanos',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '\\.d\\.ts$',
          '(^|/)\\.[^/]+\\.(js|cjs|ts)$',
          SIN_TESTS,
          '/app/',
          'proxy\\.ts$',
          '/infrastructure/.+-(postgres|supabase|redis)\\.ts$',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules', '\\.next', '\\.turbo'] },
    exclude: { path: ['^(apps|packages)/[^/]+/(dist|\\.next)/'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.depcruise.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.json'],
    },
    reporterOptions: { dot: { collapsePattern: 'node_modules/(@[^/]+/[^/]+|[^/]+)' } },
  },
}
