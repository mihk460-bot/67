-- ============================================
-- جداول تتبع المبيعات وسجلات النشاط
-- ============================================

-- 1. جدول المبيعات
CREATE TABLE IF NOT EXISTS public.sales (
  id BIGSERIAL PRIMARY KEY,
  merchant_id BIGINT NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  employee_id BIGINT REFERENCES public.merchants(id) ON DELETE SET NULL,
  metal_type TEXT NOT NULL CHECK (metal_type IN ('gold', 'silver')),
  karat TEXT NOT NULL,
  quantity NUMERIC(10, 3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0),
  sale_type TEXT NOT NULL CHECK (sale_type IN ('sell', 'buy')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Index للبحث السريع
  CONSTRAINT valid_prices CHECK (
    (quantity * unit_price)::numeric(12, 2) = total_price OR 
    abs((quantity * unit_price)::numeric(12, 2) - total_price) < 0.01
  )
);

-- إنشاء indexes للبحث السريع
CREATE INDEX IF NOT EXISTS idx_sales_merchant_id ON public.sales(merchant_id);
CREATE INDEX IF NOT EXISTS idx_sales_employee_id ON public.sales(employee_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_merchant_created ON public.sales(merchant_id, created_at DESC);

-- 2. جدول سجل النشاط (Audit Log)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id BIGINT REFERENCES public.merchants(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('merchant', 'employee', 'admin', 'price_manager')),
  actor_username TEXT,
  merchant_id BIGINT REFERENCES public.merchants(id) ON DELETE SET NULL,
  employee_id BIGINT REFERENCES public.merchants(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  action_category TEXT NOT NULL CHECK (
    action_category IN ('authentication', 'merchant_management', 'employee_management', 'sales', 'pricing', 'settings', 'system')
  ),
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failure')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- إنشاء indexes للبحث السريع
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_merchant_id ON public.audit_logs(merchant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON public.audit_logs(action_category);

-- 3. جدول إحصائيات الموظفين (Cache للأداء)
CREATE TABLE IF NOT EXISTS public.employee_stats (
  id BIGSERIAL PRIMARY KEY,
  merchant_id BIGINT NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  total_sales BIGINT DEFAULT 0,
  total_quantity NUMERIC(12, 3) DEFAULT 0,
  total_amount NUMERIC(15, 2) DEFAULT 0,
  last_login TIMESTAMPTZ,
  last_sale_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(merchant_id, employee_id)
);

-- إنشاء indexes
CREATE INDEX IF NOT EXISTS idx_employee_stats_merchant ON public.employee_stats(merchant_id);
CREATE INDEX IF NOT EXISTS idx_employee_stats_employee ON public.employee_stats(employee_id);

-- ============================================
-- RLS (Row Level Security) Policies
-- ============================================

-- تفعيل RLS على جميع الجداول
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_stats ENABLE ROW LEVEL SECURITY;

-- سياسات جدول sales
-- Admin يرى كل المبيعات
CREATE POLICY "admin_can_view_all_sales" ON public.sales
  FOR SELECT
  USING (auth.uid()::text = 'admin');

-- التاجر يرى مبيعاته ومبيعات موظفيه
CREATE POLICY "merchant_can_view_own_sales" ON public.sales
  FOR SELECT
  USING (
    merchant_id = (
      SELECT id FROM public.merchants 
      WHERE username = auth.uid()::text
      LIMIT 1
    )
  );

-- الموظف يرى مبيعاته فقط
CREATE POLICY "employee_can_view_own_sales" ON public.sales
  FOR SELECT
  USING (
    employee_id = (
      SELECT id FROM public.merchants 
      WHERE username = auth.uid()::text
      LIMIT 1
    )
  );

-- يمكن إدراج مبيعة جديدة
CREATE POLICY "users_can_insert_sales" ON public.sales
  FOR INSERT
  WITH CHECK (true);

-- سياسات جدول audit_logs
-- Admin يرى كل السجلات
CREATE POLICY "admin_can_view_audit_logs" ON public.audit_logs
  FOR SELECT
  USING (true);

-- التاجر يرى سجلات متجره
CREATE POLICY "merchant_can_view_audit_logs" ON public.audit_logs
  FOR SELECT
  USING (
    merchant_id = (
      SELECT id FROM public.merchants 
      WHERE username = auth.uid()::text
      LIMIT 1
    )
  );

-- إدراج سجل نشاط جديد
CREATE POLICY "users_can_insert_audit_logs" ON public.audit_logs
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- Comments توضيحية
-- ============================================

COMMENT ON TABLE public.sales IS 'جدول تسجيل المبيعات - يحتوي على كل عملية بيع أو شراء';
COMMENT ON COLUMN public.sales.merchant_id IS 'معرف التاجر الذي تنتمي له المبيعة';
COMMENT ON COLUMN public.sales.employee_id IS 'معرف الموظف الذي سجل المبيعة (اختياري)';
COMMENT ON COLUMN public.sales.metal_type IS 'نوع المعدن: ذهب (gold) أو فضة (silver)';
COMMENT ON COLUMN public.sales.karat IS 'العيار: 24، 22، 21، 18 للذهب أو 999، 925، 900، 800 للفضة';
COMMENT ON COLUMN public.sales.quantity IS 'الكمية بالجرام';
COMMENT ON COLUMN public.sales.unit_price IS 'سعر الجرام الواحد';
COMMENT ON COLUMN public.sales.total_price IS 'الإجمالي = الكمية × السعر';
COMMENT ON COLUMN public.sales.sale_type IS 'نوع الصفقة: بيع (sell) أو شراء (buy)';

COMMENT ON TABLE public.audit_logs IS 'جدول سجل النشاط - يحتوي على كل الأحداث المهمة في النظام';
COMMENT ON COLUMN public.audit_logs.actor_id IS 'معرف المستخدم الذي قام بالعملية';
COMMENT ON COLUMN public.audit_logs.actor_role IS 'دور المستخدم: تاجر أو موظف أو إدارة';
COMMENT ON COLUMN public.audit_logs.action IS 'نوع العملية: مثل login, logout, sale_recorded, price_updated';
COMMENT ON COLUMN public.audit_logs.action_category IS 'تصنيف العملية لتسهيل البحث والفلترة';
COMMENT ON COLUMN public.audit_logs.details IS 'تفاصيل إضافية عن العملية (JSON)';
COMMENT ON COLUMN public.audit_logs.status IS 'حالة العملية: نجح أم فشل';

COMMENT ON TABLE public.employee_stats IS 'جدول إحصائيات الموظفين - يحتوي على ملخص أداء كل موظف';
