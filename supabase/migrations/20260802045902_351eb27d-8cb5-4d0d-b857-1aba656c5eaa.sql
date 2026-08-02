CREATE POLICY payments_owner_update_pending ON public.payments
  FOR UPDATE TO authenticated
  USING (is_family_owner(family_id) AND status = 'pending'::payment_status)
  WITH CHECK (is_family_owner(family_id) AND status = 'pending'::payment_status AND created_by = auth.uid());

CREATE POLICY payments_owner_delete_pending ON public.payments
  FOR DELETE TO authenticated
  USING (is_family_owner(family_id) AND status = 'pending'::payment_status);