import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export const useOnboarding = () => {
  const { user } = useAuth();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    checkOnboardingStatus();
  }, [user]);

  const checkOnboardingStatus = async () => {
    if (!user) return;

    try {
      // Check if organization settings exist (handle RLS gracefully)
      const { data: orgSettings, error: orgError } = await supabase
        .from('organization_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      // Check if user has any grants
      const { data: grants, error: grantsError } = await supabase
        .from('grants')
        .select('id')
        .limit(1);

      // If we can't access organization_settings due to RLS, skip that check
      const hasOrgSettings = orgError?.code === 'PGRST116' ? true : !!orgSettings;
      const hasGrants = grantsError ? false : grants && grants.length > 0;

      // Show onboarding if no grants (organization settings are optional if RLS blocks access)
      const shouldShowOnboarding = !hasGrants;
      
      setNeedsOnboarding(shouldShowOnboarding);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      // If there's a general error, only show onboarding for new users with no grants
      try {
        const { data: grants } = await supabase
          .from('grants')
          .select('id')
          .limit(1);
        setNeedsOnboarding(!grants || grants.length === 0);
      } catch {
        // If we can't even check grants, don't force onboarding
        setNeedsOnboarding(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = () => {
    setNeedsOnboarding(false);
  };

  const skipOnboarding = () => {
    setNeedsOnboarding(false);
  };

  return {
    needsOnboarding,
    loading,
    completeOnboarding,
    skipOnboarding,
    recheckOnboarding: checkOnboardingStatus
  };
};