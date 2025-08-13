-- Create table for JustGrants crawl configurations
CREATE TABLE IF NOT EXISTS public.justgrants_crawl_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  crawl_url TEXT NOT NULL,
  crawl_frequency TEXT NOT NULL DEFAULT 'daily', -- daily, weekly, monthly
  is_active BOOLEAN NOT NULL DEFAULT true,
  keywords TEXT[], -- search keywords for filtering
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_crawl_at TIMESTAMP WITH TIME ZONE
);

-- Create table for storing crawled JustGrants opportunities
CREATE TABLE IF NOT EXISTS public.justgrants_crawled_opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES public.justgrants_crawl_configs(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  agency TEXT,
  deadline DATE,
  funding_amount_max NUMERIC(15,2),
  summary TEXT,
  full_content TEXT,
  source_url TEXT,
  crawled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id, config_id)
);

-- Create table for crawl execution logs
CREATE TABLE IF NOT EXISTS public.justgrants_crawl_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES public.justgrants_crawl_configs(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- success, error, partial
  opportunities_found INTEGER NOT NULL DEFAULT 0,
  new_opportunities INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  execution_time_ms INTEGER,
  crawled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.justgrants_crawl_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.justgrants_crawled_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.justgrants_crawl_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for crawl configs
CREATE POLICY "Users can view their own crawl configs" 
ON public.justgrants_crawl_configs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own crawl configs" 
ON public.justgrants_crawl_configs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own crawl configs" 
ON public.justgrants_crawl_configs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own crawl configs" 
ON public.justgrants_crawl_configs 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for crawled opportunities (join through config)
CREATE POLICY "Users can view opportunities from their configs" 
ON public.justgrants_crawled_opportunities 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.justgrants_crawl_configs 
  WHERE id = config_id AND user_id = auth.uid()
));

CREATE POLICY "System can insert crawled opportunities" 
ON public.justgrants_crawled_opportunities 
FOR INSERT 
WITH CHECK (true); -- Allow system to insert

CREATE POLICY "Users can update opportunities from their configs" 
ON public.justgrants_crawled_opportunities 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.justgrants_crawl_configs 
  WHERE id = config_id AND user_id = auth.uid()
));

-- Create RLS policies for crawl logs
CREATE POLICY "Users can view logs from their configs" 
ON public.justgrants_crawl_logs 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.justgrants_crawl_configs 
  WHERE id = config_id AND user_id = auth.uid()
));

CREATE POLICY "System can insert crawl logs" 
ON public.justgrants_crawl_logs 
FOR INSERT 
WITH CHECK (true); -- Allow system to insert

-- Create indexes for better performance
CREATE INDEX idx_justgrants_crawl_configs_user_id ON public.justgrants_crawl_configs(user_id);
CREATE INDEX idx_justgrants_crawl_configs_active ON public.justgrants_crawl_configs(is_active);
CREATE INDEX idx_justgrants_crawled_opportunities_config_id ON public.justgrants_crawled_opportunities(config_id);
CREATE INDEX idx_justgrants_crawled_opportunities_opportunity_id ON public.justgrants_crawled_opportunities(opportunity_id);
CREATE INDEX idx_justgrants_crawled_opportunities_deadline ON public.justgrants_crawled_opportunities(deadline);
CREATE INDEX idx_justgrants_crawl_logs_config_id ON public.justgrants_crawl_logs(config_id);
CREATE INDEX idx_justgrants_crawl_logs_crawled_at ON public.justgrants_crawl_logs(crawled_at);

-- Create trigger for updating updated_at timestamps
CREATE TRIGGER update_justgrants_crawl_configs_updated_at
BEFORE UPDATE ON public.justgrants_crawl_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();