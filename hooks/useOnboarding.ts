import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

interface OnboardingSteps {
  academy_confirmed: boolean;
  has_teachers: boolean;
  has_classes: boolean;
}

interface OnboardingState {
  showOnboarding: boolean;
  isLoading: boolean;
  steps: OnboardingSteps;
  currentStep: number; // 1, 2, 3
}

export function useOnboarding() {
  const { currentOrg, orgRole } = useAuth();
  const [state, setState] = useState<OnboardingState>({
    showOnboarding: false,
    isLoading: true,
    steps: { academy_confirmed: true, has_teachers: false, has_classes: false },
    currentStep: 1,
  });

  const fetchStatus = useCallback(async () => {
    if (!currentOrg || orgRole !== 'owner') {
      setState((prev) => ({ ...prev, isLoading: false, showOnboarding: false }));
      return;
    }

    const { data } = await (supabase.rpc as CallableFunction)('get_onboarding_status', {
      p_org_id: currentOrg.id,
    });

    if (!data || data.error || data.completed) {
      setState((prev) => ({ ...prev, isLoading: false, showOnboarding: false }));
      return;
    }

    const steps: OnboardingSteps = data.steps;
    let currentStep = 1;
    if (steps.academy_confirmed) currentStep = 2;
    if (steps.has_teachers) currentStep = 3;

    setState({
      showOnboarding: true,
      isLoading: false,
      steps,
      currentStep,
    });
  }, [currentOrg, orgRole]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const completeOnboarding = useCallback(async () => {
    if (!currentOrg) return;

    await (supabase.rpc as CallableFunction)('complete_onboarding', {
      p_org_id: currentOrg.id,
    });

    setState((prev) => ({ ...prev, showOnboarding: false }));
  }, [currentOrg]);

  const skipOnboarding = completeOnboarding; // 건너뛰기 = 완료 처리

  const refreshSteps = fetchStatus;

  return {
    ...state,
    completeOnboarding,
    skipOnboarding,
    refreshSteps,
  };
}
