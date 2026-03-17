import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { Modal } from './Modal';
import { Button } from './Button';

interface VoiceConsentModalProps {
  visible: boolean;
  onAgree: () => void;
  onDecline: () => void;
  loading?: boolean;
}

/**
 * 음성 녹음 동의 모달
 * - 첫 녹음 시작 전 표시
 * - 동의 시 user_consents.voice_data_agreed = true 업데이트 (훅에서 처리)
 * - 거부 시 녹음 차단
 */
export function VoiceConsentModal({ visible, onAgree, onDecline, loading = false }: VoiceConsentModalProps) {
  const colors = useThemeColors();

  return (
    <Modal
      visible={visible}
      onClose={onDecline}
      title="음성 녹음 동의"
      showCloseButton={false}
      closeOnBackdrop={!loading}
      size="md"
      footer={
        <View style={styles.footer}>
          <View style={styles.buttonWrapper}>
            <Button variant="outline" onPress={onDecline} disabled={loading} fullWidth>
              거부
            </Button>
          </View>
          <View style={styles.buttonWrapper}>
            <Button variant="primary" onPress={onAgree} loading={loading} fullWidth>
              동의
            </Button>
          </View>
        </View>
      }
    >
      <View style={styles.iconRow}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name="mic" size={32} color={colors.primary} />
        </View>
      </View>

      <Text style={[styles.description, { color: colors.textPrimary }]}>
        이 기능은 음성 녹음을 사용합니다.
      </Text>

      <View style={[styles.infoBox, { backgroundColor: colors.surfaceSecondary }]}>
        <View style={styles.infoItem}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            녹음된 음성은 학습 분석 목적으로만 사용됩니다.
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            음성 데이터는 안전하게 암호화되어 저장됩니다.
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="trash-outline" size={18} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            설정에서 언제든지 데이터 삭제를 요청할 수 있습니다.
          </Text>
        </View>
      </View>

      <Text style={[styles.note, { color: colors.textDisabled }]}>
        동의하지 않으면 녹음 기능을 사용할 수 없습니다. 동의는 언제든지 철회할 수 있습니다.
      </Text>
    </Modal>
  );
}
const styles = StyleSheet.create({
  iconRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  infoBox: {
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  note: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonWrapper: {
    flex: 1,
  },
});
