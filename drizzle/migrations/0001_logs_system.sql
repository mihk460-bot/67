ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE TABLE public.sales_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_number text GENERATED ALWAYS AS ('INV-' || lpad(id::text, 6, '0')) STORED,
  shop_id bigint NOT NULL,
  employee_id bigint NOT NULL,
  employee_name text NOT NULL DEFAULT '',
  metal text NOT NULL,
  karat text NOT NULL,
  side text NOT NULL DEFAULT 'sell',
  weight numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  invoice jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sales_logs_shop_idx ON public.sales_logs (shop_id, created_at DESC);
GRANT ALL ON public.sales_logs TO service_role;
ALTER TABLE public.sales_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.activity_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL,
  actor_id text NOT NULL DEFAULT '',
  actor_name text NOT NULL DEFAULT '',
  actor_role text NOT NULL DEFAULT '',
  shop_id bigint,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_logs_kind_idx ON public.activity_logs (kind, created_at DESC);
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;