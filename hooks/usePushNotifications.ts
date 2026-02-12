import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// ============================================================================
// 알림 핸들러 설정 (포그라운드 알림 표시)
// ============================================================================
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ============================================================================
// Push Token 등록
// ============================================================================

async function registerForPushNotifications(): Promise<string | null> {
  // 물리 디바이스에서만 동작
  if (!Device.isDevice) {
    if (__DEV__) {
      console.log('Push notifications require a physical device');
    }
    return null;
  }

  // Android 알림 채널 설정
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'OPIc 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3B82F6',
    });
  }

  // 권한 확인/요청
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  // Expo Push Token 가져오기
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      if (__DEV__) {
        console.warn('[Push] projectId가 설정되지 않았습니다. app.json > extra.eas.projectId를 확인하세요.');
      }
      return null;
    }
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (err) {
    if (__DEV__) {
      console.warn('[Push] Failed to get push token:', err);
    }
    return null;
  }
}

// ============================================================================
// Hook
// ============================================================================

export function usePushNotifications() {
  const { isAuthenticated, user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // 1. Push token 등록
    registerForPushNotifications().then(async (token) => {
      if (!token) return;

      setExpoPushToken(token);

      // DB에 push_token 저장 (변경된 경우만)
      if (token !== user.push_token) {
        await supabase
          .from('users')
          .update({ push_token: token })
          .eq('id', user.id);
      }
    });

    // 2. 포그라운드 알림 수신 리스너
    notificationListener.current = Notifications.addNotificationReceivedListener((_notification) => {
      // 포그라운드에서 알림 수신 시 추가 동작 (필요 시 확장)
    });

    // 3. 알림 탭 → 화면 이동
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      handleNotificationNavigation(data);
    });

    // 4. Cold start: 앱이 꺼진 상태에서 알림 탭으로 열었을 때
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data;
        handleNotificationNavigation(data);
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [isAuthenticated, user]);

  return { expoPushToken };
}

// ============================================================================
// 알림 탭 시 화면 이동
// ============================================================================

function handleNotificationNavigation(data: Record<string, unknown>) {
  if (!data) return;

  // practice_id → 연습 결과 화면으로
  if (data.practice_id && typeof data.practice_id === 'string') {
    router.push({
      pathname: '/(student)/script/practice/[practiceId]',
      params: { practiceId: data.practice_id },
    });
    return;
  }

  // script_id → 스크립트 목록 (학생 홈)으로
  if (data.script_id && typeof data.script_id === 'string') {
    router.push('/(student)');
    return;
  }

  // student_id → 강사 대시보드로
  if (data.student_id && typeof data.student_id === 'string') {
    router.push('/(teacher)');
    return;
  }
}
