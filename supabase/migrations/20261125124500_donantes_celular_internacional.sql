-- Permitir teléfonos internacionales en formato E.164 (p. ej. +13055551234, +34612345678)
-- además de los celulares colombianos (+573XXXXXXXXX), para donantes del exterior.

ALTER TABLE public.donantes
  DROP CONSTRAINT IF EXISTS donantes_celular_chk;

ALTER TABLE public.donantes
  ADD CONSTRAINT donantes_celular_chk CHECK (celular ~ '^\+[1-9][0-9]{6,14}$');
