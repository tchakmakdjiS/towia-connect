-- 1. Validation des transitions de statut
CREATE OR REPLACE FUNCTION public.enforce_mission_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed public.mission_status[];
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  allowed := CASE OLD.status
    WHEN 'CREATED'     THEN ARRAY['AI_ANALYSIS','SEARCHING','CANCELLED']
    WHEN 'AI_ANALYSIS' THEN ARRAY['SEARCHING','CANCELLED']
    WHEN 'SEARCHING'   THEN ARRAY['PROPOSED','ACCEPTED','CANCELLED']
    WHEN 'PROPOSED'    THEN ARRAY['ACCEPTED','SEARCHING','CANCELLED']
    WHEN 'ACCEPTED'    THEN ARRAY['EN_ROUTE','CANCELLED']
    WHEN 'EN_ROUTE'    THEN ARRAY['ARRIVED','CANCELLED']
    WHEN 'ARRIVED'     THEN ARRAY['IN_PROGRESS','CANCELLED']
    WHEN 'IN_PROGRESS' THEN ARRAY['COMPLETED','DISPUTED','CANCELLED']
    WHEN 'COMPLETED'   THEN ARRAY['DISPUTED']
    WHEN 'DISPUTED'    THEN ARRAY['COMPLETED','CANCELLED']
    ELSE ARRAY[]::text[]
  END::public.mission_status[];

  IF NOT (NEW.status = ANY(allowed)) THEN
    RAISE EXCEPTION 'Transition de statut invalide : % vers %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.enforce_mission_status_transition() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_mission_status_transition ON public.missions;
CREATE TRIGGER trg_mission_status_transition
BEFORE UPDATE ON public.missions
FOR EACH ROW EXECUTE FUNCTION public.enforce_mission_status_transition();

-- 2. Journalisation automatique de chaque changement de statut
CREATE OR REPLACE FUNCTION public.log_mission_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lbl text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  lbl := CASE NEW.status
    WHEN 'CREATED'     THEN 'Demande créée'
    WHEN 'AI_ANALYSIS' THEN 'Analyse IA en cours'
    WHEN 'SEARCHING'   THEN 'Recherche d''un dépanneur'
    WHEN 'PROPOSED'    THEN 'Mission proposée à un dépanneur'
    WHEN 'ACCEPTED'    THEN 'Mission acceptée par le dépanneur'
    WHEN 'EN_ROUTE'    THEN 'Dépanneur en route'
    WHEN 'ARRIVED'     THEN 'Dépanneur arrivé sur place'
    WHEN 'IN_PROGRESS' THEN 'Intervention en cours'
    WHEN 'COMPLETED'   THEN 'Intervention terminée'
    WHEN 'CANCELLED'   THEN 'Mission annulée'
    WHEN 'DISPUTED'    THEN 'Litige ouvert'
    ELSE NEW.status::text
  END;

  INSERT INTO public.mission_events (mission_id, status, previous_status, label, actor_id)
  VALUES (NEW.id, NEW.status, OLD.status, lbl, auth.uid());

  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.log_mission_status_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_mission_status_change ON public.missions;
CREATE TRIGGER trg_log_mission_status_change
AFTER UPDATE ON public.missions
FOR EACH ROW EXECUTE FUNCTION public.log_mission_status_change();

-- 3. Temps réel
ALTER TABLE public.missions REPLICA IDENTITY FULL;
ALTER TABLE public.mission_events REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.missions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;