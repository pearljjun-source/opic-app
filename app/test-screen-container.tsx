import { View, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ScreenContainer } from '@/components/layout/SafeAreaView';
import { Header, HeaderButton } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/**
 * ScreenContainer 실제 테스트 화면
 * - ScreenContainer를 루트 컨테이너로 사용
 * - SafeAreaView가 제대로 적용되는지 확인
 */
export default function TestScreenContainerScreen() {
  const router = useRouter();

  return (
    <ScreenContainer backgroundColor="#F3F4F6">
      {/* Header */}
      <Header
        title="ScreenContainer 테스트"
        showBack
        onBack={() => router.back()}
        rightComponent={
          <HeaderButton
            icon="information-circle-outline"
            onPress={() => Alert.alert(
              'ScreenContainer',
              'SafeAreaView + 배경색 + 패딩을 포함한 화면 래퍼입니다.\n\n노치, 홈 인디케이터 영역을 자동으로 피합니다.'
            )}
            accessibilityLabel="정보"
          />
        }
      />

      {/* Content */}
      <View className="flex-1 px-4 py-4">
        <Card variant="elevated" className="mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-2">
            ScreenContainer 동작 확인
          </Text>
          <Text className="text-sm text-gray-600 mb-3">
            이 화면은 ScreenContainer를 루트로 사용합니다.
          </Text>
          <View className="bg-green-50 rounded-lg p-3">
            <Text className="text-sm text-green-800">
              ✓ 상단: 노치/상태바 영역 피함{'\n'}
              ✓ 하단: 홈 인디케이터 영역 피함{'\n'}
              ✓ 배경색: #F3F4F6 (회색) 적용
            </Text>
          </View>
        </Card>

        <Card variant="outlined" className="mb-4">
          <Text className="text-sm font-semibold text-gray-700 mb-2">
            ScreenContainer Props
          </Text>
          <Text className="text-xs text-gray-600 mb-1">
            • backgroundColor: 배경색 (기본: #FFFFFF)
          </Text>
          <Text className="text-xs text-gray-600 mb-1">
            • padded: px-4 패딩 적용 여부 (기본: true)
          </Text>
          <Text className="text-xs text-gray-600">
            • edges: SafeArea 방향 (기본: top, bottom)
          </Text>
        </Card>

        <Card variant="outlined" className="mb-4">
          <Text className="text-sm font-semibold text-gray-700 mb-2">
            vs 일반 SafeAreaView
          </Text>
          <Text className="text-xs text-gray-600">
            ScreenContainer = SafeAreaView + 배경색 + 패딩{'\n'}
            간편하게 화면 구조를 잡을 때 사용
          </Text>
        </Card>

        {/* 화면 가장자리 확인용 */}
        <View className="flex-1 justify-end">
          <View className="bg-blue-100 rounded-lg p-4 mb-2">
            <Text className="text-sm text-blue-800 text-center">
              이 영역이 홈 인디케이터와 겹치지 않으면{'\n'}
              SafeArea가 제대로 적용된 것입니다
            </Text>
          </View>

          <Button
            variant="outline"
            fullWidth
            leftIcon={<Ionicons name="arrow-back" size={18} color="#3B82F6" />}
            onPress={() => router.back()}
          >
            테스트 화면으로 돌아가기
          </Button>
        </View>
      </View>
    </ScreenContainer>
  );
}
