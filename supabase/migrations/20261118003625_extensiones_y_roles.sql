-- ============================================================================
-- Migración 1: Esquemas aislados, extensiones y roles de mínimo privilegio
-- Proyecto: Fundación Proinserco
-- ============================================================================

-- 1. Esquemas dedicados: `extensions` para extensiones y `private` para helpers internos
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- 2. Extensiones requeridas fuera de `public`
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 3. Roles de aplicación de mínimo privilegio (NOLOGIN) y rol de conexión (LOGIN)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'proinserco_publico') THEN
    CREATE ROLE proinserco_publico NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'proinserco_sistema') THEN
    CREATE ROLE proinserco_sistema NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'proinserco_panel') THEN
    CREATE ROLE proinserco_panel NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'proinserco_app') THEN
    -- La contraseña de `proinserco_app` NUNCA va en migraciones ni en Git.
    -- Configúrala por entorno fuera de SQL:
    --   ALTER ROLE proinserco_app WITH PASSWORD '<secreto-generado>';
    CREATE ROLE proinserco_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;

-- `proinserco_app` es NOINHERIT: cada transacción debe ejecutar explícitamente
-- `SET LOCAL ROLE proinserco_publico | proinserco_sistema | proinserco_panel`.
GRANT proinserco_publico TO proinserco_app;
GRANT proinserco_sistema TO proinserco_app;
GRANT proinserco_panel TO proinserco_app;

-- 4. Cerrar Data API pública y GraphQL al navegador; solo USAGE mínimo en `public` y `extensions`
REVOKE ALL ON SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO postgres, service_role, supabase_auth_admin, proinserco_publico, proinserco_sistema, proinserco_panel;
GRANT USAGE ON SCHEMA extensions TO postgres, service_role, supabase_auth_admin, proinserco_publico, proinserco_sistema, proinserco_panel;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'graphql_public') THEN
    REVOKE ALL ON SCHEMA graphql_public FROM PUBLIC, anon, authenticated;
  END IF;
END
$$;

-- 5. Privilegios por defecto seguros para objetos futuros creados por `postgres`
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TYPES FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private
  REVOKE ALL ON TYPES FROM PUBLIC, anon, authenticated;
