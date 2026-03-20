import { View, Text, StyleSheet, Pressable, Modal, Platform } from 'react-native';
import { Component, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { getInviteLink } from '@/services/invites';

// react-native-qrcode-svg가 웹에서 실패할 수 있으므로 동적 import
let QRCode: any = null;
try {
  QRCode = require('react-native-qrcode-svg').default;
} catch {
  // 웹에서 로드 실패 시 null
}

/** QR 렌더링 에러 바운더리 */
class QRErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

interface InviteQRModalProps {
  visible: boolean;
  code: string;
  className?: string | null;
  onClose: () => void;
}

/**
 * InviteQRModal - 초대 코드 QR 코드 모달
 *
 * QR 코드에 초대 링크(https://speaky.co.kr/join/CODE)를 인코딩하여 표시.
 * 학생이 스캔하면 바로 가입 플로우로 진입.
 */
export function InviteQRModal({ visible, code, className, onClose }: InviteQRModalProps) {
  const colors = useThemeColors();
  const inviteLink = getInviteLink(code);

  const qrFallback = (
    <View style={[styles.qrFallback, { borderColor: colors.border }]}>
      <Ionicons name="qr-code-outline" size={80} color={colors.textDisabled} />
      <Text style={[styles.qrFallbackText, { color: colors.textSecondary }]}>
        QR 코드를 표시할 수 없습니다
      </Text>
    </View>
  );

  // 웹: Modal 대신 직접 오버레이 렌더링 (RNW Modal z-index 이슈 방지)
  if (Platform.OS === 'web') {
    if (!visible) return null;

    return (
      <View style={styles.webOverlay}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={[styles.content, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            {renderModalContent(colors, code, className, inviteLink, onClose, qrFallback)}
          </Pressable>
        </Pressable>
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.content, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          {renderModalContent(colors, code, className, inviteLink, onClose, qrFallback)}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function renderModalContent(
  colors: any,
  code: string,
  className: string | null | undefined,
  inviteLink: string,
  onClose: () => void,
  qrFallback: ReactNode,
) {
  return (
    <>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>초대 QR 코드</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      {className && (
        <View style={[styles.classBadge, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="school-outline" size={14} color={colors.primary} />
          <Text style={[styles.classBadgeText, { color: colors.primary }]}>{className}</Text>
        </View>
      )}

      <View style={styles.qrContainer}>
        {QRCode ? (
          <QRErrorBoundary fallback={qrFallback}>
            <QRCode
              value={inviteLink}
              size={200}
              backgroundColor="white"
              color="black"
            />
          </QRErrorBoundary>
        ) : (
          qrFallback
        )}
      </View>

      <Text style={[styles.codeText, { color: colors.primary }]}>{code}</Text>
      <Text style={[styles.linkText, { color: colors.textSecondary }]}>{inviteLink}</Text>

      <Text style={[styles.hint, { color: colors.textDisabled }]}>
        학생이 이 QR 코드를 스캔하면{'\n'}자동으로 가입 화면으로 이동합니다.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  webOverlay: {
    position: 'absolute' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Pretendard-Bold',
  },
  classBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 16,
  },
  classBadgeText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
  },
  qrContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
  },
  codeText: {
    fontSize: 24,
    fontFamily: 'Pretendard-Bold',
    letterSpacing: 4,
    marginBottom: 4,
  },
  linkText: {
    fontSize: 12,
    marginBottom: 16,
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  qrFallback: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  qrFallbackText: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
});
