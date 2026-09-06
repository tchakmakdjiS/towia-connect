
CREATE TABLE IF NOT EXISTS public.operator_sensitive (
  operator_id uuid PRIMARY KEY REFERENCES public.operators(id) ON DELETE CASCADE,
  iban text,
  siret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_sensitive TO authenticated;
GRANT ALL ON public.operator_sensitive TO service_role;

ALTER TABLE public.operator_sensitive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operator_sensitive_owner" ON public.operator_sensitive;
CREATE POLICY "operator_sensitive_owner" ON public.operator_sensitive FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.operators o WHERE o.id = operator_id
             AND (o.user_id = auth.uid() OR public.owns_company(auth.uid(), o.company_id)))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.operators o WHERE o.id = operator_id
             AND (o.user_id = auth.uid() OR public.owns_company(auth.uid(), o.company_id)))
);

DROP TRIGGER IF EXISTS trg_operator_sensitive_updated ON public.operator_sensitive;
CREATE TRIGGER trg_operator_sensitive_updated BEFORE UPDATE ON public.operator_sensitive
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.operator_sensitive (operator_id, iban, siret)
SELECT id, iban, siret FROM public.operators
ON CONFLICT (operator_id) DO NOTHING;

ALTER TABLE public.operators DROP COLUMN IF EXISTS iban;
ALTER TABLE public.operators DROP COLUMN IF EXISTS siret;

DROP VIEW IF EXISTS public.operator_public_profiles;

DROP POLICY IF EXISTS "operators_select_mission_client" ON public.operators;
CREATE POLICY "operators_select_mission_client" ON public.operators FOR SELECT TO authenticated
USING (public.operator_serves_client(id, auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  r text := COALESCE(m->>'role', 'customer');
  v_operator_id uuid;
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
      user_id, first_name, last_name, phone, email, company_name,
      address, city, postal_code, intervention_zone, vehicle_type,
      services, available_24_7, verification, availability, is_available
    )
    VALUES (
      NEW.id, m->>'first_name', m->>'last_name', m->>'phone', NEW.email,
      m->>'company_name', m->>'address', m->>'city', m->>'postal_code',
      m->>'service_area', m->>'vehicle_types',
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(m->'services','[]'::jsonb))), '{}'::text[]),
      COALESCE((m->>'available_24_7')::boolean, false),
      'PENDING', 'UNAVAILABLE', false
    )
    RETURNING id INTO v_operator_id;

    INSERT INTO public.operator_sensitive (operator_id, iban, siret)
    VALUES (v_operator_id, m->>'iban', m->>'siret')
    ON CONFLICT (operator_id) DO NOTHING;
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
