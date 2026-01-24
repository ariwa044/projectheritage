-- Add admin delete policy for transactions
CREATE POLICY "Admins can delete transactions"
ON public.transactions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));