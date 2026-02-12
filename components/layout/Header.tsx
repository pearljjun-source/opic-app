import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { useSafeInsets } from './SafeAreaView';

export interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  leftComponent?: React.ReactNode;
  rightComponent?: React.ReactNode;
  transparent?: boolean;
  className?: string;
}

export function Header({
  title,
  showBack = false,
  onBack,
  leftComponent,
  rightComponent,
  transparent = false,
  className = '',
}: HeaderProps) {
  const router = useRouter();
  const insets = useSafeInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  const containerClasses = [
    'flex-row items-center justify-between px-4 py-3',
    transparent ? '' : 'bg-white border-b border-gray-100',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View className={containerClasses}>
      {/* Left */}
      <View className="flex-row items-center min-w-[60px]">
        {showBack && (
          <TouchableOpacity
            onPress={handleBack}
            className="p-1 -ml-1 mr-2"
            accessibilityLabel="뒤로 가기"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={28} color={COLORS.GRAY_900} />
          </TouchableOpacity>
        )}
        {leftComponent}
      </View>

      {/* Center */}
      <View className="flex-1 items-center">
        {title && (
          <Text
            className="text-lg font-bold text-gray-900"
            numberOfLines={1}
          >
            {title}
          </Text>
        )}
      </View>

      {/* Right */}
      <View className="flex-row items-center justify-end min-w-[60px]">
        {rightComponent}
      </View>
    </View>
  );
}

// Simple header with just a title (no navigation)
export function SimpleHeader({
  title,
  rightComponent,
  className = '',
}: {
  title: string;
  rightComponent?: React.ReactNode;
  className?: string;
}) {
  return (
    <View
      className={`flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100 ${className}`}
    >
      <Text className="text-xl font-bold text-gray-900">{title}</Text>
      {rightComponent}
    </View>
  );
}

// Header with large title (for main screens)
export function LargeHeader({
  title,
  subtitle,
  rightComponent,
  className = '',
}: {
  title: string;
  subtitle?: string;
  rightComponent?: React.ReactNode;
  className?: string;
}) {
  return (
    <View className={`px-4 py-4 bg-white ${className}`}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-2xl font-bold text-gray-900">{title}</Text>
          {subtitle && (
            <Text className="text-base text-gray-500 mt-1">{subtitle}</Text>
          )}
        </View>
        {rightComponent}
      </View>
    </View>
  );
}

// Header button helper
export function HeaderButton({
  icon,
  onPress,
  badge,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  badge?: number;
  accessibilityLabel: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="p-2 relative"
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={24} color={COLORS.GRAY_700} />
      {badge !== undefined && badge > 0 && (
        <View className="absolute -top-0.5 -right-0.5 bg-error rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
          <Text className="text-white text-xs font-bold">
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default Header;
