import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';

/** 중첩 Stack 헤더에 홈 버튼 — 탭 바가 없을 때 탭 루트로 한 번에 복귀 */
export default function HomeButton() {
  const colors = useThemeColors();
  const { platformRole, orgRole } = useAuth();

  const handlePress = () => {
    if (platformRole === 'super_admin') {
      router.replace('/(admin)/' as any);
    } else if (orgRole === 'owner' || orgRole === 'teacher') {
      router.replace('/(teacher)/' as any);
    } else {
      router.replace('/(student)/' as any);
    }
  };

  return (
    <Pressable onPress={handlePress} hitSlop={8} style={{ marginRight: 12 }}>
      <Ionicons name="home-outline" size={22} color={colors.primary} />
    </Pressable>
  );
}
