INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE email IN ('tchako13@hotmail.fr','tchako21000@gmail.com','test.admin@towia.test')
ON CONFLICT (user_id, role) DO NOTHING;