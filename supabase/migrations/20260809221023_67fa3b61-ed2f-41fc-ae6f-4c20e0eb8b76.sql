REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owns_company(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_operator_id(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_company(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_operator_id(uuid) TO authenticated, service_role;