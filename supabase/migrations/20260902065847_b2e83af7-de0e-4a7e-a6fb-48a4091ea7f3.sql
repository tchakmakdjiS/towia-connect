CREATE OR REPLACE FUNCTION public.guard_operator_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.verification IS DISTINCT FROM OLD.verification
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.verification := OLD.verification;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_operator_verification ON public.operators;
CREATE TRIGGER trg_guard_operator_verification
BEFORE UPDATE ON public.operators
FOR EACH ROW EXECUTE FUNCTION public.guard_operator_verification();

CREATE OR REPLACE FUNCTION public.guard_company_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.verification IS DISTINCT FROM OLD.verification
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.verification := OLD.verification;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_company_verification ON public.companies;
CREATE TRIGGER trg_guard_company_verification
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.guard_company_verification();

CREATE OR REPLACE FUNCTION public.guard_document_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'PENDING'::public.verification_status
       AND NOT public.has_role(auth.uid(), 'admin') THEN
      NEW.status := 'PENDING';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_document_status ON public.documents;
CREATE TRIGGER trg_guard_document_status
BEFORE INSERT OR UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.guard_document_status();

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS storage_path text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE POLICY "documents_admin_all" ON public.documents
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));