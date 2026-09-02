CREATE POLICY "operator_docs_own_all" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'operator-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'operator-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "operator_docs_admin_read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'operator-documents' AND public.has_role(auth.uid(), 'admin'));