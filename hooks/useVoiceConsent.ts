import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type ConsentStatus = 'loading' | 'agreed' | 'not_agreed';

/**
 * 음성 녹음 동의 상태를 관리하는 훅
 * - user_consents.voice_data_agreed 확인
 * - 동의 시 DB 업데이트
 * - 녹음 시작 전 동의 여부를 체크하는 guard 함수 제공
 */
export function useVoiceConsent() {
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>('loading');
  const [showConsentModal, setShowConsentModal] = useState(false);

  // 초기 동의 상태 확인
  useEffect(() => {
    let cancelled = false;

    const checkConsent = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) {
          if (!cancelled) setConsentStatus('not_agreed');
          return;
        }

        const { data, error } = await supabase
          .from('user_consents')
          .select('voice_data_agreed')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .single();

        if (cancelled) return;

        if (error) {
          // 쿼리 실패 시 보수적으로 not_agreed (모달 표시)
          if (__DEV__) console.warn('[AppError] Failed to check voice consent:', error);
          setConsentStatus('not_agreed');
          return;
        }

        setConsentStatus(data?.voice_data_agreed ? 'agreed' : 'not_agreed');
      } catch {
        if (!cancelled) setConsentStatus('not_agreed');
      }
    };

    checkConsent();

    return () => { cancelled = true; };
  }, []);

  // 동의 처리
  const handleAgree = useCallback(async (): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const now = new Date().toISOString();

    // UPSERT: 레코드가 없을 수도 있으므로
    const { error } = await supabase
      .from('user_consents')
      .upsert({
        user_id: user.id,
        voice_data_agreed: true,
        voice_data_agreed_at: now,
      }, { onConflict: 'user_id' });

    if (error) {
      if (__DEV__) console.warn('[AppError] Failed to save voice consent:', error);
      return false;
    }

    setConsentStatus('agreed');
    setShowConsentModal(false);
    return true;
  }, []);

  // 거부 처리
  const handleDecline = useCallback(() => {
    setShowConsentModal(false);
  }, []);

  /**
   * 녹음 시작 전 호출하는 가드 함수
   * @returns true면 녹음 진행 가능, false면 녹음 차단
   */
  const requireConsent = useCallback((): boolean => {
    if (consentStatus === 'agreed') return true;
    // 로딩 중이면 모달 표시 없이 차단 (DB 조회 완료 후 재시도)
    if (consentStatus === 'loading') return false;
    setShowConsentModal(true);
    return false;
  }, [consentStatus]);

  return {
    consentStatus,
    showConsentModal,
    requireConsent,
    handleAgree,
    handleDecline,
  };
}
