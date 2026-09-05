-- Enable Row Level Security on intelligence_logs
ALTER TABLE public.intelligence_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated to insert logs" ON public.intelligence_logs;
DROP POLICY IF EXISTS "Allow authenticated to select logs" ON public.intelligence_logs;
DROP POLICY IF EXISTS "Allow authenticated to delete logs" ON public.intelligence_logs;

-- Policy to allow authenticated users to insert logs (from telemetry / trackEvent)
CREATE POLICY "Allow authenticated to insert logs"
  ON public.intelligence_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy to allow authenticated users to view logs (for IntelligenceCenter)
CREATE POLICY "Allow authenticated to select logs"
  ON public.intelligence_logs FOR SELECT
  TO authenticated
  USING (true);

-- Policy to allow authenticated users to clear logs
CREATE POLICY "Allow authenticated to delete logs"
  ON public.intelligence_logs FOR DELETE
  TO authenticated
  USING (true);
