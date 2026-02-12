import { View, Text, ActivityIndicator } from 'react-native';

import { COLORS } from '@/lib/constants';
import { STRINGS } from '@/lib/strings';

export type LoadingSize = 'small' | 'large';

export interface LoadingSpinnerProps {
  size?: LoadingSize;
  color?: string;
  className?: string;
}

export interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  className?: string;
}

export interface LoadingScreenProps {
  message?: string;
  className?: string;
}

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  className?: string;
}

// Simple spinner
export function LoadingSpinner({
  size = 'large',
  color = COLORS.PRIMARY,
  className = '',
}: LoadingSpinnerProps) {
  return (
    <View className={`items-center justify-center ${className}`}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}

// Full screen loading overlay
export function LoadingOverlay({
  visible,
  message,
  className = '',
}: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <View
      className={`absolute inset-0 bg-black/30 items-center justify-center z-50 ${className}`}
    >
      <View className="bg-white rounded-2xl px-8 py-6 items-center shadow-lg">
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        {message && (
          <Text className="text-base text-gray-700 mt-3">{message}</Text>
        )}
      </View>
    </View>
  );
}

// Full screen loading (for initial loads)
export function LoadingScreen({
  message = STRINGS.common.loading,
  className = '',
}: LoadingScreenProps) {
  return (
    <View className={`flex-1 items-center justify-center bg-white ${className}`}>
      <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      <Text className="text-base text-gray-500 mt-4">{message}</Text>
    </View>
  );
}

// Skeleton placeholder for loading states
export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 4,
  className = '',
}: SkeletonProps) {
  const widthStyle = typeof width === 'number' ? { width } : {};
  const heightStyle = typeof height === 'number' ? { height } : {};

  return (
    <View
      className={`bg-gray-200 animate-pulse ${className}`}
      style={[
        widthStyle,
        heightStyle,
        { borderRadius },
        typeof width === 'string' ? { width: width as any } : {},
        typeof height === 'string' ? { height: height as any } : {},
      ]}
    />
  );
}

// Skeleton group for common patterns
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <View className={`bg-white rounded-xl p-4 ${className}`}>
      <View className="flex-row items-center mb-3">
        <Skeleton width={40} height={40} borderRadius={20} />
        <View className="ml-3 flex-1">
          <Skeleton width="60%" height={16} className="mb-2" />
          <Skeleton width="40%" height={12} />
        </View>
      </View>
      <Skeleton width="100%" height={14} className="mb-2" />
      <Skeleton width="80%" height={14} />
    </View>
  );
}

export function SkeletonList({
  count = 3,
  className = '',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <View className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} className="mb-3" />
      ))}
    </View>
  );
}

export default LoadingSpinner;
