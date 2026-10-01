CREATE OR REPLACE FUNCTION public.guard_mission_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin')
     OR current_setting('towia.company_assign', true) = 'on' THEN
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
    IF OLD.company_id IS NULL AND NEW.operator_id IS NOT NULL
       AND NEW.operator_id = public.my_operator_id(auth.uid()) THEN
      NULL;
    ELSE
      NEW.company_id := OLD.company_id;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- Missions disponibles pour l'entreprise connectée (non attribuées, en recherche)
CREATE OR REPLACE FUNCTION public.company_available_missions(_mission_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid, status public.mission_status, category public.mission_category,
  priority public.mission_priority, description text, address text, city text,
  postal_code text, latitude double precision, longitude double precision,
  vehicle_make text, vehicle_model text, vehicle_year integer, vehicle_registration text,
  estimated_amount numeric, distance_km numeric, created_at timestamptz, has_offer boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH c AS (
    SELECT co.id FROM public.companies co
    WHERE co.owner_id = auth.uid() AND co.is_active
    LIMIT 1
  )
  SELECT m.id, m.status, m.category, m.priority, m.description, m.address, m.city,
         m.postal_code, m.latitude, m.longitude, m.vehicle_make, m.vehicle_model,
         m.vehicle_year, m.vehicle_registration, m.estimated_amount,
         COALESCE(m.distance_km, (SELECT min(o.distance_km) FROM public.mission_offers o
            JOIN public.operators op ON op.id = o.operator_id
            WHERE o.mission_id = m.id AND op.company_id = (SELECT id FROM c))),
         m.created_at,
         EXISTS (SELECT 1 FROM public.mission_offers o JOIN public.operators op ON op.id = o.operator_id
                 WHERE o.mission_id = m.id AND op.company_id = (SELECT id FROM c) AND o.status = 'PENDING')
  FROM public.missions m
  WHERE EXISTS (SELECT 1 FROM c)
    AND m.operator_id IS NULL
    AND m.status IN ('SEARCHING','PROPOSED')
    AND (_mission_id IS NULL OR m.id = _mission_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.mission_offers o JOIN public.operators op ON op.id = o.operator_id
      WHERE o.mission_id = m.id AND op.company_id = (SELECT id FROM c) AND o.status = 'DECLINED'
        AND NOT EXISTS (SELECT 1 FROM public.mission_offers o2 JOIN public.operators op2 ON op2.id = o2.operator_id
                        WHERE o2.mission_id = m.id AND op2.company_id = (SELECT id FROM c) AND o2.status = 'PENDING'))
  ORDER BY m.created_at DESC;
$$;

-- Attribution atomique : une seule entreprise peut prendre la mission
CREATE OR REPLACE FUNCTION public.company_take_mission(_mission_id uuid, _operator_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_company uuid;
  v_client uuid;
  v_op_user uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT id INTO v_company FROM public.companies WHERE owner_id = auth.uid() AND is_active LIMIT 1;
  IF v_company IS NULL THEN RAISE EXCEPTION 'NOT_A_COMPANY'; END IF;

  SELECT user_id INTO v_op_user FROM public.operators
   WHERE id = _operator_id AND company_id = v_company AND verification <> 'SUSPENDED';
  IF NOT FOUND THEN RAISE EXCEPTION 'OPERATOR_NOT_IN_COMPANY'; END IF;

  PERFORM set_config('towia.company_assign', 'on', true);
  UPDATE public.missions
     SET operator_id = _operator_id, company_id = v_company,
         status = 'ACCEPTED', accepted_at = now()
   WHERE id = _mission_id AND operator_id IS NULL AND status IN ('SEARCHING','PROPOSED')
  RETURNING client_id INTO v_client;
  PERFORM set_config('towia.company_assign', 'off', true);

  IF v_client IS NULL THEN RAISE EXCEPTION 'MISSION_ALREADY_TAKEN'; END IF;

  UPDATE public.mission_offers SET status = 'ACCEPTED', responded_at = now()
   WHERE mission_id = _mission_id AND operator_id = _operator_id AND status = 'PENDING';
  UPDATE public.mission_offers SET status = 'CANCELLED', responded_at = now()
   WHERE mission_id = _mission_id AND operator_id <> _operator_id AND status = 'PENDING';

  INSERT INTO public.notifications (user_id, mission_id, event, title, body)
  VALUES (v_client, _mission_id, 'OPERATOR_FOUND', 'Votre dépanneur a accepté votre demande.',
          'Un professionnel prend en charge votre intervention.');
  IF v_op_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, mission_id, event, title, body)
    VALUES (v_op_user, _mission_id, 'MISSION_ASSIGNED', 'Nouvelle mission attribuée',
            'Votre entreprise vous a affecté une intervention.');
  END IF;
  RETURN _mission_id;
END $$;

CREATE OR REPLACE FUNCTION public.company_decline_mission(_mission_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_company uuid;
BEGIN
  SELECT id INTO v_company FROM public.companies WHERE owner_id = auth.uid() LIMIT 1;
  IF v_company IS NULL THEN RAISE EXCEPTION 'NOT_A_COMPANY'; END IF;
  UPDATE public.mission_offers o SET status = 'DECLINED', responded_at = now()
   FROM public.operators op
   WHERE o.operator_id = op.id AND op.company_id = v_company
     AND o.mission_id = _mission_id AND o.status = 'PENDING';
  IF NOT FOUND THEN
    INSERT INTO public.mission_offers (mission_id, operator_id, status, responded_at)
    SELECT _mission_id, op.id, 'DECLINED', now() FROM public.operators op
     WHERE op.company_id = v_company LIMIT 1;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.company_available_missions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.company_take_mission(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.company_decline_mission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_available_missions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_take_mission(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_decline_mission(uuid) TO authenticated;