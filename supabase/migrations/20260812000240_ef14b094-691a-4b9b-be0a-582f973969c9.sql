ALTER TYPE public.mission_category ADD VALUE IF NOT EXISTS 'CLES_ENFERMEES';
ALTER TYPE public.mission_category ADD VALUE IF NOT EXISTS 'FUMEE_DANGER';

CREATE TABLE IF NOT EXISTS public.assistance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  service_type public.mission_category,
  urgency public.mission_priority NOT NULL DEFAULT 'NORMAL',
  problem_description text,
  vehicle_make text,
  vehicle_model text,
  vehicle_year integer,
  vehicle_registration text,
  latitude double precision,
  longitude double precision,
  address text,
  city text,
  postal_code text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  safety_notice text,
  mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistance_requests TO authenticated;
GRANT ALL ON public.assistance_requests TO service_role;
ALTER TABLE public.assistance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their assistance requests"
ON public.assistance_requests FOR ALL TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_assistance_requests_updated
BEFORE UPDATE ON public.assistance_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES public.assistance_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vehicle_make text,
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS vehicle_year integer,
  ADD COLUMN IF NOT EXISTS vehicle_registration text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS postal_code text;

CREATE TABLE IF NOT EXISTS public.mission_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.assistance_requests(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_photos TO authenticated;
GRANT ALL ON public.mission_photos TO service_role;
ALTER TABLE public.mission_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their mission photos"
ON public.mission_photos FOR ALL TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Assigned operators read mission photos"
ON public.mission_photos FOR SELECT TO authenticated
USING (
  mission_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.missions m
    WHERE m.id = mission_photos.mission_id
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

CREATE TABLE IF NOT EXISTS public.mission_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  status public.mission_status,
  label text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.mission_events TO authenticated;
GRANT ALL ON public.mission_events TO service_role;
ALTER TABLE public.mission_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mission stakeholders read events"
ON public.mission_events FOR SELECT TO authenticated
USING (
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
        OR public.has_role(auth.uid(), 'admin')
      )
  )
);

CREATE POLICY "Mission stakeholders add events"
ON public.mission_events FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.missions m
    WHERE m.id = mission_events.mission_id
      AND (
        m.client_id = auth.uid()
        OR m.operator_id = public.my_operator_id(auth.uid())
        OR (m.company_id IS NOT NULL AND public.owns_company(auth.uid(), m.company_id))
        OR public.has_role(auth.uid(), 'admin')
      )
  )
);

CREATE INDEX IF NOT EXISTS idx_mission_events_mission ON public.mission_events(mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_photos_request ON public.mission_photos(request_id);
CREATE INDEX IF NOT EXISTS idx_assistance_requests_user ON public.assistance_requests(user_id);