import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import { COLORS } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface SettingsRowProps {
  icon: IoniconsName;
  label: string;
  value?: string;
}

function SettingsRow({ icon, label, value }: SettingsRowProps) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={COLORS.GRAY_500} />
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value && <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>}
      </View>
    </View>
  );
}

export default function StudentSettings() {
  const { user, signOut, currentOrg } = useAuth();
  const appVersion = Constants.expoConfig?.version || '1.0.0';

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
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 계정 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>계정</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="person-outline"
            label="이름"
            value={user?.name || '-'}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="mail-outline"
            label="이메일"
            value={user?.email || '-'}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="school-outline"
            label="역할"
            value="학생"
          />
          {currentOrg && (
            <>
              <View style={styles.divider} />
              <SettingsRow
                icon="business-outline"
                label="소속 학원"
                value={currentOrg.name}
              />
            </>
          )}
        </View>
      </View>

      {/* 앱 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>앱</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="information-circle-outline"
            label="앱 정보"
            value={`v${appVersion}`}
          />
        </View>
      </View>

      {/* 로그아웃 */}
      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.ERROR} />
        <Text style={styles.logoutText}>로그아웃</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
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
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
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
    color: COLORS.TEXT_PRIMARY,
  },
  rowValue: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    maxWidth: '60%',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.GRAY_100,
    marginHorizontal: 14,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: COLORS.ERROR + '10',
    borderRadius: 12,
    gap: 8,
  },
  logoutText: {
    color: COLORS.ERROR,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
  },
});
