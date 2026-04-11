import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { getUnreadCount } from '@/services/notifications';
import { showToast } from '@/lib/toast';
import { emit, on } from '@/lib/events';

/**
 * 웹 전용 실시간 알림 훅
 * - Supabase Realtime으로 notification_logs INSERT 감지
 * - 탭 포커스 복귀 시 미읽은 알림 수 재조회
 * - 'notification-changed' 이벤트 발행하여 뱃지 갱신
 */
export function useWebNotifications() {
  const { isAuthenticated, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refreshUnreadCount = useCallback(async () => {
    const count = await getUnreadCount();
    setUnreadCount(count);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!isAuthenticated || !user) return;

    // 초기 미읽은 알림 수 조회
    refreshUnreadCount();

    // Supabase Realtime 구독: notification_logs INSERT
    const channel = supabase
      .channel('web-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_logs',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const record = payload.new as { title?: string };
          if (record.title) {
            showToast(record.title, 'info');
          }
          setUnreadCount((prev) => prev + 1);
          emit('notification-changed');
        }
      )
      .subscribe();

    channelRef.current = channel;

    // 탭 포커스 복귀 시 미읽은 알림 수 재조회
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshUnreadCount().then(() => emit('notification-changed'));
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // notification-changed 이벤트 구독 (다른 곳에서 읽음 처리 시)
    const offNotificationChanged = on('notification-changed', () => {
      refreshUnreadCount();
    });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      offNotificationChanged();
    };
  }, [isAuthenticated, user, refreshUnreadCount]);

  return { unreadCount };
}
