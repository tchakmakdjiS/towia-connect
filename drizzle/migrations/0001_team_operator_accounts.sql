ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'ACTIVE'
  CHECK (account_status IN ('INVITED','ACTIVE','DISABLED'));

CREATE OR REPLACE FUNCTION public.guard_operator_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- Nobody but admin/server may relink the account or move the operator to another company
  NEW.user_id := OLD.user_id;
  NEW.company_id := OLD.company_id;
  IF NEW.account_status IS DISTINCT FROM OLD.account_status
     AND NOT (OLD.company_id IS NOT NULL AND public.owns_company(auth.uid(), OLD.company_id)) THEN
    NEW.account_status := OLD.account_status;
  END IF;
  IF NEW.account_status = 'DISABLED' THEN
    NEW.is_available := false;
    NEW.availability := 'UNAVAILABLE';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_operator_identity ON public.operators;
CREATE TRIGGER trg_guard_operator_identity BEFORE UPDATE ON public.operators
  FOR EACH ROW EXECUTE FUNCTION public.guard_operator_identity();

CREATE OR REPLACE FUNCTION public.company_take_mission(_mission_id uuid, _operator_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_company uuid;
  v_client uuid;
  v_op_user uuid;
  m record;
  v_body text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT id INTO v_company FROM public.companies WHERE owner_id = auth.uid() AND is_active LIMIT 1;
  IF v_company IS NULL THEN RAISE EXCEPTION 'NOT_A_COMPANY'; END IF;

  SELECT user_id INTO v_op_user FROM public.operators
   WHERE id = _operator_id AND company_id = v_company
     AND verification <> 'SUSPENDED' AND account_status <> 'DISABLED';
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
    SELECT category, priority, address, city, created_at INTO m FROM public.missions WHERE id = _mission_id;
    v_body := concat_ws(' · ',
      m.category::text,
      CASE m.priority WHEN 'EMERGENCY' THEN 'URGENCE' WHEN 'HIGH' THEN 'Prioritaire' ELSE 'Normale' END,
      NULLIF(concat_ws(', ', m.address, m.city), ''),
      to_char(m.created_at AT TIME ZONE 'Europe/Paris', 'DD/MM HH24:MI'));
    INSERT INTO public.notifications (user_id, mission_id, event, title, body)
    VALUES (v_op_user, _mission_id, 'MISSION_ASSIGNED', 'Nouvelle mission attribuée', v_body);
  END IF;
  RETURN _mission_id;
END $function$;