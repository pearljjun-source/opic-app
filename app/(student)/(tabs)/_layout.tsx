import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, View, Text, Pressable } from 'react-native';

import { COLORS } from '@/lib/constants';
import { useThemeColors } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';

function HeaderLogo() {
  const { currentOrg } = useAuth();
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={() => router.replace('/(student)/')}
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
