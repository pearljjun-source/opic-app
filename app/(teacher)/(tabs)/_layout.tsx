import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, View, Text } from 'react-native';

import { COLORS } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';

function HeaderLogo() {
  const { currentOrg } = useAuth();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16 }}>
      <Image
        source={require('@/assets/images/speaky-text-logo.png')}
        style={{ width: 172, height: 56, marginRight: -24 }}
        resizeMode="contain"
      />
      {currentOrg && (
        <>
          <View style={{ width: 1, height: 16, backgroundColor: COLORS.GRAY_200, marginHorizontal: 8 }} />
          <Text style={{ fontSize: 13, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_SECONDARY }} numberOfLines={1}>
            {currentOrg.name}
          </Text>
        </>
      )}
    </View>
  );
}

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
        headerTitle: '',
        headerLeft: () => <HeaderLogo />,
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
