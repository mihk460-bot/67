CREATE TABLE public.scrap_receipts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id bigint NOT NULL,
  employee_id bigint NOT NULL,
  employee_name text NOT NULL DEFAULT '',
  serial text NOT NULL,
  customer_name text,
  metal text NOT NULL CHECK (metal IN ('gold', 'silver')),
  receipt jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scrap_receipts_shop_serial_unique UNIQUE (shop_id, serial)
);
CREATE INDEX scrap_receipts_shop_created_idx ON public.scrap_receipts (shop_id, created_at DESC);
GRANT USAGE, SELECT ON SEQUENCE public.scrap_receipts_id_seq TO service_role;
GRANT ALL ON public.scrap_receipts TO service_role;
ALTER TABLE public.scrap_receipts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.scrap_receipt_sequences (
  shop_id bigint NOT NULL,
  receipt_day date NOT NULL,
  next_number integer NOT NULL CHECK (next_number >= 2),
  PRIMARY KEY (shop_id, receipt_day)
);
GRANT ALL ON public.scrap_receipt_sequences TO service_role;
ALTER TABLE public.scrap_receipt_sequences ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.next_scrap_receipt_number(p_shop_id bigint, p_receipt_day date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  issued_number integer;
BEGIN
  IF p_shop_id <= 0 OR p_receipt_day IS NULL THEN
    RAISE EXCEPTION 'Invalid scrap receipt sequence key';
  END IF;

  INSERT INTO public.scrap_receipt_sequences (shop_id, receipt_day, next_number)
  VALUES (p_shop_id, p_receipt_day, 2)
  ON CONFLICT (shop_id, receipt_day)
  DO UPDATE SET next_number = public.scrap_receipt_sequences.next_number + 1
  RETURNING next_number - 1 INTO issued_number;

  RETURN issued_number;
END;
$$;
REVOKE ALL ON FUNCTION public.next_scrap_receipt_number(bigint, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_scrap_receipt_number(bigint, date) TO service_role;
