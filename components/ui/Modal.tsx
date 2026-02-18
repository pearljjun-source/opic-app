import { forwardRef } from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ModalProps as RNModalProps,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { useThemeColors } from '@/hooks/useTheme';
import { Button } from './Button';

// ============================================================================
// Types
// ============================================================================

export interface ModalProps extends Omit<RNModalProps, 'children'> {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'full';
  /** Footer 영역 (버튼 등) - 스크롤 영역 밖에 고정 */
  footer?: React.ReactNode;
  /** 내용이 길 때 스크롤 허용 */
  scrollable?: boolean;
}

export interface ConfirmModalProps extends Omit<ModalProps, 'children' | 'footer'> {
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmVariant?: 'primary' | 'danger';
  loading?: boolean;
}

// ============================================================================
// Size Configuration
// ============================================================================

type ModalSize = 'sm' | 'md' | 'lg' | 'full';

interface SizeConfig {
  widthRatio: number;
  maxWidth: number;
  maxHeightRatio: number;
}

const SIZE_CONFIG: Record<ModalSize, SizeConfig> = {
  sm: { widthRatio: 0.8, maxWidth: 320, maxHeightRatio: 0.6 },
  md: { widthRatio: 0.9, maxWidth: 400, maxHeightRatio: 0.75 },
  lg: { widthRatio: 0.95, maxWidth: 500, maxHeightRatio: 0.85 },
  full: { widthRatio: 1, maxWidth: 9999, maxHeightRatio: 1 },
};

// ============================================================================
// Modal Component
// ============================================================================

export const Modal = forwardRef<View, ModalProps>(
  (
    {
      visible,
      onClose,
      title,
      children,
      showCloseButton = true,
      closeOnBackdrop = true,
      size = 'md',
      footer,
      scrollable = true,
      ...props
    },
    ref
  ) => {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const config = SIZE_CONFIG[size];
    const colors = useThemeColors();

    // 반응형 크기 계산
    const modalWidth = Math.min(screenWidth * config.widthRatio, config.maxWidth);
    const modalMaxHeight = screenHeight * config.maxHeightRatio;

    const handleBackdropPress = () => {
      if (closeOnBackdrop) {
        onClose();
      }
    };

    const isFullScreen = size === 'full';

    return (
      <RNModal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
        statusBarTranslucent
        {...props}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
            <Pressable
              ref={ref}
              style={[
                styles.modalContainer,
                {
                  backgroundColor: colors.surface,
                  width: isFullScreen ? '100%' : modalWidth,
                  maxHeight: isFullScreen ? '100%' : modalMaxHeight,
                  borderRadius: isFullScreen ? 0 : 16,
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              {/* ========== Header (고정) ========== */}
              {(title || showCloseButton) && (
                <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
                  <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {title || ''}
                  </Text>
                  {showCloseButton && (
                    <TouchableOpacity
                      onPress={onClose}
                      style={styles.closeButton}
                      accessibilityLabel="닫기"
                      accessibilityRole="button"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* ========== Content (스크롤 가능) ========== */}
              {scrollable ? (
                <ScrollView
                  style={styles.scrollContent}
                  contentContainerStyle={styles.scrollContentContainer}
                  showsVerticalScrollIndicator={true}
                  bounces={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {children}
                </ScrollView>
              ) : (
                <View style={styles.content}>{children}</View>
              )}

              {/* ========== Footer (고정) ========== */}
              {footer && <View style={[styles.footer, { borderTopColor: colors.borderLight }]}>{footer}</View>}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </RNModal>
    );
  }
);

Modal.displayName = 'Modal';

// ============================================================================
// ConfirmModal Component
// ============================================================================

export const ConfirmModal = forwardRef<View, ConfirmModalProps>(
  (
    {
      visible,
      onClose,
      title = '확인',
      message,
      confirmText = '확인',
      cancelText = '취소',
      onConfirm,
      onCancel,
      confirmVariant = 'primary',
      loading = false,
      size = 'sm',
      ...props
    },
    ref
  ) => {
    const colors = useThemeColors();
    const handleCancel = () => {
      if (loading) return;
      onCancel?.();
      onClose();
    };

    const handleConfirm = () => {
      onConfirm();
    };

    // Footer에 버튼 배치 (스크롤 영역 밖 고정)
    const footerButtons = (
      <View style={styles.confirmFooter}>
        <View style={styles.confirmButtonWrapper}>
          <Button
            variant="outline"
            onPress={handleCancel}
            disabled={loading}
            fullWidth
          >
            {cancelText}
          </Button>
        </View>
        <View style={styles.confirmButtonWrapper}>
          <Button
            variant={confirmVariant}
            onPress={handleConfirm}
            loading={loading}
            fullWidth
          >
            {confirmText}
          </Button>
        </View>
      </View>
    );

    return (
      <Modal
        ref={ref}
        visible={visible}
        onClose={onClose}
        title={title}
        size={size}
        showCloseButton={false}
        closeOnBackdrop={!loading}
        footer={footerButtons}
        scrollable={false}
        {...props}
      >
        <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>{message}</Text>
      </Modal>
    );
  }
);

ConfirmModal.displayName = 'ConfirmModal';

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    overflow: 'hidden', // borderRadius 적용을 위해 필요
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    minHeight: 52,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Pretendard-Bold',
    flex: 1,
    marginRight: 8,
  },
  closeButton: {
    padding: 4,
    marginRight: -4,
  },
  // Content
  scrollContent: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContentContainer: {
    padding: 16,
  },
  content: {
    padding: 16,
  },
  // Footer
  footer: {
    borderTopWidth: 1,
    padding: 16,
  },
  // ConfirmModal specific
  confirmMessage: {
    fontSize: 16,
    lineHeight: 24,
  },
  confirmFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButtonWrapper: {
    flex: 1,
  },
});

export default Modal;
