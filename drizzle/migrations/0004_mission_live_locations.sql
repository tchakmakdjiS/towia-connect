CREATE TABLE public.mission_live_locations (
  mission_id uuid PRIMARY KEY REFERENCES public.missions(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  heading double precision,
  speed double precision,
  accuracy double precision,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_live_locations TO authenticated;
GRANT ALL ON public.mission_live_locations TO service_role;
ALTER TABLE public.mission_live_locations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_share_live_location(_mission_id uuid, _operator_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.missions m
    WHERE m.id = _mission_id
      AND m.operator_id = _operator_id
      AND _operator_id = public.my_operator_id(_user_id)
      AND m.status IN ('ACCEPTED','EN_ROUTE','ARRIVED','IN_PROGRESS')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_live_location(_mission_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.missions m
    WHERE m.id = _mission_id
      AND m.status IN ('ACCEPTED','EN_ROUTE','ARRIVED','IN_PROGRESS')
      AND (
        m.client_id = _user_id
        OR m.operator_id = public.my_operator_id(_user_id)
        OR (m.company_id IS NOT NULL AND public.owns_company(_user_id, m.company_id))
        OR public.has_role(_user_id, 'admin')
      )
  )
$$;

CREATE POLICY live_loc_select ON public.mission_live_locations FOR SELECT TO authenticated
  USING (public.can_view_live_location(mission_id, auth.uid()));
CREATE POLICY live_loc_insert ON public.mission_live_locations FOR INSERT TO authenticated
  WITH CHECK (public.can_share_live_location(mission_id, operator_id, auth.uid()));
CREATE POLICY live_loc_update ON public.mission_live_locations FOR UPDATE TO authenticated
  USING (public.can_share_live_location(mission_id, operator_id, auth.uid()))
  WITH CHECK (public.can_share_live_location(mission_id, operator_id, auth.uid()));
CREATE POLICY live_loc_delete ON public.mission_live_locations FOR DELETE TO authenticated
  USING (operator_id = public.my_operator_id(auth.uid()));

CREATE OR REPLACE FUNCTION public.clear_live_location_on_close()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('COMPLETED','CANCELLED','DISPUTED') AND NEW.status IS DISTINCT FROM OLD.status THEN
    DELETE FROM public.mission_live_locations WHERE mission_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER missions_clear_live_location AFTER UPDATE OF status ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.clear_live_location_on_close();

ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_live_locations;