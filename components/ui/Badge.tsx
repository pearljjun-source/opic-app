import { View, Text } from 'react-native';

export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { container: string; text: string }> = {
  default: {
    container: 'bg-gray-100 dark:bg-neutral-800',
    text: 'text-gray-700 dark:text-gray-300',
  },
  primary: {
    container: 'bg-blue-100 dark:bg-blue-900',
    text: 'text-blue-700 dark:text-blue-300',
  },
  secondary: {
    container: 'bg-green-100 dark:bg-green-900',
    text: 'text-green-700 dark:text-green-300',
  },
  success: {
    container: 'bg-green-100 dark:bg-green-900',
    text: 'text-green-700 dark:text-green-300',
  },
  warning: {
    container: 'bg-yellow-100 dark:bg-yellow-900',
    text: 'text-yellow-700 dark:text-yellow-300',
  },
  error: {
    container: 'bg-red-100 dark:bg-red-900',
    text: 'text-red-700 dark:text-red-300',
  },
  info: {
    container: 'bg-blue-100 dark:bg-blue-900',
    text: 'text-blue-700 dark:text-blue-300',
  },
};

const sizeStyles: Record<BadgeSize, { container: string; text: string }> = {
  sm: {
    container: 'px-2 py-0.5 rounded',
    text: 'text-xs',
  },
  md: {
    container: 'px-2.5 py-1 rounded-md',
    text: 'text-sm',
  },
  lg: {
    container: 'px-3 py-1.5 rounded-lg',
    text: 'text-base',
  },
};

export function Badge({
  variant = 'default',
  size = 'md',
  children,
  className = '',
}: BadgeProps) {
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  const containerClasses = [
    variantStyle.container,
    sizeStyle.container,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const textClasses = [variantStyle.text, sizeStyle.text, 'font-medium']
    .filter(Boolean)
    .join(' ');

  return (
    <View className={containerClasses}>
      <Text className={textClasses}>{children}</Text>
    </View>
  );
}

// Status-specific badges
export function StatusBadge({
  status,
  size = 'md',
}: {
  status: 'draft' | 'complete' | 'pending' | 'used' | 'expired';
  size?: BadgeSize;
}) {
  const statusConfig: Record<
    string,
    { variant: BadgeVariant; label: string }
  > = {
    draft: { variant: 'warning', label: '작성 중' },
    complete: { variant: 'success', label: '완료' },
    pending: { variant: 'info', label: '대기' },
    used: { variant: 'default', label: '사용됨' },
    expired: { variant: 'error', label: '만료' },
  };

  const config = statusConfig[status] || { variant: 'default', label: status };

  return (
    <Badge variant={config.variant} size={size}>
      {config.label}
    </Badge>
  );
}

// Score badge with color based on value
export function ScoreBadge({
  score,
  size = 'md',
}: {
  score: number;
  size?: BadgeSize;
}) {
  let variant: BadgeVariant = 'error';
  if (score >= 90) variant = 'success';
  else if (score >= 70) variant = 'primary';
  else if (score >= 50) variant = 'warning';

  return (
    <Badge variant={variant} size={size}>
      {score}점
    </Badge>
  );
}

// Difficulty level badge
export function DifficultyBadge({
  level,
  size = 'sm',
}: {
  level: number;
  size?: BadgeSize;
}) {
  let variant: BadgeVariant = 'default';
  if (level <= 2) variant = 'success';
  else if (level <= 4) variant = 'warning';
  else variant = 'error';

  return (
    <Badge variant={variant} size={size}>
      Lv.{level}
    </Badge>
  );
}

export default Badge;
