-- 2. vehicles : champs manquants
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS color TEXT;

-- 3. companies : champs manquants
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 4. operators (tow_operator_profiles) : champs manquants
ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS professional_name TEXT;

-- verification_status : ajout de SUSPENDED
ALTER TYPE public.verification_status ADD VALUE IF NOT EXISTS 'SUSPENDED';