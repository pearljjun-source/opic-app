import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { useThemeColors } from '@/hooks/useTheme';
import { getMyNotifications, markAllNotificationsRead } from '@/services/notifications';
import { emit } from '@/lib/events';
import { NOTIFICATION_TYPES, COLORS } from '@/lib/constants';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const NOTIFICATION_META: Record<string, { icon: IoniconsName; color: string; label: string }> = {
  [NOTIFICATION_TYPES.PRACTICE_COMPLETED]: { icon: 'checkmark-circle', color: '#10B981', label: '연습 완료' },
  [NOTIFICATION_TYPES.TEACHER_FEEDBACK]: { icon: 'chatbubble-ellipses', color: COLORS.PRIMARY, label: '피드백' },
  [NOTIFICATION_TYPES.NEW_SCRIPT]: { icon: 'document-text', color: '#3B82F6', label: '새 스크립트' },
  [NOTIFICATION_TYPES.STUDENT_CONNECTED]: { icon: 'person-add', color: '#8B5CF6', label: '학생 연결' },
  [NOTIFICATION_TYPES.PAYMENT_FAILED]: { icon: 'warning', color: '#EF4444', label: '결제 실패' },
};

function getNotificationMeta(type: string) {
  return NOTIFICATION_META[type] || { icon: 'notifications' as IoniconsName, color: '#6B7280', label: '알림' };
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export default function TeacherNotifications() {
  const colors = useThemeColors();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    const { data } = await getMyNotifications(50);
    setNotifications(data || []);
    setLoading(false);
  }, []);

  // 화면 진입 시 알림 로드 + 전부 읽음 처리
  useFocusEffect(
    useCallback(() => {
      loadNotifications().then(async () => {
        await markAllNotificationsRead();
        emit('notification-changed');
      });
    }, [loadNotifications])
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (notifications.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name="notifications-off-outline" size={48} color={colors.textDisabled} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>알림이 없습니다</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.surfaceSecondary }]} contentContainerStyle={styles.contentContainer}>
      {notifications.map((item) => {
        const meta = getNotificationMeta(item.type);
        const isUnread = !item.read_at;
        return (
          <View
            key={item.id}
            style={[
              styles.notificationCard,
              { backgroundColor: colors.surface },
              isUnread && { backgroundColor: colors.primaryLight || colors.surface },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: meta.color + '15' }]}>
              <Ionicons name={meta.icon} size={20} color={meta.color} />
            </View>
            <View style={styles.content}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.time, { color: colors.textDisabled }]}>
                  {formatRelativeTime(item.created_at)}
                </Text>
              </View>
              {item.body && (
                <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={2}>
                  {item.body}
                </Text>
              )}
            </View>
            {isUnread && <View style={[styles.unreadDot, { backgroundColor: COLORS.PRIMARY }]} />}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Pretendard-Medium',
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
  },
  body: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
