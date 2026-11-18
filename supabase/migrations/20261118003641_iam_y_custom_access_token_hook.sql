-- ============================================================================
-- Migración 3: IAM administrativo y Custom Access Token Hook
-- Contratos de referencia:
--   - apps/web/src/modules/iam/domain/roles.ts
--   - docs/05 - Backend/Handoff para Backend.md (secciones 5 y 8)
-- ============================================================================

-- 1. Roles asignados exclusivamente por servidor (`administrador` | `consulta`)
CREATE TABLE public.usuario_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol text NOT NULL
    CONSTRAINT usuario_roles_rol_chk CHECK (rol IN ('administrador', 'consulta')),
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- 2. Perfiles mínimos para mostrar `Identidad.nombre` (nunca se usa para autorizar)
CREATE TABLE public.perfiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL
    CONSTRAINT perfiles_nombre_chk CHECK (char_length(btrim(nombre)) BETWEEN 2 AND 120),
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- 3. Custom Access Token Hook: proyecta `public.usuario_roles.rol` a `claims.app_metadata.rol`
-- preservando las demás claves de `app_metadata`. Se ejecuta con `SECURITY INVOKER`
-- bajo el rol `supabase_auth_admin` (al que se le otorga SELECT mínimo sobre `usuario_roles`).
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  claims jsonb;
  app_meta jsonb;
  rol_usuario text;
  uid uuid;
BEGIN
  uid := NULLIF(event->>'user_id', '')::uuid;

  SELECT ur.rol
    INTO rol_usuario
    FROM public.usuario_roles AS ur
   WHERE ur.user_id = uid;

  claims := CASE
    WHEN jsonb_typeof(event->'claims') = 'object' THEN event->'claims'
    ELSE '{}'::jsonb
  END;

  app_meta := CASE
    WHEN jsonb_typeof(claims->'app_metadata') = 'object' THEN claims->'app_metadata'
    ELSE '{}'::jsonb
  END;

  IF rol_usuario IS NOT NULL THEN
    app_meta := jsonb_set(app_meta, '{rol}', to_jsonb(rol_usuario), true);
  ELSE
    -- Si la cuenta no tiene fila en `usuario_roles`, elimina cualquier `rol` previo.
    app_meta := app_meta - 'rol';
  END IF;

  claims := jsonb_set(claims, '{app_metadata}', app_meta, true);

  RETURN jsonb_set(event, '{claims}', claims, true);
END;
$$;

-- 4. Privilegios estrictos para Supabase Auth (`supabase_auth_admin`)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON TABLE public.usuario_roles TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
