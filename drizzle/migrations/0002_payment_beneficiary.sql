ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS beneficiary_type text NOT NULL DEFAULT 'OPERATOR'
  CHECK (beneficiary_type IN ('OPERATOR','COMPANY'));

UPDATE public.payments p SET company_id = m.company_id
  FROM public.missions m WHERE m.id = p.mission_id AND p.company_id IS NULL AND m.company_id IS NOT NULL;
UPDATE public.payments SET beneficiary_type = 'COMPANY' WHERE company_id IS NOT NULL;
UPDATE public.invoices i SET company_id = m.company_id
  FROM public.missions m WHERE m.id = i.mission_id AND i.company_id IS NULL AND m.company_id IS NOT NULL;

-- Server-side source of truth: beneficiary derived from the mission on every write
CREATE OR REPLACE FUNCTION public.set_payment_beneficiary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_company uuid; v_operator uuid;
BEGIN
  SELECT company_id, operator_id INTO v_company, v_operator FROM public.missions WHERE id = NEW.mission_id;
  NEW.company_id := v_company;
  NEW.operator_id := COALESCE(v_operator, NEW.operator_id);
  NEW.beneficiary_type := CASE WHEN v_company IS NOT NULL THEN 'COMPANY' ELSE 'OPERATOR' END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_set_payment_beneficiary ON public.payments;
CREATE TRIGGER trg_set_payment_beneficiary BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_payment_beneficiary();

CREATE OR REPLACE FUNCTION public.set_invoice_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  SELECT company_id INTO NEW.company_id FROM public.missions WHERE id = NEW.mission_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_set_invoice_company ON public.invoices;
CREATE TRIGGER trg_set_invoice_company BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_invoice_company();

-- Operators only see payments they are the financial beneficiary of; companies see theirs
DROP POLICY IF EXISTS payments_select ON public.payments;
CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated USING (
  client_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR (company_id IS NULL AND operator_id = public.my_operator_id(auth.uid()))
  OR (company_id IS NOT NULL AND public.owns_company(auth.uid(), company_id))
);
DROP POLICY IF EXISTS invoices_select ON public.invoices;
CREATE POLICY invoices_select ON public.invoices FOR SELECT TO authenticated USING (
  client_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR (company_id IS NULL AND operator_id = public.my_operator_id(auth.uid()))
  OR (company_id IS NOT NULL AND public.owns_company(auth.uid(), company_id))
);