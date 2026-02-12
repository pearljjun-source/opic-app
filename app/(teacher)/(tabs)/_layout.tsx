import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';

export default function TeacherTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.PRIMARY,
        tabBarInactiveTintColor: COLORS.GRAY_400,
        tabBarStyle: {
          borderTopWidth: 0.5,
          borderTopColor: COLORS.BORDER,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontFamily: 'Pretendard-Medium',
          fontSize: 11,
        },
        headerShown: true,
        headerStyle: { backgroundColor: COLORS.BACKGROUND_SECONDARY },
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: 'Pretendard-Bold',
          fontSize: 20,
          color: COLORS.TEXT_PRIMARY,
        },
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
        name="invite"
        options={{
          title: '학생 초대',
          tabBarLabel: '초대',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person-add' : 'person-add-outline'} size={size} color={color} />
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
