import { defineConfig, devices } from '@playwright/test'

/**
 * E2E contra la versión COMPILADA (next build + next start), nunca next dev
 * (Gotchas Verificados: el rendimiento y la CSP se comportan distinto).
 * La batería de pruebas la escriben los agentes de interfaz en ./e2e.
 * Requisitos de la batería (vault): fallar ante cualquier error de consola
 * (CSP rota), axe-core con @axe-core/playwright en ambos temas del panel,
 * banner de cookies sin peticiones de terceros, no-store en el panel.
 */
const PUERTO = Number(process.env.PUERTO_E2E ?? 3100)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    trace: 'retain-on-failure',
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm start --port ${PUERTO}`,
    url: `http://localhost:${PUERTO}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
