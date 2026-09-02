REVOKE EXECUTE ON FUNCTION public.guard_operator_verification() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.guard_company_verification() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.guard_document_status() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;