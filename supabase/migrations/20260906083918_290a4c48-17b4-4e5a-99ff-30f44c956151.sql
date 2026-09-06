CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  operator_id uuid REFERENCES public.operators(id) ON DELETE SET NULL,
  service_type public.mission_category NOT NULL,
  rule_name text,
  source text NOT NULL DEFAULT 'platform',
  base_price numeric NOT NULL DEFAULT 0,
  distance_km numeric,
  price_per_km numeric NOT NULL DEFAULT 0,
  distance_price numeric NOT NULL DEFAULT 0,
  supplements jsonb NOT NULL DEFAULT '{}'::jsonb,
  minimum_applied boolean NOT NULL DEFAULT false,
  total_estimate numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  breakdown jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quotes_mission_id_idx ON public.quotes(mission_id);

GRANT SELECT ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_select" ON public.quotes
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.mission_client_id(mission_id) = auth.uid()
  OR public.has_offer_for_mission(mission_id, auth.uid(), false)
  OR EXISTS (
    SELECT 1 FROM public.missions m
    WHERE m.id = quotes.mission_id
      AND (
        m.operator_id = public.my_operator_id(auth.uid())
        OR (m.company_id IS NOT NULL AND public.owns_company(auth.uid(), m.company_id))
      )
  )
);