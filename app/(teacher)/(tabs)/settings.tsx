import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Linking } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import { COLORS, ORG_ROLE_LABELS } from '@/lib/constants';
import { useThemeColors, useThemeControl, loadThemePreference, ThemePreference } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { canManageOrg } from '@/lib/permissions';
import { confirm as xConfirm, alert as xAlert } from '@/lib/alert';
import { getUserMessage } from '@/lib/errors';
import { deleteAccount, checkAccountDeletable } from '@/services/account';
import { on } from '@/lib/events';
import { getUnreadCount } from '@/services/notifications';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface SettingsRowProps {
  icon: IoniconsName;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  selected?: boolean;
}

function SettingsRow({ icon, label, value, onPress, showChevron = false, selected }: SettingsRowProps) {
  const colors = useThemeColors();
  const content = (
    <View style={[styles.row, selected && { backgroundColor: colors.primaryLight }]}>
      <Ionicons name={icon} size={20} color={selected ? colors.primary : colors.textSecondary} />
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
        {value && <Text style={[styles.rowValue, { color: colors.textSecondary }]} numberOfLines={1}>{value}</Text>}
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
      )}
      {selected && (
        <Ionicons name="checkmark" size={20} color={colors.primary} />
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => pressed && [styles.rowPressed, { backgroundColor: colors.surfaceSecondary }]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

export default function TeacherSettings() {
  const { user, signOut, orgRole, currentOrg } = useAuth();
  const isOwner = canManageOrg(orgRole);
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const colors = useThemeColors();
  const { setThemePreference } = useThemeControl();
  const [themePref, setThemePref] = useState<ThemePreference>('system');
  const [isDeleting, setIsDeleting] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadThemePreference().then(setThemePref);
  }, []);

  // 웹에서 미읽은 알림 수 표시
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    getUnreadCount().then(setUnreadCount);
    const off = on('notification-changed', () => {
      getUnreadCount().then(setUnreadCount);
    });
    return off;
  }, []);

  const handleThemeChange = async (pref: ThemePreference) => {
    setThemePref(pref);
    await setThemePreference(pref);
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('정말 로그아웃하시겠습니까?')) {
        signOut();
      }
      return;
    }
    xConfirm(
      '로그아웃',
      '정말 로그아웃하시겠습니까?',
      async () => {
        await signOut();
      },
      { confirmText: '로그아웃' },
    );
  };

  /**
   * 회원 탈퇴.
   *
   * 되돌릴 수 없으므로 무엇이 지워지는지 알린 뒤 두 번 확인받는다.
   * 원장은 결제 주체이므로 활성 구독이 있으면 해지가 먼저다. 결제가 살아 있는 채로
   * 탈퇴하면 "탈퇴했는데 카드에서 돈이 나가는" 상황이 된다.
   */
  const handleDeleteAccount = async () => {
    if (isDeleting) return;

    const check = await checkAccountDeletable();

    if (!check.deletable) {
      if (check.reason === 'SUBSCRIPTION_ACTIVE') {
        xConfirm(
          '구독 해지가 먼저입니다',
          `'${check.orgName ?? '학원'}'의 구독이 아직 이용 중입니다.\n\n`
            + '구독을 해지하지 않고 탈퇴하면 결제가 계속될 수 있어, 해지 후에 탈퇴할 수 있습니다.\n\n'
            + '구독 화면으로 이동할까요?',
          () => router.push('/(teacher)/manage/subscription'),
          { confirmText: '구독 화면으로' },
        );
        return;
      }
      xAlert('탈퇴할 수 없습니다', '잠시 후 다시 시도해 주세요.');
      return;
    }

    // 원장이면 학원이 함께 닫힌다는 것을 먼저 알린다
    const ownerWarning = check.isOwner
      ? `'${check.orgName ?? '학원'}'이 함께 폐원됩니다.\n`
        + (check.memberCount > 0
          ? `소속된 강사·학생 ${check.memberCount}명이 학원 연결을 잃습니다.\n\n`
          : '\n')
      : '';

    xConfirm(
      '회원 탈퇴',
      ownerWarning
        + '탈퇴하면 아래 데이터가 모두 삭제되며 복구할 수 없습니다.\n\n'
        + '· 내가 작성한 스크립트와 피드백\n'
        + '· 담당 학생 연결 정보\n'
        + '· 발송한 메시지와 초대 코드\n\n'
        + '학생들이 보던 내 스크립트도 함께 사라집니다.',
      () => {
        xConfirm(
          '정말 탈퇴하시겠습니까?',
          '이 작업은 되돌릴 수 없습니다.',
          async () => {
            setIsDeleting(true);
            const { error } = await deleteAccount();
            setIsDeleting(false);

            if (error) {
              xAlert('탈퇴 실패', getUserMessage(error));
              return;
            }
            await signOut();
          },
          { confirmText: '탈퇴' },
        );
      },
      { confirmText: '계속' },
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.surfaceSecondary }]} contentContainerStyle={styles.contentContainer}>
      {/* 학원 관리 (owner만) */}
      {isOwner && currentOrg && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>학원 관리</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <SettingsRow
              icon="business-outline"
              label="학원 정보"
              value={currentOrg.name}
              onPress={() => router.push('/(teacher)/manage/academy-info')}
              showChevron
            />
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <SettingsRow
              icon="people-outline"
              label="강사 관리"
              onPress={() => router.push('/(teacher)/manage/teacher-management')}
              showChevron
            />
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <SettingsRow
              icon="card-outline"
              label="구독 정보"
              onPress={() => router.push('/(teacher)/manage/subscription')}
              showChevron
            />
          </View>
        </View>
      )}

      {/* 알림 (웹만) */}
      {Platform.OS === 'web' && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>알림</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <SettingsRow
              icon="notifications-outline"
              label="알림"
              value={unreadCount > 0 ? `${unreadCount}개 읽지 않음` : undefined}
              onPress={() => router.push('/(teacher)/notifications' as any)}
              showChevron
            />
          </View>
        </View>
      )}

      {/* 학습 콘텐츠 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>학습 콘텐츠</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <SettingsRow
            icon="book-outline"
            label="OPIc 핵심 표현 관리"
            onPress={() => router.push('/(teacher)/expressions' as any)}
            showChevron
          />
        </View>
      </View>

      {/* 계정 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>계정</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <SettingsRow
            icon="person-outline"
            label="이름"
            value={user?.name || '-'}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <SettingsRow
            icon="mail-outline"
            label="이메일"
            value={user?.email || '-'}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <SettingsRow
            icon="shield-checkmark-outline"
            label="역할"
            value={orgRole ? ORG_ROLE_LABELS[orgRole] : '강사'}
          />
          {currentOrg && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
              <SettingsRow
                icon="business-outline"
                label="소속 학원"
                value={currentOrg.name}
              />
            </>
          )}
        </View>
      </View>

      {/* 테마 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>테마</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <SettingsRow
            icon="phone-portrait-outline"
            label="시스템 설정"
            onPress={() => handleThemeChange('system')}
            selected={themePref === 'system'}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <SettingsRow
            icon="sunny-outline"
            label="라이트"
            onPress={() => handleThemeChange('light')}
            selected={themePref === 'light'}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <SettingsRow
            icon="moon-outline"
            label="다크"
            onPress={() => handleThemeChange('dark')}
            selected={themePref === 'dark'}
          />
        </View>
      </View>

      {/* 법적 고지 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>법적 고지</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <SettingsRow
            icon="document-text-outline"
            label="이용약관"
            onPress={() => router.push('/terms')}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <SettingsRow
            icon="shield-checkmark-outline"
            label="개인정보 처리방침"
            onPress={() => router.push('/privacy')}
          />
        </View>
      </View>

      {/* 앱 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>앱</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <SettingsRow
            icon="information-circle-outline"
            label="앱 정보"
            value={`v${appVersion}`}
          />
        </View>
      </View>

      {/* 로그아웃 */}
      <Pressable style={[styles.logoutButton, { backgroundColor: colors.error + '10' }]} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={[styles.logoutText, { color: colors.error }]}>로그아웃</Text>
      </Pressable>

      {/* 회원 탈퇴 — 개인정보처리방침 제6조가 "서비스 내 설정에서 직접 처리 가능"으로
          고지하고 있고, 앱스토어 심사도 계정 삭제 경로를 요구한다 */}
      <Pressable
        style={styles.deleteAccountButton}
        onPress={handleDeleteAccount}
        disabled={isDeleting}
        accessibilityRole="button"
        accessibilityLabel="회원 탈퇴"
        accessibilityHint="계정과 모든 데이터를 삭제합니다"
      >
        <Text style={[styles.deleteAccountText, { color: colors.textDisabled }]}>
          {isDeleting ? '탈퇴 처리 중...' : '회원 탈퇴'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 16,
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderRadius: 12,
  },
  rowPressed: {
    borderRadius: 12,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: 'Pretendard-Medium',
  },
  rowValue: {
    fontSize: 14,
    maxWidth: '60%',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    marginHorizontal: 14,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  logoutText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
  },
  deleteAccountButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    // WCAG 2.5.8 최소 터치 영역
    minHeight: 44,
    paddingHorizontal: 16,
  },
  deleteAccountText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
