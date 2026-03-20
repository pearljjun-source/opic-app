import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';
import { redeemInviteCode } from '@/services/invites';
import { deliverNotification } from '@/services/notifications';

const PENDING_INVITE_KEY = 'pending_invite_code';
const MAX_AGE_MS = 60 * 60 * 1000; // 1시간

/**
 * usePendingInvite — auth flow 완료 후 대기 중인 초대 코드 자동 사용
 *
 * /join/[code] 에서 미인증 사용자가 코드를 AsyncStorage에 저장한 후,
 * 회원가입/로그인이 완료되면 이 훅이 자동으로 코드를 사용합니다.
 *
 * app/(student)/_layout.tsx에 마운트.
 */
export function usePendingInvite() {
  const { isAuthenticated, _profileVerified, refreshUser } = useAuth();
  const processedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !_profileVerified || processedRef.current) return;

    const processPendingCode = async () => {
      try {
        const raw = await AsyncStorage.getItem(PENDING_INVITE_KEY);
        if (!raw) return;

        const { code, timestamp } = JSON.parse(raw) as { code: string; timestamp: number };

        // 만료 체크 (1시간)
        if (Date.now() - timestamp > MAX_AGE_MS) {
          await AsyncStorage.removeItem(PENDING_INVITE_KEY);
          return;
        }

        processedRef.current = true;
        await AsyncStorage.removeItem(PENDING_INVITE_KEY);

        const result = await redeemInviteCode(code);

        if (result.success) {
          // 알림 배달 (fire-and-forget)
          if (result.notification_log_id) {
            deliverNotification(result.notification_log_id);
          }
          // 프로필 갱신 → useAuth 라우팅이 올바른 화면으로 이동
          await refreshUser();
          if (result.role === 'owner' || result.role === 'teacher') {
            router.replace('/(teacher)' as any);
          }
          // student는 이미 student 그룹에 있으므로 별도 이동 불필요
        }
        // 실패 시 조용히 무시 (사용자는 수동으로 코드 입력 가능)
      } catch {
        // 무시 — 사용자 경험에 영향 없음
      }
    };

    processPendingCode();
  }, [isAuthenticated, _profileVerified, refreshUser]);
}
