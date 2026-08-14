-- 1. pricing_rules
CREATE TABLE public.pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type public.mission_category NOT NULL,
  name text NOT NULL,
  base_price numeric(10,2) NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  price_per_km numeric(10,2) NOT NULL DEFAULT 0 CHECK (price_per_km >= 0),
  minimum_price numeric(10,2) NOT NULL DEFAULT 0 CHECK (minimum_price >= 0),
  night_surcharge numeric(10,2) NOT NULL DEFAULT 0 CHECK (night_surcharge >= 0),
  weekend_surcharge numeric(10,2) NOT NULL DEFAULT 0 CHECK (weekend_surcharge >= 0),
  emergency_surcharge numeric(10,2) NOT NULL DEFAULT 0 CHECK (emergency_surcharge >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pricing_rules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pricing_rules TO authenticated;
GRANT ALL ON public.pricing_rules TO service_role;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_rules_read" ON public.pricing_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "pricing_rules_admin_write" ON public.pricing_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_pricing_rules_updated BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. operator_pricing
CREATE TABLE public.operator_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid REFERENCES public.operators(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  service_type public.mission_category NOT NULL,
  base_price numeric(10,2) NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  price_per_km numeric(10,2) NOT NULL DEFAULT 0 CHECK (price_per_km >= 0),
  minimum_price numeric(10,2) NOT NULL DEFAULT 0 CHECK (minimum_price >= 0),
  night_surcharge numeric(10,2) NOT NULL DEFAULT 0 CHECK (night_surcharge >= 0),
  weekend_surcharge numeric(10,2) NOT NULL DEFAULT 0 CHECK (weekend_surcharge >= 0),
  emergency_surcharge numeric(10,2) NOT NULL DEFAULT 0 CHECK (emergency_surcharge >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operator_pricing_owner_chk CHECK (operator_id IS NOT NULL OR company_id IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_pricing TO authenticated;
GRANT ALL ON public.operator_pricing TO service_role;
ALTER TABLE public.operator_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operator_pricing_read" ON public.operator_pricing FOR SELECT TO authenticated USING (true);
CREATE POLICY "operator_pricing_owner_write" ON public.operator_pricing FOR ALL TO authenticated
  USING (
    (operator_id IS NOT NULL AND operator_id = public.my_operator_id(auth.uid()))
    OR (company_id IS NOT NULL AND public.owns_company(auth.uid(), company_id))
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    (operator_id IS NOT NULL AND operator_id = public.my_operator_id(auth.uid()))
    OR (company_id IS NOT NULL AND public.owns_company(auth.uid(), company_id))
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE TRIGGER trg_operator_pricing_updated BEFORE UPDATE ON public.operator_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. platform_settings
CREATE TABLE public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_settings_read" ON public.platform_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "platform_settings_admin_write" ON public.platform_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_platform_settings_updated BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.platform_settings (key, value) VALUES
  ('platform_fee_percentage', '10'::jsonb),
  ('payments_mode', '"test"'::jsonb);

-- 4. refunds
CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  reason text,
  administrator_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refunds_admin_all" ON public.refunds FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "refunds_client_read" ON public.refunds FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payments p WHERE p.id = payment_id AND p.client_id = auth.uid()));

-- 5. payments enrichment
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id),
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS breakdown jsonb;

CREATE POLICY "payments_client_insert" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());
CREATE POLICY "payments_client_update_pending" ON public.payments FOR UPDATE TO authenticated
  USING (client_id = auth.uid() AND status IN ('PENDING','PROCESSING','FAILED'))
  WITH CHECK (client_id = auth.uid());
CREATE POLICY "payments_admin_update" ON public.payments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. invoices enrichment
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id),
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz NOT NULL DEFAULT now();

CREATE POLICY "invoices_client_insert" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());

-- 7. missions payment fields
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS estimated_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_breakdown jsonb;

-- 8. demo pricing rules
INSERT INTO public.pricing_rules (service_type, name, base_price, price_per_km, minimum_price, night_surcharge, weekend_surcharge, emergency_surcharge) VALUES
  ('PANNE', 'Dépannage sur place', 50, 2, 50, 20, 20, 30),
  ('BATTERIE', 'Démarrage / batterie', 50, 2, 50, 20, 20, 30),
  ('CREVAISON', 'Crevaison', 50, 2, 50, 20, 20, 30),
  ('CLES_ENFERMEES', 'Ouverture de véhicule', 50, 2, 50, 20, 20, 30),
  ('ERREUR_CARBURANT', 'Panne de carburant', 50, 2, 50, 20, 20, 30),
  ('VEHICULE_ELECTRIQUE', 'Assistance véhicule électrique', 50, 2, 50, 20, 20, 30),
  ('AUTRE', 'Intervention générale', 50, 2, 50, 20, 20, 30),
  ('REMORQUAGE', 'Remorquage', 89, 2, 89, 20, 20, 30),
  ('ACCIDENT', 'Intervention accident', 89, 2, 89, 20, 20, 30),
  ('FUMEE_DANGER', 'Intervention urgence danger', 89, 2, 89, 20, 20, 30);