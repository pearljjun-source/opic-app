import { useState, useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, View, Text, Pressable, Platform } from 'react-native';

import { COLORS } from '@/lib/constants';
import { useThemeColors } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { on } from '@/lib/events';
import { getUnreadCount } from '@/services/notifications';
import { getUnreadMessageCount } from '@/services/messages';

function HeaderLogo() {
  const { currentOrg } = useAuth();
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={() => router.replace('/(teacher)/' as any)}
      style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16 }}
    >
      <Image
        source={require('@/assets/images/speaky-text-logo.png')}
        style={{ width: 172, height: 56, marginRight: -24 }}
        resizeMode="contain"
      />
      {currentOrg && (
        <>
          <View style={{ width: 1, height: 16, backgroundColor: colors.border, marginHorizontal: 8 }} />
          <Text style={{ fontSize: 13, fontFamily: 'Pretendard-Medium', color: colors.textSecondary }} numberOfLines={1}>
            {currentOrg.name}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function useNotificationBadge() {
  const [badge, setBadge] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // 초기 로드
    getUnreadCount().then(setBadge);

    // 이벤트 구독
    const off = on('notification-changed', () => {
      getUnreadCount().then(setBadge);
    });
    return off;
  }, []);

  return badge;
}

function useMessageBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    getUnreadMessageCount().then(setCount);

    const off = on('message-sent', () => {
      getUnreadMessageCount().then(setCount);
    });
    return off;
  }, []);

  return count;
}

function HeaderRight() {
  const colors = useThemeColors();
  const msgBadge = useMessageBadge();

  return (
    <Pressable
      onPress={() => router.push('/(teacher)/messages/' as any)}
      style={{ paddingRight: 16, position: 'relative' }}
    >
      <Ionicons name="chatbubbles-outline" size={24} color={colors.textPrimary} />
      {msgBadge > 0 && (
        <View style={{
          position: 'absolute', top: -4, right: 10,
          backgroundColor: COLORS.PRIMARY, borderRadius: 8,
          minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center',
          paddingHorizontal: 4,
        }}>
          <Text style={{ color: '#fff', fontSize: 10, fontFamily: 'Pretendard-Bold' }}>
            {msgBadge > 99 ? '99+' : msgBadge}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default function TeacherTabsLayout() {
  const colors = useThemeColors();
  const badge = useNotificationBadge();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDisabled,
        tabBarStyle: {
          borderTopWidth: 0.5,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontFamily: 'Pretendard-Medium',
          fontSize: 11,
        },
        headerShown: true,
        headerStyle: { backgroundColor: colors.surfaceSecondary },
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: 'Pretendard-Bold',
          fontSize: 20,
          color: colors.textPrimary,
        },
        headerTitle: '',
        headerLeft: () => <HeaderLogo />,
        headerRight: () => <HeaderRight />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '학생 목록',
          tabBarLabel: '홈',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="classes"
        options={{
          title: '반 관리',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'school' : 'school-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="invite"
        options={{
          title: '초대',
          tabBarLabel: '초대',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person-add' : 'person-add-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="exam"
        options={{
          title: '모의고사',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarBadge: badge > 0 ? (badge > 99 ? '99+' : badge) : undefined,
          tabBarBadgeStyle: badge > 0 ? { backgroundColor: COLORS.PRIMARY, fontSize: 10 } : undefined,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
