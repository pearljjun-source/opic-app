import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Pressable } from 'react-native';

import { COLORS } from '@/lib/constants';
import { useThemeColors } from '@/hooks/useTheme';

function AdminHeaderLogo() {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={() => router.replace('/(admin)/')}
      style={{ paddingLeft: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      <Text style={{ fontFamily: 'Pretendard-Bold', fontSize: 18, color: colors.textPrimary }}>
        Speaky Admin
      </Text>
    </Pressable>
  );
}

export default function AdminTabsLayout() {
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
        headerLeft: () => <AdminHeaderLogo />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '대시보드',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: '사용자',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="academies"
        options={{
          title: '학원',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'business' : 'business-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="landing"
        options={{
          title: 'Landing',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'layers' : 'layers-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          title: '결제',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'card' : 'card-outline'} size={size} color={color} />
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
