DROP POLICY IF EXISTS "Mission stakeholders add events" ON public.mission_events;
CREATE POLICY "Mission stakeholders add events" ON public.mission_events
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.missions m
    WHERE m.id = mission_events.mission_id
      AND (
        m.client_id = auth.uid()
        OR m.operator_id = public.my_operator_id(auth.uid())
        OR (m.company_id IS NOT NULL AND public.owns_company(auth.uid(), m.company_id))
        OR EXISTS (
          SELECT 1 FROM public.mission_offers o
          WHERE o.mission_id = m.id AND o.operator_id = public.my_operator_id(auth.uid())
        )
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
);
