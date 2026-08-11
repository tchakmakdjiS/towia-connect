ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS iban text;
ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS available_24_7 boolean NOT NULL DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS operators_count integer;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  r text := COALESCE(m->>'role', 'customer');
BEGIN
  IF r NOT IN ('customer','tow_operator','company') THEN r := 'customer'; END IF;

  INSERT INTO public.profiles (id, first_name, last_name, phone, email, address, city, postal_code)
  VALUES (NEW.id, m->>'first_name', m->>'last_name', m->>'phone', NEW.email,
          m->>'address', m->>'city', m->>'postal_code')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, r::public.app_role)
  ON CONFLICT DO NOTHING;

  IF r = 'tow_operator' THEN
    INSERT INTO public.operators (
      user_id, first_name, last_name, phone, email, company_name, siret,
      address, city, postal_code, intervention_zone, vehicle_type,
      services, iban, available_24_7, verification, availability, is_available
    )
    VALUES (
      NEW.id, m->>'first_name', m->>'last_name', m->>'phone', NEW.email,
      m->>'company_name', m->>'siret', m->>'address', m->>'city', m->>'postal_code',
      m->>'service_area', m->>'vehicle_types',
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(m->'services','[]'::jsonb))), '{}'::text[]),
      m->>'iban',
      COALESCE((m->>'available_24_7')::boolean, false),
      'PENDING', 'UNAVAILABLE', false
    );
  ELSIF r = 'company' THEN
    INSERT INTO public.companies (
      owner_id, name, email, phone, siret, address, city, postal_code,
      intervention_zone, operators_count, verification, is_active
    )
    VALUES (
      NEW.id, COALESCE(m->>'company_name', 'Mon entreprise'), NEW.email, m->>'phone',
      m->>'siret', m->>'address', m->>'city', m->>'postal_code',
      m->>'service_area', NULLIF(m->>'operators_count','')::integer,
      'PENDING', true
    );
  END IF;

  RETURN NEW;
END; $function$;