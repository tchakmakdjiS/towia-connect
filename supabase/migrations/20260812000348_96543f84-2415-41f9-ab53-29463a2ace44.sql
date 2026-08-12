CREATE POLICY "Users manage own mission photos objects"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'mission-photos' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')))
WITH CHECK (bucket_id = 'mission-photos' AND auth.uid()::text = (storage.foldername(name))[1]);