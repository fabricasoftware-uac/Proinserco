-- ============================================================================
-- SOLO PRUEBAS (CI y local): prepara un PostgreSQL "plano" (imagen oficial `postgres`)
-- con lo mínimo que el stack de Supabase ya trae y que las migraciones dan por hecho.
--
-- Por qué no la imagen `supabase/postgres`: pesa ~1 GB, arranca lenta y exige su propio
-- juego de contraseñas y scripts de init. Para probar RLS, privilegios, triggers y las
-- funciones SECURITY DEFINER basta con los roles y el esquema `auth` que crea Supabase.
--
-- Diferencias conocidas frente a Supabase real (documentadas en el Handoff, sección 12):
--   - `auth.users` es una tabla mínima (id, email); GoTrue no corre.
--   - El usuario de conexión de las pruebas es superusuario (`postgres` de la imagen):
--     puede asumir anon/service_role y comprobar triggers como dueño. En Supabase el
--     rol `postgres` NO es superusuario; por eso las funciones del flujo público tienen
--     su propio dueño sin BYPASSRLS y sus propias políticas.
--
-- NUNCA se ejecuta contra staging ni producción.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT;
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  email text
);
