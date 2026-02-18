import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { Button, ButtonVariant } from './Button';

// ============================================================================
// Types
// ============================================================================

export type EmptyStateSize = 'sm' | 'md' | 'lg';

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionVariant?: ButtonVariant;
  onAction?: () => void;
  /** 크기: sm(작은 영역), md(일반), lg(전체 화면) */
  size?: EmptyStateSize;
  /** flex-1 적용 여부 (전체 화면 채우기) */
  fillSpace?: boolean;
  className?: string;
}

// ============================================================================
// Size Configuration
// ============================================================================

interface SizeConfig {
  iconContainerSize: number;
  iconSize: number;
  titleSize: number;
  descriptionSize: number;
  paddingVertical: number;
  paddingHorizontal: number;
  gap: number;
}

const SIZE_CONFIG: Record<EmptyStateSize, SizeConfig> = {
  sm: {
    iconContainerSize: 48,
    iconSize: 24,
    titleSize: 14,
    descriptionSize: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 8,
  },
  md: {
    iconContainerSize: 64,
    iconSize: 32,
    titleSize: 16,
    descriptionSize: 14,
    paddingVertical: 24,
    paddingHorizontal: 24,
    gap: 12,
  },
  lg: {
    iconContainerSize: 80,
    iconSize: 40,
    titleSize: 18,
    descriptionSize: 16,
    paddingVertical: 32,
    paddingHorizontal: 32,
    gap: 16,
  },
};

// ============================================================================
// EmptyState Component
// ============================================================================

export function EmptyState({
  icon = 'folder-open-outline',
  iconColor,
  title,
  description,
  actionLabel,
  actionVariant = 'primary',
  onAction,
  size = 'md',
  fillSpace = false,
  className = '',
}: EmptyStateProps) {
  const config = SIZE_CONFIG[size];
  const colors = useThemeColors();
  const resolvedIconColor = iconColor ?? colors.textDisabled;

  return (
    <View
      style={[
        styles.container,
        {
          paddingVertical: config.paddingVertical,
          paddingHorizontal: config.paddingHorizontal,
        },
        fillSpace && styles.fillSpace,
      ]}
    >
      {/* Icon */}
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: colors.surfaceSecondary,
            width: config.iconContainerSize,
            height: config.iconContainerSize,
            borderRadius: config.iconContainerSize / 2,
          },
        ]}
      >
        <Ionicons name={icon} size={config.iconSize} color={resolvedIconColor} />
      </View>

      {/* Title */}
      <Text
        style={[
          styles.title,
          {
            color: colors.textPrimary,
            fontSize: config.titleSize,
            marginTop: config.gap,
          },
        ]}
      >
        {title}
      </Text>

      {/* Description */}
      {description && (
        <Text
          style={[
            styles.description,
            {
              color: colors.textSecondary,
              fontSize: config.descriptionSize,
              marginTop: config.gap / 2,
            },
          ]}
        >
          {description}
        </Text>
      )}

      {/* Action Button */}
      {actionLabel && onAction && (
        <View style={{ marginTop: config.gap * 1.5 }}>
          <Button
            variant={actionVariant}
            size={size === 'sm' ? 'sm' : 'md'}
            onPress={onAction}
          >
            {actionLabel}
          </Button>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fillSpace: {
    flex: 1,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Pretendard-Bold',
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    lineHeight: 20,
  },
});

// ============================================================================
// Pre-configured Empty States
// ============================================================================

export function NoDataState({
  title = '데이터가 없습니다',
  description,
  onAction,
  actionLabel,
  size = 'md',
  fillSpace = false,
}: Partial<EmptyStateProps>) {
  return (
    <EmptyState
      icon="document-text-outline"
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
      size={size}
      fillSpace={fillSpace}
    />
  );
}

export function NoSearchResultState({
  title = '검색 결과가 없습니다',
  description = '다른 검색어로 시도해보세요',
  size = 'md',
  fillSpace = false,
}: Partial<EmptyStateProps>) {
  return (
    <EmptyState
      icon="search-outline"
      title={title}
      description={description}
      size={size}
      fillSpace={fillSpace}
    />
  );
}

export function NoConnectionState({
  title = '연결된 강사가 없습니다',
  description = '강사의 초대 코드를 입력하여 연결하세요',
  actionLabel = '초대 코드 입력',
  onAction,
  size = 'md',
  fillSpace = false,
}: Partial<EmptyStateProps>) {
  return (
    <EmptyState
      icon="people-outline"
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
      size={size}
      fillSpace={fillSpace}
    />
  );
}

export function NoStudentsState({
  title = '연결된 학생이 없습니다',
  description = '초대 코드를 생성하여 학생을 초대하세요',
  actionLabel = '초대 코드 생성',
  onAction,
  size = 'md',
  fillSpace = false,
}: Partial<EmptyStateProps>) {
  return (
    <EmptyState
      icon="school-outline"
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
      size={size}
      fillSpace={fillSpace}
    />
  );
}

export function NoScriptsState({
  title = '스크립트가 없습니다',
  description = '새 스크립트를 작성해보세요',
  actionLabel,
  onAction,
  size = 'md',
  fillSpace = false,
}: Partial<EmptyStateProps>) {
  return (
    <EmptyState
      icon="create-outline"
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
      size={size}
      fillSpace={fillSpace}
    />
  );
}

export function NoPracticesState({
  title = '연습 기록이 없습니다',
  description = '스크립트를 선택하여 연습을 시작해보세요',
  actionLabel,
  onAction,
  size = 'md',
  fillSpace = false,
}: Partial<EmptyStateProps>) {
  return (
    <EmptyState
      icon="mic-outline"
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
      size={size}
      fillSpace={fillSpace}
    />
  );
}

export function ErrorState({
  title = '오류가 발생했습니다',
  description = '잠시 후 다시 시도해주세요',
  actionLabel = '다시 시도',
  onAction,
  size = 'md',
  fillSpace = false,
}: Partial<EmptyStateProps>) {
  const colors = useThemeColors();
  return (
    <EmptyState
      icon="alert-circle-outline"
      iconColor={colors.error}
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
      size={size}
      fillSpace={fillSpace}
    />
  );
}

export function OfflineState({
  title = '오프라인 상태입니다',
  description = '인터넷 연결을 확인해주세요',
  actionLabel = '다시 시도',
  onAction,
  size = 'md',
  fillSpace = false,
}: Partial<EmptyStateProps>) {
  const colors = useThemeColors();
  return (
    <EmptyState
      icon="cloud-offline-outline"
      iconColor={colors.warning}
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
      size={size}
      fillSpace={fillSpace}
    />
  );
}

export default EmptyState;
