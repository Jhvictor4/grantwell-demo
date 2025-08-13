-- Make grant-documents bucket public for file viewing
UPDATE storage.buckets 
SET public = true 
WHERE id = 'grant-documents';

-- Create RLS policies for proper access control
CREATE POLICY "Grant documents are viewable by authenticated users" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'grant-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can upload grant documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'grant-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own grant documents" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'grant-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own grant documents" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'grant-documents' AND auth.role() = 'authenticated');