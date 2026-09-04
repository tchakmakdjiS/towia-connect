-- Helper functions (bypass RLS) to break recursive policy chains
CREATE OR REPLACE FUNCTION public.has_offer_for_mission(_mission_id uuid, _user_id uuid, _only_pending boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mission_offers o
    WHERE o.mission_id = _mission_id
      AND o.operator_id = public.my_operator_id(_user_id)
      AND (NOT _only_pending OR o.status = 'PENDING'::public.offer_status)
  );
$$;

CREATE OR REPLACE FUNCTION public.mission_client_id(_mission_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT client_id FROM public.missions WHERE id = _mission_id;
$$;

CREATE OR REPLACE FUNCTION public.mission_company_id(_mission_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.missions WHERE id = _mission_id;
$$;

CREATE OR REPLACE FUNCTION public.operator_serves_client(_operator_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.missions m
    WHERE m.client_id = _client_id
      AND (m.operator_id = _operator_id
           OR EXISTS (SELECT 1 FROM public.mission_offers o WHERE o.mission_id = m.id AND o.operator_id = _operator_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.pro_serves_client(_client_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.missions m
    WHERE m.client_id = _client_id
      AND (m.operator_id = public.my_operator_id(_user_id)
           OR (m.company_id IS NOT NULL AND public.owns_company(_user_id, m.company_id))
           OR EXISTS (SELECT 1 FROM public.mission_offers o WHERE o.mission_id = m.id AND o.operator_id = public.my_operator_id(_user_id)))
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_offer_for_mission(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mission_client_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mission_company_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.operator_serves_client(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pro_serves_client(uuid, uuid) TO authenticated;

-- missions
DROP POLICY IF EXISTS missions_select ON public.missions;
CREATE POLICY missions_select ON public.missions FOR SELECT TO authenticated
USING (
  client_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR operator_id = public.my_operator_id(auth.uid())
  OR public.owns_company(auth.uid(), company_id)
  OR public.has_offer_for_mission(id, auth.uid(), false)
);

DROP POLICY IF EXISTS missions_update ON public.missions;
CREATE POLICY missions_update ON public.missions FOR UPDATE TO authenticated
USING (
  client_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR operator_id = public.my_operator_id(auth.uid())
  OR public.owns_company(auth.uid(), company_id)
  OR public.has_offer_for_mission(id, auth.uid(), true)
) WITH CHECK (true);

-- mission_offers
DROP POLICY IF EXISTS offers_select ON public.mission_offers;
CREATE POLICY offers_select ON public.mission_offers FOR SELECT TO authenticated
USING (
  operator_id = public.my_operator_id(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.mission_client_id(mission_id) = auth.uid()
  OR public.owns_company(auth.uid(), public.mission_company_id(mission_id))
);

DROP POLICY IF EXISTS offers_insert ON public.mission_offers;
CREATE POLICY offers_insert ON public.mission_offers FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.mission_client_id(mission_id) = auth.uid()
);

-- operators
DROP POLICY IF EXISTS operators_select_mission_client ON public.operators;
CREATE POLICY operators_select_mission_client ON public.operators FOR SELECT TO authenticated
USING (public.operator_serves_client(id, auth.uid()));

-- profiles
DROP POLICY IF EXISTS profiles_select_mission_client ON public.profiles;
CREATE POLICY profiles_select_mission_client ON public.profiles FOR SELECT TO authenticated
USING (public.pro_serves_client(id, auth.uid()));