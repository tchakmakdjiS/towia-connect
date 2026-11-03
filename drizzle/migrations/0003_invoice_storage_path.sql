ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS storage_path text;
COMMENT ON COLUMN public.invoices.storage_path IS 'Path of the PDF inside the private "invoices" bucket; signed URLs are generated on demand.';
COMMENT ON COLUMN public.invoices.pdf_url IS 'DEPRECATED: never populated; use storage_path + on-demand signed URL.';