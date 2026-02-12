import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';

export default function TeacherSettings() {
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
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
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>계정 정보</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={20} color={COLORS.GRAY_500} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>이름</Text>
              <Text style={styles.infoValue}>{user?.name || '-'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={COLORS.GRAY_500} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>이메일</Text>
              <Text style={styles.infoValue}>{user?.email || '-'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.GRAY_500} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>역할</Text>
              <Text style={styles.infoValue}>강사</Text>
            </View>
          </View>
        </View>
      </View>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.ERROR} />
        <Text style={styles.logoutText}>로그아웃</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.GRAY_400,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: 'Pretendard-Medium',
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
