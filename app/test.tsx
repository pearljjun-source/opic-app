import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Hooks
import {
  useAppState,
  useOnForeground,
  useOnBackground,
} from '@/hooks/useAppState';
import {
  useNetworkStatus,
  useIsOnline,
} from '@/hooks/useNetworkStatus';
import { useAuth } from '@/hooks/useAuth';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, PressableCard, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import {
  LoadingSpinner,
  LoadingOverlay,
  LoadingScreen,
  Skeleton,
  SkeletonCard,
  SkeletonList,
} from '@/components/ui/Loading';
import {
  EmptyState,
  NoDataState,
  NoSearchResultState,
  NoConnectionState,
  NoStudentsState,
  NoScriptsState,
  NoPracticesState,
  ErrorState,
  OfflineState,
} from '@/components/ui/EmptyState';
import {
  Badge,
  StatusBadge,
  ScoreBadge,
  DifficultyBadge,
} from '@/components/ui/Badge';

// Layout 컴포넌트
import {
  SafeAreaView as CustomSafeAreaView,
  ScreenContainer,
  useSafeInsets,
} from '@/components/layout/SafeAreaView';
import {
  Header,
  SimpleHeader,
  LargeHeader,
  HeaderButton,
} from '@/components/layout/Header';

// 테스트할 컴포넌트 타입 정의
type TestComponentType =
  | 'button'
  | 'input'
  | 'card'
  | 'modal'
  | 'loading'
  | 'empty'
  | 'badge'
  | 'layout'
  | 'appstate'
  | 'network'
  | 'auth';

// 테스트할 컴포넌트 선택
const TEST_COMPONENT: TestComponentType = 'auth';

// ============================================================================
// AppState 테스트 컴포넌트 (Hooks 규칙 준수를 위해 별도 분리)
// ============================================================================
function AppStateTestScreen() {
  // 상태 변화 로그
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString('ko-KR');
    setLogs(prev => [`[${time}] ${message}`, ...prev].slice(0, 20));
  }, []);

  // useAppState hook 테스트
  const { appState, isActive, isBackground, isInactive } = useAppState({
    onForeground: () => addLog('🟢 onForeground 콜백 실행'),
    onBackground: () => addLog('🔴 onBackground 콜백 실행'),
    onChange: (state) => addLog(`📱 상태 변경: ${state}`),
  });

  // useOnForeground hook 테스트
  useOnForeground(() => {
    addLog('✅ useOnForeground 콜백 실행');
  });

  // useOnBackground hook 테스트
  useOnBackground(() => {
    addLog('⛔ useOnBackground 콜백 실행');
  });

  const getStateColor = () => {
    if (isActive) return 'bg-green-500';
    if (isBackground) return 'bg-red-500';
    if (isInactive) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const getStateEmoji = () => {
    if (isActive) return '🟢';
    if (isBackground) return '🔴';
    if (isInactive) return '🟡';
    return '⚪';
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <ScrollView className="flex-1">
        <View className="bg-white px-4 py-4">
          <Text className="text-2xl font-bold text-gray-900 mb-4">
            useAppState Hook 테스트
          </Text>

          {/* 현재 상태 표시 */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            현재 앱 상태
          </Text>
          <View className={`${getStateColor()} rounded-xl p-6 mb-4`}>
            <Text className="text-4xl text-center mb-2">{getStateEmoji()}</Text>
            <Text className="text-2xl font-bold text-white text-center">
              {appState.toUpperCase()}
            </Text>
          </View>

          {/* Boolean 플래그 */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            상태 플래그
          </Text>
          <View className="flex-row gap-2 mb-6">
            <View className={`flex-1 p-3 rounded-lg ${isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
              <Text className={`text-center font-medium ${isActive ? 'text-green-700' : 'text-gray-400'}`}>
                isActive
              </Text>
              <Text className={`text-center text-lg font-bold ${isActive ? 'text-green-700' : 'text-gray-400'}`}>
                {isActive ? 'true' : 'false'}
              </Text>
            </View>
            <View className={`flex-1 p-3 rounded-lg ${isBackground ? 'bg-red-100' : 'bg-gray-100'}`}>
              <Text className={`text-center font-medium ${isBackground ? 'text-red-700' : 'text-gray-400'}`}>
                isBackground
              </Text>
              <Text className={`text-center text-lg font-bold ${isBackground ? 'text-red-700' : 'text-gray-400'}`}>
                {isBackground ? 'true' : 'false'}
              </Text>
            </View>
            <View className={`flex-1 p-3 rounded-lg ${isInactive ? 'bg-yellow-100' : 'bg-gray-100'}`}>
              <Text className={`text-center font-medium ${isInactive ? 'text-yellow-700' : 'text-gray-400'}`}>
                isInactive
              </Text>
              <Text className={`text-center text-lg font-bold ${isInactive ? 'text-yellow-700' : 'text-gray-400'}`}>
                {isInactive ? 'true' : 'false'}
              </Text>
            </View>
          </View>

          {/* 테스트 방법 */}
          <Card variant="outlined" className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">테스트 방법</Text>
            <Text className="text-sm text-gray-600">
              1. 홈 버튼 또는 앱 스위처로 앱 최소화{'\n'}
              2. 상태가 background/inactive로 변경됨{'\n'}
              3. 다시 앱으로 돌아오면 active로 변경{'\n'}
              4. 아래 로그에서 콜백 실행 확인
            </Text>
          </Card>

          {/* 로그 */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            상태 변화 로그
          </Text>
          <View className="bg-gray-900 rounded-lg p-4 mb-4 min-h-[200px]">
            {logs.length === 0 ? (
              <Text className="text-gray-500 text-center">
                앱을 최소화했다가 돌아오면{'\n'}로그가 여기에 표시됩니다
              </Text>
            ) : (
              logs.map((log, index) => (
                <Text key={index} className="text-green-400 text-xs font-mono mb-1">
                  {log}
                </Text>
              ))
            )}
          </View>

          {/* 로그 초기화 */}
          <Button
            variant="outline"
            fullWidth
            onPress={() => setLogs([])}
            className="mb-4"
          >
            로그 초기화
          </Button>

          {/* Hook 설명 */}
          <Card variant="outlined" className="mb-8">
            <Text className="text-sm font-semibold text-gray-700 mb-2">사용 가능한 Hooks</Text>
            <Text className="text-xs text-gray-600 mb-1">
              • useAppState: 앱 상태 + 콜백 옵션
            </Text>
            <Text className="text-xs text-gray-600 mb-1">
              • useOnForeground: 포그라운드 복귀 시 실행
            </Text>
            <Text className="text-xs text-gray-600 mb-1">
              • useOnBackground: 백그라운드 이동 시 실행
            </Text>
            <Text className="text-xs text-gray-600 mb-1">
              • useSessionCheckOnForeground: 세션 체크 (5분 간격)
            </Text>
            <Text className="text-xs text-gray-600">
              • useInactivityTimer: 비활성 타이머
            </Text>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// NetworkStatus 테스트 컴포넌트 (Hooks 규칙 준수를 위해 별도 분리)
// ============================================================================
function NetworkStatusTestScreen() {
  const [refreshing, setRefreshing] = useState(false);

  // useNetworkStatus hook 테스트
  const {
    isConnected,
    isInternetReachable,
    type,
    isWifi,
    isCellular,
    refresh,
  } = useNetworkStatus();

  // useIsOnline hook 테스트
  const isOnline = useIsOnline();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const getConnectionIcon = () => {
    if (!isConnected) return 'cloud-offline-outline';
    if (isWifi) return 'wifi';
    if (isCellular) return 'cellular';
    return 'globe-outline';
  };

  const getConnectionColor = () => {
    if (!isConnected) return 'bg-red-500';
    if (isInternetReachable === false) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getConnectionText = () => {
    if (!isConnected) return '연결 없음';
    if (isInternetReachable === false) return '인터넷 없음';
    if (isWifi) return 'Wi-Fi 연결됨';
    if (isCellular) return '모바일 데이터';
    return '연결됨';
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <ScrollView className="flex-1">
        <View className="bg-white px-4 py-4">
          <Text className="text-2xl font-bold text-gray-900 mb-4">
            useNetworkStatus Hook 테스트
          </Text>

          {/* 현재 연결 상태 */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            현재 네트워크 상태
          </Text>
          <View className={`${getConnectionColor()} rounded-xl p-6 mb-4`}>
            <View className="items-center">
              <Ionicons name={getConnectionIcon()} size={48} color="white" />
              <Text className="text-2xl font-bold text-white mt-2">
                {getConnectionText()}
              </Text>
              <Text className="text-white/80 mt-1">
                {type ? `타입: ${type}` : ''}
              </Text>
            </View>
          </View>

          {/* 상세 정보 */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            상세 정보
          </Text>
          <View className="bg-gray-50 rounded-lg p-4 mb-4">
            <View className="flex-row justify-between py-2 border-b border-gray-200">
              <Text className="text-gray-600">isConnected</Text>
              <Text className={`font-bold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                {isConnected ? 'true' : 'false'}
              </Text>
            </View>
            <View className="flex-row justify-between py-2 border-b border-gray-200">
              <Text className="text-gray-600">isInternetReachable</Text>
              <Text className={`font-bold ${isInternetReachable ? 'text-green-600' : isInternetReachable === false ? 'text-red-600' : 'text-gray-400'}`}>
                {isInternetReachable === null ? 'null' : isInternetReachable ? 'true' : 'false'}
              </Text>
            </View>
            <View className="flex-row justify-between py-2 border-b border-gray-200">
              <Text className="text-gray-600">type</Text>
              <Text className="font-bold text-gray-900">{type || 'null'}</Text>
            </View>
            <View className="flex-row justify-between py-2 border-b border-gray-200">
              <Text className="text-gray-600">isWifi</Text>
              <Text className={`font-bold ${isWifi ? 'text-blue-600' : 'text-gray-400'}`}>
                {isWifi ? 'true' : 'false'}
              </Text>
            </View>
            <View className="flex-row justify-between py-2 border-b border-gray-200">
              <Text className="text-gray-600">isCellular</Text>
              <Text className={`font-bold ${isCellular ? 'text-orange-600' : 'text-gray-400'}`}>
                {isCellular ? 'true' : 'false'}
              </Text>
            </View>
            <View className="flex-row justify-between py-2">
              <Text className="text-gray-600">isOnline (hook)</Text>
              <Text className={`font-bold ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? 'true' : 'false'}
              </Text>
            </View>
          </View>

          {/* 새로고침 버튼 */}
          <Button
            fullWidth
            loading={refreshing}
            onPress={handleRefresh}
            className="mb-4"
          >
            네트워크 상태 새로고침
          </Button>

          {/* 테스트 방법 */}
          <Card variant="outlined" className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">테스트 방법</Text>
            <Text className="text-sm text-gray-600">
              1. 비행기 모드 켜기 → isConnected: false{'\n'}
              2. Wi-Fi만 켜기 → isWifi: true{'\n'}
              3. Wi-Fi 끄고 모바일 데이터 → isCellular: true{'\n'}
              4. 네트워크 변경 시 자동 업데이트 확인
            </Text>
          </Card>

          {/* Hook 설명 */}
          <Card variant="outlined" className="mb-8">
            <Text className="text-sm font-semibold text-gray-700 mb-2">사용 가능한 Hooks</Text>
            <Text className="text-xs text-gray-600 mb-1">
              • useNetworkStatus: 전체 네트워크 상태 + refresh
            </Text>
            <Text className="text-xs text-gray-600 mb-1">
              • useIsOnline: 온라인 여부만 (boolean)
            </Text>
            <Text className="text-xs text-gray-600">
              • useOfflineAwareFetch: 오프라인 체크 포함 fetch
            </Text>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// Auth 테스트 컴포넌트 (Hooks 규칙 준수를 위해 별도 분리)
// ============================================================================
function AuthTestScreen() {
  const [testEmail, setTestEmail] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [testName, setTestName] = useState('');
  const [testRole, setTestRole] = useState<'teacher' | 'student'>('student');
  const [actionLoading, setActionLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // useAuth hook 테스트
  const {
    user,
    session,
    isLoading,
    isAuthenticated,
    signIn,
    signUp,
    signOut,
    resetPassword,
    refreshUser,
  } = useAuth();

  const addLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString('ko-KR');
    setLogs(prev => [`[${time}] ${message}`, ...prev].slice(0, 15));
  }, []);

  const handleSignIn = async () => {
    if (!testEmail || !testPassword) {
      Alert.alert('오류', '이메일과 비밀번호를 입력하세요');
      return;
    }
    setActionLoading(true);
    addLog(`로그인 시도: ${testEmail}`);
    const { error } = await signIn(testEmail, testPassword);
    if (error) {
      addLog(`❌ 로그인 실패: ${error.message}`);
      Alert.alert('로그인 실패', error.message);
    } else {
      addLog('✅ 로그인 성공');
    }
    setActionLoading(false);
  };

  const handleSignUp = async () => {
    if (!testEmail || !testPassword || !testName) {
      Alert.alert('오류', '모든 필드를 입력하세요');
      return;
    }
    setActionLoading(true);
    addLog(`회원가입 시도: ${testEmail} (${testRole})`);
    const { error } = await signUp(testEmail, testPassword, testName);
    if (error) {
      addLog(`❌ 회원가입 실패: ${error.message}`);
      Alert.alert('회원가입 실패', error.message);
    } else {
      addLog('✅ 회원가입 성공');
      Alert.alert('성공', '회원가입이 완료되었습니다');
    }
    setActionLoading(false);
  };

  const handleSignOut = async () => {
    setActionLoading(true);
    addLog('로그아웃 시도');
    await signOut();
    addLog('✅ 로그아웃 완료');
    setActionLoading(false);
  };

  const handleResetPassword = async () => {
    if (!testEmail) {
      Alert.alert('오류', '이메일을 입력하세요');
      return;
    }
    setActionLoading(true);
    addLog(`비밀번호 재설정 시도: ${testEmail}`);
    const { error } = await resetPassword(testEmail);
    if (error) {
      addLog(`❌ 재설정 실패: ${error.message}`);
      Alert.alert('실패', error.message);
    } else {
      addLog('✅ 재설정 이메일 발송');
      Alert.alert('성공', '비밀번호 재설정 이메일이 발송되었습니다');
    }
    setActionLoading(false);
  };

  const handleRefreshUser = async () => {
    addLog('사용자 정보 새로고침');
    await refreshUser();
    addLog('✅ 새로고침 완료');
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-100 items-center justify-center">
        <LoadingSpinner size="large" />
        <Text className="text-gray-500 mt-4">인증 상태 확인 중...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <ScrollView className="flex-1">
        <View className="bg-white px-4 py-4">
          <Text className="text-2xl font-bold text-gray-900 mb-4">
            useAuth Hook 테스트
          </Text>

          {/* 현재 인증 상태 */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            인증 상태
          </Text>
          <View className={`${isAuthenticated ? 'bg-green-500' : 'bg-gray-500'} rounded-xl p-4 mb-4`}>
            <Text className="text-xl font-bold text-white text-center">
              {isAuthenticated ? '🔓 로그인됨' : '🔒 로그아웃 상태'}
            </Text>
            {isAuthenticated && user && (
              <View className="mt-2">
                <Text className="text-white/90 text-center">{user.email}</Text>
                <Text className="text-white/80 text-center text-sm">
                  {user.name}
                </Text>
              </View>
            )}
          </View>

          {/* 상태 상세 */}
          <View className="bg-gray-50 rounded-lg p-4 mb-4">
            <View className="flex-row justify-between py-1">
              <Text className="text-gray-600">isAuthenticated</Text>
              <Text className={`font-bold ${isAuthenticated ? 'text-green-600' : 'text-gray-400'}`}>
                {isAuthenticated ? 'true' : 'false'}
              </Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-gray-600">isLoading</Text>
              <Text className="font-bold text-gray-900">{isLoading ? 'true' : 'false'}</Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-gray-600">session</Text>
              <Text className="font-bold text-gray-900">{session ? '있음' : 'null'}</Text>
            </View>
          </View>

          {/* 로그인/회원가입 폼 */}
          {!isAuthenticated && (
            <>
              <Text className="text-lg font-semibold text-gray-700 mb-3">
                테스트 로그인/회원가입
              </Text>
              <Input
                label="이메일"
                value={testEmail}
                onChangeText={setTestEmail}
                placeholder="test@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Input
                label="비밀번호"
                value={testPassword}
                onChangeText={setTestPassword}
                placeholder="비밀번호 입력"
                isPassword
              />
              <Input
                label="이름 (회원가입용)"
                value={testName}
                onChangeText={setTestName}
                placeholder="이름 입력"
              />
              <View className="flex-row gap-2 mb-4">
                <Button
                  variant={testRole === 'student' ? 'primary' : 'outline'}
                  onPress={() => setTestRole('student')}
                  className="flex-1"
                >
                  학생
                </Button>
                <Button
                  variant={testRole === 'teacher' ? 'primary' : 'outline'}
                  onPress={() => setTestRole('teacher')}
                  className="flex-1"
                >
                  강사
                </Button>
              </View>
              <View className="gap-2 mb-4">
                <Button loading={actionLoading} onPress={handleSignIn}>
                  로그인
                </Button>
                <Button loading={actionLoading} variant="secondary" onPress={handleSignUp}>
                  회원가입
                </Button>
                <Button loading={actionLoading} variant="outline" onPress={handleResetPassword}>
                  비밀번호 재설정
                </Button>
              </View>
            </>
          )}

          {/* 로그인 후 액션 */}
          {isAuthenticated && (
            <View className="gap-2 mb-4">
              <Button variant="outline" onPress={handleRefreshUser}>
                사용자 정보 새로고침
              </Button>
              <Button variant="danger" loading={actionLoading} onPress={handleSignOut}>
                로그아웃
              </Button>
            </View>
          )}

          {/* 로그 */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            액션 로그
          </Text>
          <View className="bg-gray-900 rounded-lg p-4 mb-4 min-h-[150px]">
            {logs.length === 0 ? (
              <Text className="text-gray-500 text-center">
                로그인/회원가입을 시도하면{'\n'}로그가 여기에 표시됩니다
              </Text>
            ) : (
              logs.map((log, index) => (
                <Text key={index} className="text-green-400 text-xs font-mono mb-1">
                  {log}
                </Text>
              ))
            )}
          </View>

          {/* 주의사항 */}
          <Card variant="outlined" className="mb-8">
            <Text className="text-sm font-semibold text-gray-700 mb-2">⚠️ 테스트 전 확인</Text>
            <Text className="text-xs text-gray-600">
              • Supabase 프로젝트 설정 필요{'\n'}
              • users 테이블이 존재해야 함{'\n'}
              • 이메일 확인 비활성화 권장 (테스트용)
            </Text>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function TestScreen() {
  const [loading, setLoading] = useState(false);

  // Input 테스트용 state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [emailError, setEmailError] = useState('');

  // Modal 테스트용 state
  const [basicModalVisible, setBasicModalVisible] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [modalInput, setModalInput] = useState('');

  // Loading 테스트용 state
  const [showOverlay, setShowOverlay] = useState(false);

  const handlePress = (label: string) => {
    Alert.alert('버튼 클릭', `${label} 버튼이 클릭되었습니다`);
  };

  const handleLoadingTest = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  const validateEmail = () => {
    if (!email) {
      setEmailError('이메일을 입력해주세요');
    } else if (!email.includes('@')) {
      setEmailError('올바른 이메일 형식이 아닙니다');
    } else {
      setEmailError('');
      Alert.alert('성공', '유효한 이메일입니다');
    }
  };

  // AppState 테스트 화면 - 별도 컴포넌트 사용 (Hooks 규칙 준수)
  if (TEST_COMPONENT === 'appstate') {
    return <AppStateTestScreen />;
  }

  // NetworkStatus 테스트 화면 - 별도 컴포넌트 사용 (Hooks 규칙 준수)
  if (TEST_COMPONENT === 'network') {
    return <NetworkStatusTestScreen />;
  }

  // Auth 테스트 화면 - 별도 컴포넌트 사용 (Hooks 규칙 준수)
  if (TEST_COMPONENT === 'auth') {
    return <AuthTestScreen />;
  }

  // Layout 테스트 화면 (SafeAreaView + Header)
  if (TEST_COMPONENT === 'layout') {
    const insets = useSafeInsets();
    const router = useRouter();

    return (
      <CustomSafeAreaView backgroundColor="#F3F4F6" edges={['top', 'bottom']}>
        <ScrollView className="flex-1">
          {/* 기본 SafeAreaView 정보 */}
          <View className="bg-white px-4 py-4">
            <Text className="text-2xl font-bold text-gray-900 mb-4">
              Layout 컴포넌트 테스트
            </Text>

            {/* useSafeInsets Hook */}
            <Text className="text-lg font-semibold text-gray-700 mb-2">
              useSafeInsets Hook (현재 기기)
            </Text>
            <View className="bg-gray-50 rounded-lg p-4 mb-4">
              <View className="flex-row flex-wrap gap-4">
                <View className="items-center">
                  <Text className="text-xs text-gray-500">top</Text>
                  <Text className="text-lg font-bold text-blue-600">{insets.top}px</Text>
                </View>
                <View className="items-center">
                  <Text className="text-xs text-gray-500">bottom</Text>
                  <Text className="text-lg font-bold text-blue-600">{insets.bottom}px</Text>
                </View>
                <View className="items-center">
                  <Text className="text-xs text-gray-500">left</Text>
                  <Text className="text-lg font-bold text-blue-600">{insets.left}px</Text>
                </View>
                <View className="items-center">
                  <Text className="text-xs text-gray-500">right</Text>
                  <Text className="text-lg font-bold text-blue-600">{insets.right}px</Text>
                </View>
              </View>
            </View>

            {/* SafeAreaView edges 설명 */}
            <Text className="text-lg font-semibold text-gray-700 mb-2">
              SafeAreaView edges 옵션
            </Text>
            <View className="bg-blue-50 rounded-lg p-3 mb-2">
              <Text className="text-sm text-blue-800 font-medium mb-1">현재 화면 적용:</Text>
              <Text className="text-sm text-blue-700">edges={`['top', 'bottom']`}</Text>
            </View>
            <Card variant="outlined" className="mb-4">
              <Text className="text-xs text-gray-600">• edges={`['top']`}: 상단만 SafeArea 적용</Text>
              <Text className="text-xs text-gray-600">• edges={`['bottom']`}: 하단만 적용 (홈바)</Text>
              <Text className="text-xs text-gray-600">• edges={`['top', 'bottom']`}: 상하단 적용 (기본값)</Text>
              <Text className="text-xs text-gray-600">• edges={`['left', 'right']`}: 좌우 적용 (가로모드)</Text>
            </Card>
          </View>

          {/* Header 컴포넌트들 */}
          <View className="bg-white mt-2 px-4 py-4">
            <Text className="text-lg font-semibold text-gray-700 mb-3">
              Header (기본)
            </Text>
            <View className="border border-gray-200 rounded-lg overflow-hidden mb-4">
              <Header title="기본 헤더" />
            </View>

            <Text className="text-lg font-semibold text-gray-700 mb-3">
              Header + 뒤로가기
            </Text>
            <View className="border border-gray-200 rounded-lg overflow-hidden mb-4">
              <Header
                title="뒤로가기 헤더"
                showBack
                onBack={() => Alert.alert('뒤로가기', '뒤로가기 클릭')}
              />
            </View>

            <Text className="text-lg font-semibold text-gray-700 mb-3">
              Header + 좌우 컴포넌트
            </Text>
            <View className="border border-gray-200 rounded-lg overflow-hidden mb-4">
              <Header
                title="양쪽 버튼"
                leftComponent={
                  <HeaderButton
                    icon="menu"
                    onPress={() => Alert.alert('메뉴', '메뉴 클릭')}
                    accessibilityLabel="메뉴"
                  />
                }
                rightComponent={
                  <HeaderButton
                    icon="settings-outline"
                    onPress={() => Alert.alert('설정', '설정 클릭')}
                    accessibilityLabel="설정"
                  />
                }
              />
            </View>

            <Text className="text-lg font-semibold text-gray-700 mb-3">
              Header + 뱃지 버튼
            </Text>
            <View className="border border-gray-200 rounded-lg overflow-hidden mb-4">
              <Header
                title="알림 뱃지"
                rightComponent={
                  <HeaderButton
                    icon="notifications-outline"
                    badge={5}
                    onPress={() => Alert.alert('알림', '5개의 알림')}
                    accessibilityLabel="알림"
                  />
                }
              />
            </View>
          </View>

          {/* SimpleHeader */}
          <View className="bg-white mt-2 px-4 py-4">
            <Text className="text-lg font-semibold text-gray-700 mb-3">
              SimpleHeader (제목만)
            </Text>
            <View className="border border-gray-200 rounded-lg overflow-hidden mb-4">
              <SimpleHeader title="심플 헤더" />
            </View>
          </View>

          {/* LargeHeader */}
          <View className="bg-white mt-2 px-4 py-4">
            <Text className="text-lg font-semibold text-gray-700 mb-3">
              LargeHeader (대시보드용)
            </Text>
            <View className="border border-gray-200 rounded-lg overflow-hidden mb-4">
              <LargeHeader title="대시보드" />
            </View>

            <Text className="text-lg font-semibold text-gray-700 mb-3">
              LargeHeader + 부제목
            </Text>
            <View className="border border-gray-200 rounded-lg overflow-hidden mb-4">
              <LargeHeader
                title="안녕하세요, Jin님"
                subtitle="오늘도 열심히 연습해보세요!"
              />
            </View>

            <Text className="text-lg font-semibold text-gray-700 mb-3">
              LargeHeader + 우측 컴포넌트
            </Text>
            <View className="border border-gray-200 rounded-lg overflow-hidden mb-4">
              <LargeHeader
                title="학생 관리"
                subtitle="총 12명의 학생"
                rightComponent={
                  <Button
                    size="sm"
                    leftIcon={<Ionicons name="add" size={16} color="white" />}
                    onPress={() => Alert.alert('추가', '학생 추가')}
                  >
                    초대
                  </Button>
                }
              />
            </View>
          </View>

          {/* HeaderButton 상세 */}
          <View className="bg-white mt-2 px-4 py-4">
            <Text className="text-lg font-semibold text-gray-700 mb-3">
              HeaderButton (독립 사용)
            </Text>
            <View className="flex-row gap-3 mb-4">
              <HeaderButton
                icon="search"
                onPress={() => Alert.alert('검색')}
                accessibilityLabel="검색"
              />
              <HeaderButton
                icon="add"
                onPress={() => Alert.alert('추가')}
                accessibilityLabel="추가"
              />
              <HeaderButton
                icon="share-outline"
                onPress={() => Alert.alert('공유')}
                accessibilityLabel="공유"
              />
              <HeaderButton
                icon="ellipsis-vertical"
                onPress={() => Alert.alert('더보기')}
                accessibilityLabel="더보기"
              />
              <HeaderButton
                icon="notifications-outline"
                badge={99}
                onPress={() => Alert.alert('알림 99개')}
                accessibilityLabel="알림"
              />
            </View>
          </View>

          {/* ScreenContainer 테스트 (별도 화면) */}
          <View className="bg-white mt-2 px-4 py-4">
            <Text className="text-lg font-semibold text-gray-700 mb-3">
              ScreenContainer (실제 화면 테스트)
            </Text>
            <Card variant="outlined" className="mb-4">
              <Text className="text-sm text-gray-600 mb-3">
                ScreenContainer는 화면 전체의 루트로 사용해야 합니다.{'\n'}
                인라인 미리보기가 아닌, 실제 화면에서 테스트합니다.
              </Text>
              <Text className="text-xs text-gray-500">
                • SafeAreaView 포함{'\n'}
                • 배경색 설정{'\n'}
                • 패딩 옵션
              </Text>
            </Card>
            <Button
              fullWidth
              leftIcon={<Ionicons name="open-outline" size={18} color="white" />}
              onPress={() => router.push('/test-screen-container')}
            >
              ScreenContainer 테스트 화면 열기
            </Button>
          </View>

          {/* 사용 가이드 */}
          <View className="bg-white mt-2 px-4 py-4 mb-8">
            <Card variant="outlined">
              <Text className="text-sm font-semibold text-gray-700 mb-2">사용 가이드</Text>
              <Text className="text-sm text-gray-600">• ScreenContainer: 화면 전체 래퍼 (권장)</Text>
              <Text className="text-sm text-gray-600">• Header: 일반 페이지 헤더</Text>
              <Text className="text-sm text-gray-600">• SimpleHeader: 제목만 있는 단순 헤더</Text>
              <Text className="text-sm text-gray-600">• LargeHeader: 대시보드/메인 화면용</Text>
              <Text className="text-sm text-gray-600">• HeaderButton: 헤더 내 아이콘 버튼</Text>
              <Text className="text-sm text-gray-600">• useSafeInsets: Safe Area 값 직접 접근</Text>
            </Card>
          </View>
        </ScrollView>
      </CustomSafeAreaView>
    );
  }

  // Badge 테스트 화면
  if (TEST_COMPONENT === 'badge') {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView className="flex-1 px-4">
          <Text className="text-2xl font-bold text-gray-900 mt-4 mb-6">
            Badge 컴포넌트 테스트
          </Text>

          {/* Basic Badge - Variants */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            Variants (7가지)
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-6">
            <Badge variant="default">Default</Badge>
            <Badge variant="primary">Primary</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="error">Error</Badge>
            <Badge variant="info">Info</Badge>
          </View>

          {/* Sizes */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            Sizes (3가지)
          </Text>
          <View className="flex-row items-center gap-3 mb-6">
            <Badge variant="primary" size="sm">Small</Badge>
            <Badge variant="primary" size="md">Medium</Badge>
            <Badge variant="primary" size="lg">Large</Badge>
          </View>

          {/* Size 비교 - 모든 variant */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            Size 비교 (모든 Variant)
          </Text>
          <View className="gap-3 mb-6">
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-gray-500 w-12">sm</Text>
              <Badge variant="success" size="sm">완료</Badge>
              <Badge variant="warning" size="sm">대기</Badge>
              <Badge variant="error" size="sm">오류</Badge>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-gray-500 w-12">md</Text>
              <Badge variant="success" size="md">완료</Badge>
              <Badge variant="warning" size="md">대기</Badge>
              <Badge variant="error" size="md">오류</Badge>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-gray-500 w-12">lg</Text>
              <Badge variant="success" size="lg">완료</Badge>
              <Badge variant="warning" size="lg">대기</Badge>
              <Badge variant="error" size="lg">오류</Badge>
            </View>
          </View>

          {/* StatusBadge */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            StatusBadge (상태별 뱃지)
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-6">
            <StatusBadge status="draft" />
            <StatusBadge status="complete" />
            <StatusBadge status="pending" />
            <StatusBadge status="used" />
            <StatusBadge status="expired" />
          </View>

          {/* ScoreBadge */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            ScoreBadge (점수별 색상)
          </Text>
          <View className="gap-2 mb-6">
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-gray-500 w-24">90점 이상</Text>
              <ScoreBadge score={95} />
              <ScoreBadge score={90} />
              <Text className="text-xs text-green-600">(초록)</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-gray-500 w-24">70~89점</Text>
              <ScoreBadge score={85} />
              <ScoreBadge score={70} />
              <Text className="text-xs text-blue-600">(파랑)</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-gray-500 w-24">50~69점</Text>
              <ScoreBadge score={65} />
              <ScoreBadge score={50} />
              <Text className="text-xs text-yellow-600">(노랑)</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-gray-500 w-24">50점 미만</Text>
              <ScoreBadge score={45} />
              <ScoreBadge score={20} />
              <Text className="text-xs text-red-600">(빨강)</Text>
            </View>
          </View>

          {/* DifficultyBadge */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            DifficultyBadge (난이도)
          </Text>
          <View className="gap-2 mb-6">
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-gray-500 w-24">쉬움 (1-2)</Text>
              <DifficultyBadge level={1} />
              <DifficultyBadge level={2} />
              <Text className="text-xs text-green-600">(초록)</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-gray-500 w-24">보통 (3-4)</Text>
              <DifficultyBadge level={3} />
              <DifficultyBadge level={4} />
              <Text className="text-xs text-yellow-600">(노랑)</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-gray-500 w-24">어려움 (5-6)</Text>
              <DifficultyBadge level={5} />
              <DifficultyBadge level={6} />
              <Text className="text-xs text-red-600">(빨강)</Text>
            </View>
          </View>

          {/* 실제 사용 예시 - 카드 내 */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            실제 사용 예시
          </Text>
          <Card variant="elevated" className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-base font-semibold text-gray-900">자기소개 스크립트</Text>
              <StatusBadge status="complete" size="sm" />
            </View>
            <Text className="text-sm text-gray-500 mb-3">Describe yourself</Text>
            <View className="flex-row items-center gap-2">
              <DifficultyBadge level={2} size="sm" />
              <Badge variant="info" size="sm">묘사</Badge>
              <View className="flex-1" />
              <ScoreBadge score={87} size="sm" />
            </View>
          </Card>

          <Card variant="outlined" className="mb-6">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-base font-semibold text-gray-900">여행 경험</Text>
              <StatusBadge status="draft" size="sm" />
            </View>
            <Text className="text-sm text-gray-500 mb-3">Tell me about a memorable trip</Text>
            <View className="flex-row items-center gap-2">
              <DifficultyBadge level={4} size="sm" />
              <Badge variant="primary" size="sm">경험</Badge>
            </View>
          </Card>

          {/* 사용 가이드 */}
          <Card variant="outlined" className="mb-8">
            <Text className="text-sm font-semibold text-gray-700 mb-2">사용 가이드</Text>
            <Text className="text-sm text-gray-600">• Badge: 기본 뱃지 (variant, size)</Text>
            <Text className="text-sm text-gray-600">• StatusBadge: 상태 표시 (draft/complete/...)</Text>
            <Text className="text-sm text-gray-600">• ScoreBadge: 점수 표시 (색상 자동)</Text>
            <Text className="text-sm text-gray-600">• DifficultyBadge: 난이도 표시 (Lv.1~6)</Text>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // EmptyState 테스트 화면
  if (TEST_COMPONENT === 'empty') {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView className="flex-1 px-4">
          <Text className="text-2xl font-bold text-gray-900 mt-4 mb-6">
            EmptyState 컴포넌트 테스트
          </Text>

          {/* Size 비교 */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            Size 비교 (sm / md / lg)
          </Text>
          <View className="flex-row gap-2 mb-6">
            <View className="flex-1 border border-gray-200 rounded-lg">
              <EmptyState
                icon="folder-outline"
                title="Small"
                size="sm"
              />
            </View>
            <View className="flex-1 border border-gray-200 rounded-lg">
              <EmptyState
                icon="folder-outline"
                title="Medium"
                size="md"
              />
            </View>
          </View>
          <View className="border border-gray-200 rounded-lg mb-6">
            <EmptyState
              icon="folder-outline"
              title="Large"
              description="가장 큰 사이즈"
              size="lg"
            />
          </View>

          {/* Custom EmptyState */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            Custom EmptyState (버튼 포함)
          </Text>
          <View className="border border-gray-200 rounded-lg mb-6">
            <EmptyState
              icon="rocket-outline"
              title="커스텀 빈 상태"
              description="원하는 아이콘과 텍스트로 구성 가능"
              actionLabel="액션 버튼"
              onAction={() => Alert.alert('액션', '버튼 클릭됨')}
            />
          </View>

          {/* NoConnectionState (학생용) */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            NoConnectionState (학생)
          </Text>
          <View className="border border-gray-200 rounded-lg mb-6">
            <NoConnectionState
              onAction={() => Alert.alert('초대 코드', '초대 코드 입력 화면으로 이동')}
            />
          </View>

          {/* NoStudentsState (강사용) */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            NoStudentsState (강사)
          </Text>
          <View className="border border-gray-200 rounded-lg mb-6">
            <NoStudentsState
              onAction={() => Alert.alert('초대', '초대 코드 생성')}
            />
          </View>

          {/* ErrorState */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            ErrorState (빨간 아이콘)
          </Text>
          <View className="border border-gray-200 rounded-lg mb-6">
            <ErrorState
              onAction={() => Alert.alert('재시도', '다시 시도합니다')}
            />
          </View>

          {/* OfflineState */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            OfflineState (노란 아이콘)
          </Text>
          <View className="border border-gray-200 rounded-lg mb-6">
            <OfflineState
              onAction={() => Alert.alert('재연결', '네트워크 확인 중...')}
            />
          </View>

          {/* fillSpace 예시 */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            fillSpace=true (전체 화면용)
          </Text>
          <View className="h-64 border border-gray-200 rounded-lg mb-6">
            <NoDataState fillSpace />
          </View>

          {/* 사용 가이드 */}
          <Card variant="outlined" className="mb-8">
            <Text className="text-sm font-semibold text-gray-700 mb-2">사용 가이드</Text>
            <Text className="text-sm text-gray-600">• size="sm": 작은 영역 (카드 내부)</Text>
            <Text className="text-sm text-gray-600">• size="md": 일반 (기본값)</Text>
            <Text className="text-sm text-gray-600">• size="lg": 큰 영역</Text>
            <Text className="text-sm text-gray-600">• fillSpace: 전체 화면 채우기</Text>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Loading 테스트 화면
  if (TEST_COMPONENT === 'loading') {
    const handleOverlayTest = () => {
      setShowOverlay(true);
      setTimeout(() => setShowOverlay(false), 2000);
    };

    return (
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView className="flex-1 px-4">
          <Text className="text-2xl font-bold text-gray-900 mt-4 mb-6">
            Loading 컴포넌트 테스트
          </Text>

          {/* LoadingSpinner */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            LoadingSpinner
          </Text>
          <View className="flex-row items-center gap-6 mb-6 p-4 bg-gray-50 rounded-lg">
            <View className="items-center">
              <LoadingSpinner size="small" />
              <Text className="text-xs text-gray-500 mt-2">Small</Text>
            </View>
            <View className="items-center">
              <LoadingSpinner size="large" />
              <Text className="text-xs text-gray-500 mt-2">Large</Text>
            </View>
            <View className="items-center">
              <LoadingSpinner size="large" color="#10B981" />
              <Text className="text-xs text-gray-500 mt-2">Custom Color</Text>
            </View>
          </View>

          {/* LoadingOverlay */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            LoadingOverlay
          </Text>
          <Button onPress={handleOverlayTest} className="mb-2">
            오버레이 표시 (2초)
          </Button>
          <Text className="text-sm text-gray-500 mb-6">
            화면 전체를 덮는 로딩 (API 호출 시 사용)
          </Text>

          {/* LoadingScreen Preview */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            LoadingScreen (미리보기)
          </Text>
          <View className="h-48 border border-gray-200 rounded-lg overflow-hidden mb-6">
            <LoadingScreen message="데이터 로딩 중..." />
          </View>

          {/* Skeleton */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            Skeleton (기본)
          </Text>
          <View className="gap-2 mb-6">
            <Skeleton width="100%" height={16} />
            <Skeleton width="80%" height={16} />
            <Skeleton width="60%" height={16} />
          </View>

          {/* Skeleton Variations */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            Skeleton (다양한 형태)
          </Text>
          <View className="flex-row items-center gap-3 mb-6">
            <Skeleton width={50} height={50} borderRadius={25} />
            <View className="flex-1 gap-2">
              <Skeleton width="70%" height={14} />
              <Skeleton width="50%" height={12} />
            </View>
          </View>

          {/* SkeletonCard */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            SkeletonCard
          </Text>
          <View className="mb-6">
            <SkeletonCard />
          </View>

          {/* SkeletonList */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            SkeletonList (count=3)
          </Text>
          <SkeletonList count={3} style={{ marginBottom: 24 }} />

          {/* 사용 예시 설명 */}
          <Card variant="outlined" className="mb-8">
            <Text className="text-sm font-semibold text-gray-700 mb-2">사용 시나리오</Text>
            <Text className="text-sm text-gray-600">• LoadingSpinner: 버튼 내부, 작은 영역</Text>
            <Text className="text-sm text-gray-600">• LoadingOverlay: API 호출 중 전체 화면 차단</Text>
            <Text className="text-sm text-gray-600">• LoadingScreen: 초기 데이터 로딩 (전체 화면)</Text>
            <Text className="text-sm text-gray-600">• Skeleton: 리스트/카드 로딩 상태</Text>
          </Card>
        </ScrollView>

        {/* Loading Overlay */}
        <LoadingOverlay visible={showOverlay} message="처리 중..." />
      </SafeAreaView>
    );
  }

  // Modal 테스트 화면
  if (TEST_COMPONENT === 'modal') {
    const handleConfirmDelete = () => {
      setConfirmLoading(true);
      setTimeout(() => {
        setConfirmLoading(false);
        setDeleteModalVisible(false);
        Alert.alert('삭제 완료', '항목이 삭제되었습니다.');
      }, 1500);
    };

    return (
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView className="flex-1 px-4">
          <Text className="text-2xl font-bold text-gray-900 mt-4 mb-6">
            Modal 컴포넌트 테스트
          </Text>

          {/* Basic Modal */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            Basic Modal
          </Text>
          <Button onPress={() => setBasicModalVisible(true)} className="mb-4">
            기본 모달 열기
          </Button>

          <Modal
            visible={basicModalVisible}
            onClose={() => setBasicModalVisible(false)}
            title="기본 모달"
            footer={
              <Button onPress={() => setBasicModalVisible(false)} fullWidth>
                확인
              </Button>
            }
          >
            <Text className="text-base text-gray-700">
              이것은 기본 모달입니다.{'\n'}
              오른쪽 상단 X 버튼이나 배경을 클릭하면 닫힙니다.
            </Text>
          </Modal>

          {/* Modal with Form */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            Form Modal
          </Text>
          <Button variant="secondary" onPress={() => setFormModalVisible(true)} className="mb-4">
            폼 모달 열기
          </Button>

          <Modal
            visible={formModalVisible}
            onClose={() => setFormModalVisible(false)}
            title="피드백 작성"
            size="md"
            footer={
              <View className="flex-row gap-3">
                <Button
                  variant="outline"
                  onPress={() => setFormModalVisible(false)}
                  className="flex-1"
                >
                  취소
                </Button>
                <Button
                  onPress={() => {
                    Alert.alert('저장됨', `피드백: ${modalInput}`);
                    setModalInput('');
                    setFormModalVisible(false);
                  }}
                  className="flex-1"
                >
                  저장
                </Button>
              </View>
            }
          >
            <Input
              label="피드백"
              placeholder="학생에게 피드백을 작성하세요"
              value={modalInput}
              onChangeText={setModalInput}
              multiline
              numberOfLines={4}
            />
          </Modal>

          {/* Confirm Modal */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            Confirm Modal
          </Text>
          <Button variant="outline" onPress={() => setConfirmModalVisible(true)} className="mb-4">
            확인 모달 열기
          </Button>

          <ConfirmModal
            visible={confirmModalVisible}
            onClose={() => setConfirmModalVisible(false)}
            title="확인"
            message="이 작업을 진행하시겠습니까?"
            confirmText="진행"
            cancelText="취소"
            onConfirm={() => {
              setConfirmModalVisible(false);
              Alert.alert('확인됨', '작업이 진행됩니다.');
            }}
          />

          {/* Delete Confirm Modal */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            Delete Confirm (Loading)
          </Text>
          <Button variant="danger" onPress={() => setDeleteModalVisible(true)} className="mb-4">
            삭제 모달 열기
          </Button>

          <ConfirmModal
            visible={deleteModalVisible}
            onClose={() => setDeleteModalVisible(false)}
            title="삭제 확인"
            message="정말 이 항목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
            confirmText="삭제"
            cancelText="취소"
            confirmVariant="danger"
            loading={confirmLoading}
            onConfirm={handleConfirmDelete}
          />

          {/* Modal 특징 설명 */}
          <Card variant="outlined" className="mt-4 mb-8">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Modal 특징</Text>
            <Text className="text-sm text-gray-600">• 배경 클릭 시 닫힘</Text>
            <Text className="text-sm text-gray-600">• X 버튼으로 닫힘</Text>
            <Text className="text-sm text-gray-600">• 키보드 자동 회피</Text>
            <Text className="text-sm text-gray-600">• ConfirmModal: 확인/취소 버튼 내장</Text>
            <Text className="text-sm text-gray-600">• Loading 상태 지원</Text>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Card 테스트 화면
  if (TEST_COMPONENT === 'card') {
    return (
      <SafeAreaView className="flex-1 bg-gray-100">
        <ScrollView className="flex-1 px-4">
          <Text className="text-2xl font-bold text-gray-900 mt-4 mb-6">
            Card 컴포넌트 테스트
          </Text>

          {/* 3가지 Variant 비교 */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            3가지 Variant 비교
          </Text>

          <View className="flex-row gap-2 mb-6">
            {/* Default */}
            <View className="flex-1">
              <Card className="h-24 items-center justify-center">
                <Text className="text-sm font-bold text-gray-900">Default</Text>
                <Text className="text-xs text-gray-500 mt-1">배경만</Text>
              </Card>
              <Text className="text-xs text-center text-gray-400 mt-1">그림자 ✗</Text>
              <Text className="text-xs text-center text-gray-400">테두리 ✗</Text>
            </View>

            {/* Elevated */}
            <View className="flex-1">
              <Card variant="elevated" className="h-24 items-center justify-center">
                <Text className="text-sm font-bold text-gray-900">Elevated</Text>
                <Text className="text-xs text-gray-500 mt-1">그림자</Text>
              </Card>
              <Text className="text-xs text-center text-gray-400 mt-1">그림자 ✓</Text>
              <Text className="text-xs text-center text-gray-400">테두리 ✗</Text>
            </View>

            {/* Outlined */}
            <View className="flex-1">
              <Card variant="outlined" className="h-24 items-center justify-center">
                <Text className="text-sm font-bold text-gray-900">Outlined</Text>
                <Text className="text-xs text-gray-500 mt-1">테두리</Text>
              </Card>
              <Text className="text-xs text-center text-gray-400 mt-1">그림자 ✗</Text>
              <Text className="text-xs text-center text-gray-400">테두리 ✓</Text>
            </View>
          </View>

          {/* 그림자 확인 (큰 카드) */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            Elevated 그림자 확인
          </Text>
          <Card variant="elevated" className="mb-6 p-6">
            <Text className="text-base text-gray-900 font-medium">그림자가 있는 카드</Text>
            <Text className="text-sm text-gray-500 mt-2">
              카드 주변을 잘 보세요.{'\n'}
              아래쪽과 오른쪽에 그림자가 보입니다.{'\n'}
              (Android에서는 elevation으로 표시)
            </Text>
          </Card>

          {/* 테두리 확인 (큰 카드) */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            Outlined 테두리 확인
          </Text>
          <Card variant="outlined" className="mb-6 p-6">
            <Text className="text-base text-gray-900 font-medium">테두리가 있는 카드</Text>
            <Text className="text-sm text-gray-500 mt-2">
              카드 가장자리를 보세요.{'\n'}
              얇은 회색 테두리(border)가 있습니다.
            </Text>
          </Card>

          {/* Pressable Card */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            Pressable Card (클릭 가능)
          </Text>
          <PressableCard
            variant="elevated"
            className="mb-4"
            onPress={() => Alert.alert('카드 클릭', '클릭 가능한 카드입니다!')}
          >
            <View className="flex-row items-center">
              <View className="w-12 h-12 bg-primary rounded-full items-center justify-center">
                <Ionicons name="person" size={24} color="white" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-base font-semibold text-gray-900">홍길동</Text>
                <Text className="text-sm text-gray-500">학생 • 연습 12회</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </View>
          </PressableCard>

          {/* Card with Sub-components */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            Card with Header/Content/Footer
          </Text>
          <Card variant="elevated" className="mb-4">
            <CardHeader>
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-bold text-gray-900">스크립트 제목</Text>
                <View className="bg-green-100 px-2 py-1 rounded">
                  <Text className="text-xs text-green-700 font-medium">완료</Text>
                </View>
              </View>
            </CardHeader>
            <CardContent>
              <Text className="text-sm text-gray-600">
                자기소개 - Describe yourself{'\n'}
                This is my practice script content...
              </Text>
            </CardContent>
            <CardFooter>
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-gray-400">2024.02.04</Text>
                <Button size="sm" onPress={() => Alert.alert('연습 시작')}>
                  연습하기
                </Button>
              </View>
            </CardFooter>
          </Card>

          {/* List Example */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            카드 리스트 예시
          </Text>
          {[1, 2, 3].map((i) => (
            <PressableCard
              key={i}
              variant="outlined"
              className="mb-3"
              onPress={() => Alert.alert(`카드 ${i} 클릭`)}
            >
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-gray-200 rounded-lg items-center justify-center">
                  <Ionicons name="document-text" size={20} color="#6B7280" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base font-medium text-gray-900">연습 기록 #{i}</Text>
                  <Text className="text-sm text-gray-500">85점 • 재현율 92%</Text>
                </View>
              </View>
            </PressableCard>
          ))}

          <View className="h-8" />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Input 테스트 화면
  if (TEST_COMPONENT === 'input') {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView className="flex-1 px-4">
          <Text className="text-2xl font-bold text-gray-900 mt-4 mb-6">
            Input 컴포넌트 테스트
          </Text>

          {/* Basic Input */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            Basic Input
          </Text>
          <Input
            label="이름"
            placeholder="이름을 입력하세요"
            value={name}
            onChangeText={setName}
          />

          {/* With Error */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            With Validation
          </Text>
          <Input
            label="이메일"
            placeholder="example@email.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setEmailError('');
            }}
            error={emailError}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Button size="sm" onPress={validateEmail} className="mb-4">
            이메일 검증
          </Button>

          {/* Password Input */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            Password Input
          </Text>
          <Input
            label="비밀번호"
            placeholder="비밀번호 입력"
            value={password}
            onChangeText={setPassword}
            isPassword
          />

          {/* With Hint */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            With Hint
          </Text>
          <Input
            label="초대 코드"
            placeholder="6자리 코드"
            hint="강사에게 받은 초대 코드를 입력하세요"
            maxLength={6}
            autoCapitalize="characters"
          />

          {/* With Icons */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            With Icons
          </Text>
          <Input
            label="검색"
            placeholder="검색어 입력"
            leftIcon={<Ionicons name="search" size={20} color="#9CA3AF" />}
          />
          <Input
            label="이메일 (아이콘)"
            placeholder="이메일 입력"
            leftIcon={<Ionicons name="mail-outline" size={20} color="#9CA3AF" />}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Disabled */}
          <Text className="text-lg font-semibold text-gray-700 mb-3">
            Disabled
          </Text>
          <Input
            label="비활성화"
            placeholder="입력 불가"
            value="비활성화된 입력"
            disabled
          />

          {/* Current Values */}
          <Text className="text-lg font-semibold text-gray-700 mt-4 mb-3">
            입력된 값 확인
          </Text>
          <View className="bg-gray-100 p-4 rounded-lg mb-8">
            <Text className="text-sm text-gray-600">이름: {name || '(없음)'}</Text>
            <Text className="text-sm text-gray-600">이메일: {email || '(없음)'}</Text>
            <Text className="text-sm text-gray-600">비밀번호: {password ? '●'.repeat(password.length) : '(없음)'}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Button 테스트 화면 (기본)
  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-4">
        <Text className="text-2xl font-bold text-gray-900 mt-4 mb-6">
          Button 컴포넌트 테스트
        </Text>

        {/* Variants */}
        <Text className="text-lg font-semibold text-gray-700 mb-3">
          Variants
        </Text>
        <View className="gap-3 mb-6">
          <Button variant="primary" onPress={() => handlePress('Primary')}>
            Primary Button
          </Button>
          <Button variant="secondary" onPress={() => handlePress('Secondary')}>
            Secondary Button
          </Button>
          <Button variant="outline" onPress={() => handlePress('Outline')}>
            Outline Button
          </Button>
          <Button variant="ghost" onPress={() => handlePress('Ghost')}>
            Ghost Button
          </Button>
          <Button variant="danger" onPress={() => handlePress('Danger')}>
            Danger Button
          </Button>
        </View>

        {/* Sizes */}
        <Text className="text-lg font-semibold text-gray-700 mb-3">
          Sizes
        </Text>
        <View className="gap-3 mb-6">
          <Button size="sm" onPress={() => handlePress('Small')}>
            Small
          </Button>
          <Button size="md" onPress={() => handlePress('Medium')}>
            Medium (Default)
          </Button>
          <Button size="lg" onPress={() => handlePress('Large')}>
            Large
          </Button>
        </View>

        {/* With Icons */}
        <Text className="text-lg font-semibold text-gray-700 mb-3">
          With Icons
        </Text>
        <View className="gap-3 mb-6">
          <Button
            leftIcon={<Ionicons name="add" size={20} color="white" />}
            onPress={() => handlePress('Left Icon')}
          >
            Left Icon
          </Button>
          <Button
            rightIcon={<Ionicons name="arrow-forward" size={20} color="white" />}
            onPress={() => handlePress('Right Icon')}
          >
            Right Icon
          </Button>
          <Button
            variant="outline"
            leftIcon={<Ionicons name="mic" size={20} color="#3B82F6" />}
            onPress={() => handlePress('Outline with Icon')}
          >
            녹음 시작
          </Button>
        </View>

        {/* States */}
        <Text className="text-lg font-semibold text-gray-700 mb-3">
          States
        </Text>
        <View className="gap-3 mb-6">
          <Button disabled onPress={() => handlePress('Disabled')}>
            Disabled Button
          </Button>
          <Button loading onPress={() => handlePress('Loading')}>
            Loading Button
          </Button>
          <Button loading={loading} onPress={handleLoadingTest}>
            {loading ? '처리 중...' : '로딩 테스트 (2초)'}
          </Button>
        </View>

        {/* Full Width */}
        <Text className="text-lg font-semibold text-gray-700 mb-3">
          Full Width
        </Text>
        <View className="gap-3 mb-6">
          <Button fullWidth onPress={() => handlePress('Full Width')}>
            Full Width Button
          </Button>
          <Button fullWidth variant="outline" onPress={() => handlePress('Full Width Outline')}>
            Full Width Outline
          </Button>
        </View>

        {/* Custom Style */}
        <Text className="text-lg font-semibold text-gray-700 mb-3">
          Custom className
        </Text>
        <View className="gap-3 mb-8">
          <Button
            className="bg-purple-500"
            onPress={() => handlePress('Custom')}
          >
            Custom Purple
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
