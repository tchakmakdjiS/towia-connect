ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS work_done text,
  ADD COLUMN IF NOT EXISTS distance_km numeric,
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS operator_comment text;

ALTER TABLE public.mission_events
  ADD COLUMN IF NOT EXISTS previous_status public.mission_status,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

ALTER TABLE public.operators
  ADD COLUMN IF NOT EXISTS last_position_at timestamptz;

DROP POLICY IF EXISTS profiles_select_mission_client ON public.profiles;
CREATE POLICY profiles_select_mission_client ON public.profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.missions m
    WHERE m.client_id = profiles.id
      AND (
        m.operator_id = public.my_operator_id(auth.uid())
        OR (m.company_id IS NOT NULL AND public.owns_company(auth.uid(), m.company_id))
        OR EXISTS (
          SELECT 1 FROM public.mission_offers o
          WHERE o.mission_id = m.id AND o.operator_id = public.my_operator_id(auth.uid())
        )
      )
  )
);

DROP POLICY IF EXISTS operators_select_mission_client ON public.operators;
CREATE POLICY operators_select_mission_client ON public.operators
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.missions m
    WHERE m.client_id = auth.uid()
      AND (
        m.operator_id = operators.id
        OR EXISTS (
          SELECT 1 FROM public.mission_offers o
          WHERE o.mission_id = m.id AND o.operator_id = operators.id
        )
      )
  )
);

DROP POLICY IF EXISTS notifications_insert_mission_stakeholders ON public.notifications;
CREATE POLICY notifications_insert_mission_stakeholders ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  mission_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.missions m
    WHERE m.id = notifications.mission_id
      AND (
        m.client_id = auth.uid()
        OR m.operator_id = public.my_operator_id(auth.uid())
        OR (m.company_id IS NOT NULL AND public.owns_company(auth.uid(), m.company_id))
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
      AND (
        notifications.user_id = m.client_id
        OR notifications.user_id = auth.uid()
        OR notifications.user_id = (SELECT o.user_id FROM public.operators o WHERE o.id = m.operator_id)
      )
  )
);

DROP POLICY IF EXISTS payments_insert_operator ON public.payments;
CREATE POLICY payments_insert_operator ON public.payments
FOR INSERT TO authenticated
WITH CHECK (
  operator_id = public.my_operator_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.missions m
    WHERE m.id = payments.mission_id
      AND m.operator_id = public.my_operator_id(auth.uid())
      AND m.client_id = payments.client_id
  )
);
