
-- 1) MISSIONS : garde colonne par colonne
CREATE OR REPLACE FUNCTION public.guard_mission_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  NEW.client_id        := OLD.client_id;
  NEW.amount           := OLD.amount;
  NEW.estimated_amount := OLD.estimated_amount;
  NEW.price_breakdown  := OLD.price_breakdown;
  NEW.payment_status   := OLD.payment_status;
  NEW.is_demo          := OLD.is_demo;
  NEW.request_id       := OLD.request_id;
  NEW.created_at       := OLD.created_at;

  IF NEW.operator_id IS DISTINCT FROM OLD.operator_id THEN
    IF OLD.operator_id IS NULL
       AND NEW.operator_id = public.my_operator_id(auth.uid())
       AND public.has_offer_for_mission(OLD.id, auth.uid(), true) THEN
      NULL;
    ELSE
      NEW.operator_id := OLD.operator_id;
    END IF;
  END IF;

  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    IF OLD.company_id IS NULL
       AND NEW.operator_id IS NOT NULL
       AND NEW.operator_id = public.my_operator_id(auth.uid()) THEN
      NULL;
    ELSE
      NEW.company_id := OLD.company_id;
    END IF;
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.guard_mission_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_mission_update ON public.missions;
CREATE TRIGGER trg_guard_mission_update
BEFORE UPDATE ON public.missions
FOR EACH ROW EXECUTE FUNCTION public.guard_mission_update();

DROP POLICY IF EXISTS "missions_update" ON public.missions;
CREATE POLICY "missions_update" ON public.missions FOR UPDATE TO authenticated
USING (
  client_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR operator_id = public.my_operator_id(auth.uid())
  OR public.owns_company(auth.uid(), company_id)
  OR public.has_offer_for_mission(id, auth.uid(), true)
)
WITH CHECK (
  client_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR operator_id = public.my_operator_id(auth.uid())
  OR public.owns_company(auth.uid(), company_id)
  OR public.has_offer_for_mission(id, auth.uid(), true)
);

-- 2) PAIEMENTS : plus aucune écriture directe par le client
DROP POLICY IF EXISTS "payments_client_update_pending" ON public.payments;

-- 3) OPERATEURS : masquer IBAN / SIRET / email aux clients
DROP POLICY IF EXISTS "operators_select_mission_client" ON public.operators;

DROP VIEW IF EXISTS public.operator_public_profiles;
CREATE VIEW public.operator_public_profiles AS
SELECT o.id, o.company_id, o.first_name, o.last_name, o.professional_name,
       o.company_name, o.phone, o.photo_url, o.rating, o.vehicle_label,
       o.vehicle_type, o.services, o.equipment, o.intervention_zone, o.city,
       o.postal_code, o.availability, o.is_available, o.verification,
       o.available_24_7, o.last_latitude, o.last_longitude, o.last_position_at
FROM public.operators o
WHERE o.user_id = auth.uid()
   OR public.has_role(auth.uid(), 'admin')
   OR public.owns_company(auth.uid(), o.company_id)
   OR public.operator_serves_client(o.id, auth.uid());

GRANT SELECT ON public.operator_public_profiles TO authenticated;

-- 4) TARIFS : lecture réservée aux parties concernées
DROP POLICY IF EXISTS "operator_pricing_read" ON public.operator_pricing;
CREATE POLICY "operator_pricing_read" ON public.operator_pricing FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (operator_id IS NOT NULL AND operator_id = public.my_operator_id(auth.uid()))
  OR (company_id IS NOT NULL AND public.owns_company(auth.uid(), company_id))
  OR (operator_id IS NOT NULL AND public.operator_serves_client(operator_id, auth.uid()))
  OR (company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.missions m
        WHERE m.client_id = auth.uid() AND m.company_id = operator_pricing.company_id))
);

-- 5) Fonctions SECURITY DEFINER : cloisonnement au demandeur
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR _user_id = auth.uid()
      THEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
    ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
         AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
  END;
$$;

CREATE OR REPLACE FUNCTION public.my_operator_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.operators
  WHERE user_id = _user_id
    AND (auth.uid() IS NULL OR _user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.owns_company(_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
     AND EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND owner_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.has_offer_for_mission(_mission_id uuid, _user_id uuid, _only_pending boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
     AND EXISTS (
      SELECT 1 FROM public.mission_offers o
      WHERE o.mission_id = _mission_id
        AND o.operator_id = public.my_operator_id(_user_id)
        AND (NOT _only_pending OR o.status = 'PENDING'::public.offer_status)
    );
$$;

CREATE OR REPLACE FUNCTION public.pro_serves_client(_client_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
     AND EXISTS (
    SELECT 1 FROM public.missions m
    WHERE m.client_id = _client_id
      AND (m.operator_id = public.my_operator_id(_user_id)
           OR (m.company_id IS NOT NULL AND public.owns_company(_user_id, m.company_id))
           OR EXISTS (SELECT 1 FROM public.mission_offers o WHERE o.mission_id = m.id AND o.operator_id = public.my_operator_id(_user_id)))
  );
$$;

CREATE OR REPLACE FUNCTION public.operator_serves_client(_operator_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (auth.uid() IS NULL OR _client_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
     AND EXISTS (
    SELECT 1 FROM public.missions m
    WHERE m.client_id = _client_id
      AND (m.operator_id = _operator_id
           OR EXISTS (SELECT 1 FROM public.mission_offers o WHERE o.mission_id = m.id AND o.operator_id = _operator_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.mission_client_id(_mission_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT client_id FROM public.missions
  WHERE id = _mission_id
    AND (auth.uid() IS NULL OR client_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
$$;

CREATE OR REPLACE FUNCTION public.mission_company_id(_mission_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.missions
  WHERE id = _mission_id
    AND (auth.uid() IS NULL OR public.owns_company(auth.uid(), company_id) OR public.has_role(auth.uid(), 'admin'));
$$;
