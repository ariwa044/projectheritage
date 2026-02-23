-- Fix Admin RLS Policies for Real-Time Sync
-- Issue: Admin changes weren't being reflected to clients due to RLS filter restrictions
-- Solution: Ensure admins can read and modify user data directly (they use service_role key anyway)

-- For profiles table - ensure admins can SELECT all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- For accounts table - ensure admins can SELECT all accounts
DROP POLICY IF EXISTS "Admins can view all accounts" ON public.accounts;
CREATE POLICY "Admins can view all accounts"
  ON public.accounts
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- For transactions table - ensure admins can SELECT all transactions
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
CREATE POLICY "Admins can view all transactions"
  ON public.transactions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- For transfers table - ensure admins can SELECT all transfers
DROP POLICY IF EXISTS "Admins can view all transfers" ON public.transfers;
CREATE POLICY "Admins can view all transfers"
  ON public.transfers
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- For crypto_wallets table - ensure admins can SELECT all wallets
DROP POLICY IF EXISTS "Admins can view all crypto wallets" ON public.crypto_wallets;
CREATE POLICY "Admins can view all crypto wallets"
  ON public.crypto_wallets
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- For crypto_transactions table - ensure admins can SELECT all crypto transactions
DROP POLICY IF EXISTS "Admins can view all crypto transactions" ON public.crypto_transactions;
CREATE POLICY "Admins can view all crypto transactions"
  ON public.crypto_transactions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Ensure admins can UPDATE all profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Ensure admins can UPDATE all accounts
DROP POLICY IF EXISTS "Admins can update all accounts" ON public.accounts;
CREATE POLICY "Admins can update all accounts"
  ON public.accounts
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Ensure admins can DELETE transactions
DROP POLICY IF EXISTS "Admins can delete transactions" ON public.transactions;
CREATE POLICY "Admins can delete transactions"
  ON public.transactions
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Ensure admins can UPDATE transfers
DROP POLICY IF EXISTS "Admins can update transfers" ON public.transfers;
CREATE POLICY "Admins can update transfers"
  ON public.transfers
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Ensure admins can DELETE transfers
DROP POLICY IF EXISTS "Admins can delete transfers" ON public.transfers;
CREATE POLICY "Admins can delete transfers"
  ON public.transfers
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Create comment explaining the real-time sync fix
COMMENT ON TABLE public.profiles IS 'User profiles table - RLS policies allow users to see own profile, admins to see all profiles for real-time admin updates to work correctly';
