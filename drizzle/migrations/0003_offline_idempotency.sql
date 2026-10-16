ALTER TABLE public.sales_logs
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS sales_logs_shop_client_request_unique
  ON public.sales_logs (shop_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

ALTER TABLE public.scrap_receipts
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS scrap_receipts_shop_client_request_unique
  ON public.scrap_receipts (shop_id, client_request_id)
  WHERE client_request_id IS NOT NULL;
