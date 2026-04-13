import { useState, useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, View, Text, Pressable } from 'react-native';

import { COLORS } from '@/lib/constants';
import { useThemeColors } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { on } from '@/lib/events';
import { getUnreadMessageCount } from '@/services/messages';

function HeaderLogo() {
  const { currentOrg } = useAuth();
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={() => router.replace('/(student)/' as any)}
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

function useMessageBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    getUnreadMessageCount().then(setCount);

    const off = on('message-changed', () => {
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
      onPress={() => router.push('/(student)/messages' as any)}
      style={{ paddingRight: 16, position: 'relative' }}
    >
      <Ionicons name="mail-outline" size={24} color={colors.textPrimary} />
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

export default function StudentTabsLayout() {
  const colors = useThemeColors();
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
          title: '홈',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
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
        name="history"
        options={{
          title: '연습 기록',
          tabBarLabel: '기록',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
