-- ENUMS
CREATE TYPE public.app_role AS ENUM ('client','operator','company','admin');
CREATE TYPE public.mission_status AS ENUM ('CREATED','AI_ANALYSIS','SEARCHING','PROPOSED','ACCEPTED','EN_ROUTE','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED','DISPUTED');
CREATE TYPE public.mission_priority AS ENUM ('NORMAL','HIGH','EMERGENCY');
CREATE TYPE public.mission_category AS ENUM ('PANNE','REMORQUAGE','BATTERIE','CREVAISON','ERREUR_CARBURANT','ACCIDENT','VEHICULE_ELECTRIQUE','AUTRE');
CREATE TYPE public.offer_status AS ENUM ('PENDING','ACCEPTED','DECLINED','EXPIRED','CANCELLED');
CREATE TYPE public.payment_status AS ENUM ('PENDING','PROCESSING','PAID','FAILED','REFUNDED','CANCELLED');
CREATE TYPE public.verification_status AS ENUM ('PENDING','VERIFIED','REJECTED');

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- COMPANIES
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  legal_name TEXT,
  siret TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  verification public.verification_status NOT NULL DEFAULT 'PENDING',
  intervention_zone TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.owns_company(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND owner_id = _user_id);
$$;

-- OPERATORS
CREATE TABLE public.operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  photo_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT false,
  rating NUMERIC(3,2),
  intervention_zone TEXT,
  services TEXT[] NOT NULL DEFAULT '{}',
  equipment TEXT[] NOT NULL DEFAULT '{}',
  vehicle_label TEXT,
  verification public.verification_status NOT NULL DEFAULT 'PENDING',
  last_latitude DOUBLE PRECISION,
  last_longitude DOUBLE PRECISION,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operators TO authenticated;
GRANT ALL ON public.operators TO service_role;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.my_operator_id(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.operators WHERE user_id = _user_id LIMIT 1;
$$;

-- VEHICLES (client vehicles + company fleet)
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  brand TEXT,
  model TEXT,
  plate TEXT,
  year INT,
  energy TEXT,
  notes TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- EQUIPMENT
CREATE TABLE public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  quantity INT NOT NULL DEFAULT 1,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment TO authenticated;
GRANT ALL ON public.equipment TO service_role;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

-- DOCUMENTS
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES public.operators(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,
  file_url TEXT,
  status public.verification_status NOT NULL DEFAULT 'PENDING',
  expires_at DATE,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- MISSIONS
CREATE TABLE public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  status public.mission_status NOT NULL DEFAULT 'CREATED',
  category public.mission_category NOT NULL DEFAULT 'AUTRE',
  priority public.mission_priority NOT NULL DEFAULT 'NORMAL',
  description TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address TEXT,
  photo_url TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  departure_time TIMESTAMPTZ,
  arrival_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.missions TO authenticated;
GRANT ALL ON public.missions TO service_role;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

-- MISSION OFFERS
CREATE TABLE public.mission_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  score NUMERIC(6,2),
  distance_km NUMERIC(8,2),
  estimated_arrival TIMESTAMPTZ,
  status public.offer_status NOT NULL DEFAULT 'PENDING',
  offered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_demo BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE ON public.mission_offers TO authenticated;
GRANT ALL ON public.mission_offers TO service_role;
ALTER TABLE public.mission_offers ENABLE ROW LEVEL SECURITY;

-- AI
CREATE TABLE public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mission_ai_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  category public.mission_category,
  priority public.mission_priority,
  needs TEXT[] NOT NULL DEFAULT '{}',
  vehicle_summary TEXT,
  summary_for_operator TEXT,
  confidence NUMERIC(4,3),
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.mission_ai_analysis TO authenticated;
GRANT ALL ON public.mission_ai_analysis TO service_role;
ALTER TABLE public.mission_ai_analysis ENABLE ROW LEVEL SECURITY;

-- PAYMENTS
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  platform_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  professional_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status public.payment_status NOT NULL DEFAULT 'PENDING',
  provider_payment_id TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- INVOICES
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- REVIEWS
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  punctuality INT CHECK (punctuality BETWEEN 1 AND 5),
  professionalism INT CHECK (professionalism BETWEEN 1 AND 5),
  speed INT CHECK (speed BETWEEN 1 AND 5),
  quality INT CHECK (quality BETWEEN 1 AND 5),
  communication INT CHECK (communication BETWEEN 1 AND 5),
  comment TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mission_id)
);
GRANT SELECT, INSERT, UPDATE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read_at TIMESTAMPTZ,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles_insert_self_non_admin" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND role <> 'admin');

CREATE POLICY "companies_select" ON public.companies FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR id = (SELECT company_id FROM public.operators WHERE user_id = auth.uid()));
CREATE POLICY "companies_insert" ON public.companies FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "companies_update" ON public.companies FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "companies_delete" ON public.companies FOR DELETE TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "operators_select" ON public.operators FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.owns_company(auth.uid(), company_id));
CREATE POLICY "operators_insert" ON public.operators FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.owns_company(auth.uid(), company_id));
CREATE POLICY "operators_update" ON public.operators FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.owns_company(auth.uid(), company_id)) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.owns_company(auth.uid(), company_id));
CREATE POLICY "operators_delete" ON public.operators FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.owns_company(auth.uid(), company_id));

CREATE POLICY "vehicles_all" ON public.vehicles FOR ALL TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.owns_company(auth.uid(), company_id))
WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.owns_company(auth.uid(), company_id));

CREATE POLICY "equipment_all" ON public.equipment FOR ALL TO authenticated
USING (public.owns_company(auth.uid(), company_id) OR public.has_role(auth.uid(),'admin'))
WITH CHECK (public.owns_company(auth.uid(), company_id) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "documents_all" ON public.documents FOR ALL TO authenticated
USING (public.owns_company(auth.uid(), company_id) OR public.has_role(auth.uid(),'admin') OR operator_id = public.my_operator_id(auth.uid()))
WITH CHECK (public.owns_company(auth.uid(), company_id) OR public.has_role(auth.uid(),'admin') OR operator_id = public.my_operator_id(auth.uid()));

CREATE POLICY "missions_select" ON public.missions FOR SELECT TO authenticated USING (
  client_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR operator_id = public.my_operator_id(auth.uid())
  OR public.owns_company(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.mission_offers o WHERE o.mission_id = missions.id AND o.operator_id = public.my_operator_id(auth.uid()))
);
CREATE POLICY "missions_insert_own" ON public.missions FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid());
CREATE POLICY "missions_update" ON public.missions FOR UPDATE TO authenticated USING (
  client_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR operator_id = public.my_operator_id(auth.uid()) OR public.owns_company(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.mission_offers o WHERE o.mission_id = missions.id AND o.operator_id = public.my_operator_id(auth.uid()) AND o.status = 'PENDING')
) WITH CHECK (true);

CREATE POLICY "offers_select" ON public.mission_offers FOR SELECT TO authenticated USING (
  operator_id = public.my_operator_id(auth.uid())
  OR public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.missions m WHERE m.id = mission_id AND (m.client_id = auth.uid() OR public.owns_company(auth.uid(), m.company_id)))
);
CREATE POLICY "offers_insert" ON public.mission_offers FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.missions m WHERE m.id = mission_id AND m.client_id = auth.uid())
);
CREATE POLICY "offers_update" ON public.mission_offers FOR UPDATE TO authenticated USING (
  operator_id = public.my_operator_id(auth.uid()) OR public.has_role(auth.uid(),'admin')
) WITH CHECK (true);

CREATE POLICY "ai_conv_all" ON public.ai_conversations FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
WITH CHECK (user_id = auth.uid());

CREATE POLICY "ai_analysis_select" ON public.mission_ai_analysis FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR EXISTS (
    SELECT 1 FROM public.missions m WHERE m.id = mission_id AND (
      m.client_id = auth.uid() OR m.operator_id = public.my_operator_id(auth.uid()) OR public.owns_company(auth.uid(), m.company_id)
    )
  )
);
CREATE POLICY "ai_analysis_insert" ON public.mission_ai_analysis FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.missions m WHERE m.id = mission_id AND m.client_id = auth.uid()) OR public.has_role(auth.uid(),'admin')
);

CREATE POLICY "payments_select" ON public.payments FOR SELECT TO authenticated USING (
  client_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR operator_id = public.my_operator_id(auth.uid())
);
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT TO authenticated USING (
  client_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR operator_id = public.my_operator_id(auth.uid())
);

CREATE POLICY "reviews_select" ON public.reviews FOR SELECT TO authenticated USING (
  client_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR operator_id = public.my_operator_id(auth.uid())
);
CREATE POLICY "reviews_insert" ON public.reviews FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid());
CREATE POLICY "reviews_update_own" ON public.reviews FOR UPDATE TO authenticated USING (client_id = auth.uid()) WITH CHECK (client_id = auth.uid());

CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "notifications_insert_own" ON public.notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- TRIGGERS
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_operators_updated BEFORE UPDATE ON public.operators FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_missions_updated BEFORE UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ai_conv_updated BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AUTO PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  IF NEW.raw_user_meta_data->>'role' IN ('client','operator','company') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::public.app_role)
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE INDEX idx_missions_client ON public.missions(client_id);
CREATE INDEX idx_missions_operator ON public.missions(operator_id);
CREATE INDEX idx_offers_operator ON public.mission_offers(operator_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);