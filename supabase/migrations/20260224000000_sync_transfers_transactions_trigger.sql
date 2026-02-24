-- ============================================================================
-- Trigger: Auto-sync between transfers and transactions tables
-- Similar to Django's post_save signal
-- When a transfer is updated (e.g. status change by admin), the matching
-- transaction record is automatically updated, and vice versa.
-- Trigger functions run as the table owner (bypasses RLS).
-- ============================================================================

-- ============================================================================
-- 1. When transfers table is updated → sync to transactions table
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_transfer_to_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire if not already inside a trigger (prevent infinite loop)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Find the matching transaction record:
  -- Same user (via accounts), same recipient, same original amount
  UPDATE public.transactions t
  SET
    status = NEW.status,
    amount = NEW.amount,
    recipient = NEW.recipient_name,
    created_at = NEW.created_at
  FROM public.accounts a
  WHERE t.account_id = a.id
    AND a.user_id = NEW.user_id
    AND t.recipient = OLD.recipient_name
    AND t.amount = OLD.amount
    AND t.transaction_type = 'transfer';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS trigger_sync_transfer_to_transaction ON public.transfers;
CREATE TRIGGER trigger_sync_transfer_to_transaction
  AFTER UPDATE ON public.transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_transfer_to_transaction();


-- ============================================================================
-- 2. When transactions table is updated → sync to transfers table
--    (This handles cases where someone adds an UPDATE policy later)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_transaction_to_transfer()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire if not already inside a trigger (prevent infinite loop)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Only sync transfer-type transactions
  IF NEW.transaction_type != 'transfer' THEN
    RETURN NEW;
  END IF;

  -- Find the matching transfer record:
  -- Same user (via accounts), same recipient, same original amount
  UPDATE public.transfers tr
  SET
    status = NEW.status,
    amount = NEW.amount,
    recipient_name = NEW.recipient,
    created_at = NEW.created_at
  FROM public.accounts a
  WHERE a.id = NEW.account_id
    AND tr.user_id = a.user_id
    AND tr.recipient_name = OLD.recipient
    AND tr.amount = OLD.amount;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS trigger_sync_transaction_to_transfer ON public.transactions;
CREATE TRIGGER trigger_sync_transaction_to_transfer
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_transaction_to_transfer();


-- ============================================================================
-- 3. When a new transaction is INSERTED (e.g. admin delete+insert workaround)
--    and it's a transfer type → sync status to matching transfers record
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_new_transaction_to_transfer()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire if not already inside a trigger (prevent infinite loop)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Only sync transfer-type transactions
  IF NEW.transaction_type != 'transfer' THEN
    RETURN NEW;
  END IF;

  -- Find the matching transfer record and sync
  UPDATE public.transfers tr
  SET
    status = NEW.status,
    amount = NEW.amount,
    recipient_name = NEW.recipient,
    created_at = NEW.created_at
  FROM public.accounts a
  WHERE a.id = NEW.account_id
    AND tr.user_id = a.user_id
    AND tr.recipient_name = NEW.recipient;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS trigger_sync_new_transaction_to_transfer ON public.transactions;
CREATE TRIGGER trigger_sync_new_transaction_to_transfer
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_new_transaction_to_transfer();
