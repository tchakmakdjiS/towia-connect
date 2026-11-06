CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Devices (one row per browser / phone registration token)
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  device_label text,
  platform text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_subs_user ON public.push_subscriptions(user_id);
GRANT SELECT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_subs_select_own ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY push_subs_delete_own ON public.push_subscriptions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Preferences
CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY,
  push_enabled boolean NOT NULL DEFAULT true,
  categories jsonb NOT NULL DEFAULT '{"missions":true,"new_missions":true,"payments":true,"admin":true,"messages":true}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_prefs_select_own ON public.notification_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notif_prefs_insert_own ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY notif_prefs_update_own ON public.notification_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Push bookkeeping on notifications (dedupe)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS push_claimed_at timestamptz;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS push_sent_count integer;

CREATE OR REPLACE FUNCTION public.notification_category(_event text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _event IN ('NEW_MISSION_AVAILABLE') THEN 'new_missions'
    WHEN _event LIKE 'PAYMENT%' THEN 'payments'
    WHEN _event LIKE 'ADMIN%' THEN 'admin'
    WHEN _event LIKE 'MESSAGE%' THEN 'messages'
    ELSE 'missions' END
$$;

CREATE OR REPLACE FUNCTION public.notifications_before_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.category := COALESCE(NEW.category, public.notification_category(NEW.event));
  NEW.push_claimed_at := NULL;
  NEW.push_sent_count := NULL;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notifications_category BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.notifications_before_insert();

-- Ask the app server to deliver the push (it re-reads the row and claims it once)
CREATE OR REPLACE FUNCTION public.notifications_dispatch_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF COALESCE(NEW.is_demo, false) THEN RETURN NEW; END IF;
  BEGIN
    PERFORM net.http_post(
      url := 'https://project--2dcca803-c083-4087-8bc0-cbc16de4d6d7.lovable.app/api/public/push-dispatch',
      body := jsonb_build_object('id', NEW.id),
      headers := '{"Content-Type":"application/json"}'::jsonb);
    PERFORM net.http_post(
      url := 'https://project--2dcca803-c083-4087-8bc0-cbc16de4d6d7-dev.lovable.app/api/public/push-dispatch',
      body := jsonb_build_object('id', NEW.id),
      headers := '{"Content-Type":"application/json"}'::jsonb);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notifications_push AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.notifications_dispatch_push();

-- Helper: notify every admin
CREATE OR REPLACE FUNCTION public.notify_admins(_mission uuid, _event text, _title text, _body text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (user_id, mission_id, event, title, body)
  SELECT ur.user_id, _mission, _event, _title, _body FROM public.user_roles ur WHERE ur.role = 'admin';
$$;
REVOKE ALL ON FUNCTION public.notify_admins(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- New offer => the targeted professional (dispatch already filtered zone/availability/type)
CREATE OR REPLACE FUNCTION public.notify_new_offer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_company uuid; v_owner uuid; m record; v_body text;
BEGIN
  IF COALESCE(NEW.is_demo, false) OR NEW.status <> 'PENDING' THEN RETURN NEW; END IF;
  SELECT user_id, company_id INTO v_user, v_company FROM public.operators WHERE id = NEW.operator_id;
  SELECT category, priority, city INTO m FROM public.missions WHERE id = NEW.mission_id;
  v_body := concat_ws(' · ', m.category::text,
    CASE m.priority::text WHEN 'EMERGENCY' THEN 'URGENCE' WHEN 'HIGH' THEN 'Prioritaire' ELSE NULL END,
    m.city, CASE WHEN NEW.distance_km IS NOT NULL THEN round(NEW.distance_km, 1)::text || ' km' END);
  IF v_user IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.notifications WHERE user_id = v_user AND mission_id = NEW.mission_id AND event = 'NEW_MISSION_AVAILABLE') THEN
    INSERT INTO public.notifications (user_id, mission_id, event, title, body)
    VALUES (v_user, NEW.mission_id, 'NEW_MISSION_AVAILABLE', 'NOUVELLE MISSION DISPONIBLE', v_body);
  END IF;
  IF v_company IS NOT NULL THEN
    SELECT owner_id INTO v_owner FROM public.companies WHERE id = v_company;
    IF v_owner IS NOT NULL AND v_owner IS DISTINCT FROM v_user AND NOT EXISTS (SELECT 1 FROM public.notifications WHERE user_id = v_owner AND mission_id = NEW.mission_id AND event = 'NEW_MISSION_AVAILABLE') THEN
      INSERT INTO public.notifications (user_id, mission_id, event, title, body)
      VALUES (v_owner, NEW.mission_id, 'NEW_MISSION_AVAILABLE', 'Nouvelle mission pour votre entreprise', v_body);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_offer_notify AFTER INSERT ON public.mission_offers
FOR EACH ROW EXECUTE FUNCTION public.notify_new_offer();

-- Mission created => admins
CREATE OR REPLACE FUNCTION public.notify_mission_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.is_demo, false) THEN RETURN NEW; END IF;
  PERFORM public.notify_admins(NEW.id, 'ADMIN_MISSION_CREATED', 'Nouvelle mission créée', concat_ws(' · ', NEW.category::text, NEW.city));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mission_created_notify AFTER INSERT ON public.missions
FOR EACH ROW EXECUTE FUNCTION public.notify_mission_created();

-- Status / content changes
CREATE OR REPLACE FUNCTION public.notify_mission_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_op_user uuid; v_owner uuid; v_label text;
BEGIN
  IF COALESCE(NEW.is_demo, false) THEN RETURN NEW; END IF;
  SELECT user_id INTO v_op_user FROM public.operators WHERE id = NEW.operator_id;
  SELECT owner_id INTO v_owner FROM public.companies WHERE id = NEW.company_id;
  v_label := concat_ws(' · ', NEW.category::text, NEW.city);

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'ACCEPTED' THEN
      IF v_op_user IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, mission_id, event, title, body)
        VALUES (v_op_user, NEW.id, 'MISSION_CONFIRMED', 'Mission confirmée', v_label);
      END IF;
      PERFORM public.notify_admins(NEW.id, 'ADMIN_MISSION_ACCEPTED', 'Mission acceptée', v_label);
    ELSIF NEW.status = 'CANCELLED' THEN
      INSERT INTO public.notifications (user_id, mission_id, event, title, body)
      VALUES (NEW.client_id, NEW.id, 'MISSION_CANCELLED', 'Intervention annulée', v_label);
      IF v_op_user IS NOT NULL AND v_op_user <> NEW.client_id THEN
        INSERT INTO public.notifications (user_id, mission_id, event, title, body)
        VALUES (v_op_user, NEW.id, 'MISSION_CANCELLED', 'Intervention annulée', v_label);
      END IF;
      IF v_owner IS NOT NULL AND v_owner IS DISTINCT FROM v_op_user THEN
        INSERT INTO public.notifications (user_id, mission_id, event, title, body)
        VALUES (v_owner, NEW.id, 'MISSION_CANCELLED', 'Mission annulée', v_label);
      END IF;
      PERFORM public.notify_admins(NEW.id, 'ADMIN_MISSION_CANCELLED', 'Mission annulée', v_label);
    ELSIF NEW.status = 'COMPLETED' THEN
      IF v_owner IS NOT NULL AND v_owner IS DISTINCT FROM v_op_user THEN
        INSERT INTO public.notifications (user_id, mission_id, event, title, body)
        VALUES (v_owner, NEW.id, 'MISSION_COMPLETED', 'Intervention terminée', v_label);
      END IF;
      PERFORM public.notify_admins(NEW.id, 'ADMIN_MISSION_COMPLETED', 'Intervention terminée', v_label);
    ELSIF NEW.status = 'DISPUTED' THEN
      IF v_owner IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, mission_id, event, title, body)
        VALUES (v_owner, NEW.id, 'MISSION_INCIDENT', 'Incident signalé', v_label);
      END IF;
      PERFORM public.notify_admins(NEW.id, 'ADMIN_MISSION_INCIDENT', 'Incident sur une mission', v_label);
    ELSIF NEW.status = 'SEARCHING' AND OLD.status = 'PROPOSED' THEN
      PERFORM public.notify_admins(NEW.id, 'ADMIN_MISSION_DECLINED', 'Mission refusée, nouvelle recherche', v_label);
    END IF;
  ELSIF NEW.status IN ('ACCEPTED','EN_ROUTE','ARRIVED','IN_PROGRESS')
    AND (NEW.address IS DISTINCT FROM OLD.address OR NEW.latitude IS DISTINCT FROM OLD.latitude
         OR NEW.longitude IS DISTINCT FROM OLD.longitude OR NEW.category IS DISTINCT FROM OLD.category) THEN
    IF v_op_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, mission_id, event, title, body)
      VALUES (v_op_user, NEW.id, 'MISSION_UPDATED', 'Mission modifiée', 'Le lieu ou le type d''intervention a changé.');
    END IF;
    INSERT INTO public.notifications (user_id, mission_id, event, title, body)
    VALUES (NEW.client_id, NEW.id, 'MISSION_UPDATED', 'Intervention modifiée', 'Les détails de votre intervention ont changé.');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mission_changes_notify AFTER UPDATE ON public.missions
FOR EACH ROW EXECUTE FUNCTION public.notify_mission_changes();

-- Operator approaching (< 1 km, once per mission)
CREATE OR REPLACE FUNCTION public.notify_operator_approaching()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record; d double precision;
BEGIN
  SELECT id, client_id, status, latitude, longitude INTO m FROM public.missions WHERE id = NEW.mission_id;
  IF m.status <> 'EN_ROUTE' OR m.latitude IS NULL OR m.longitude IS NULL THEN RETURN NEW; END IF;
  d := 6371 * 2 * asin(sqrt(power(sin(radians(NEW.latitude - m.latitude)/2),2)
       + cos(radians(m.latitude)) * cos(radians(NEW.latitude)) * power(sin(radians(NEW.longitude - m.longitude)/2),2)));
  IF d <= 1 AND NOT EXISTS (SELECT 1 FROM public.notifications WHERE mission_id = m.id AND event = 'OPERATOR_APPROACHING') THEN
    INSERT INTO public.notifications (user_id, mission_id, event, title, body)
    VALUES (m.client_id, m.id, 'OPERATOR_APPROACHING', 'Votre dépanneur approche', 'Il est à moins d''un kilomètre.');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_live_location_approach AFTER INSERT OR UPDATE ON public.mission_live_locations
FOR EACH ROW EXECUTE FUNCTION public.notify_operator_approaching();

-- Documents to review => admins
CREATE OR REPLACE FUNCTION public.notify_document_uploaded()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.is_demo, false) THEN RETURN NEW; END IF;
  PERFORM public.notify_admins(NULL, 'ADMIN_DOCUMENT_PENDING', 'Justificatif à valider', NEW.name);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_document_notify AFTER INSERT ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.notify_document_uploaded();

REVOKE ALL ON FUNCTION public.notifications_dispatch_push() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_new_offer() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_mission_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_mission_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_operator_approaching() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_document_uploaded() FROM PUBLIC, anon, authenticated;