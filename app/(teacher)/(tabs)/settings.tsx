import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import { COLORS, ORG_ROLE_LABELS } from '@/lib/constants';
import { useThemeColors, useThemeControl, loadThemePreference, ThemePreference } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { canManageOrg } from '@/lib/permissions';

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

  useEffect(() => {
    loadThemePreference().then(setThemePref);
  }, []);

  const handleThemeChange = async (pref: ThemePreference) => {
    setThemePref(pref);
    await setThemePreference(pref);
  };

  const handleLogout = () => {
    Alert.alert(
      '로그아웃',
      '정말 로그아웃하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
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
              onPress={() => router.push('/(teacher)/settings/academy-info')}
              showChevron
            />
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <SettingsRow
              icon="people-outline"
              label="강사 관리"
              onPress={() => router.push('/(teacher)/settings/teacher-management')}
              showChevron
            />
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <SettingsRow
              icon="card-outline"
              label="구독 정보"
              onPress={() => router.push('/(teacher)/settings/subscription')}
              showChevron
            />
          </View>
        </View>
      )}

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
});
