import { View, Text, ActivityIndicator, Animated, StyleSheet } from 'react-native';
import { useEffect, useRef } from 'react';

import { useThemeColors } from '@/hooks/useTheme';
import { STRINGS } from '@/lib/strings';

export type LoadingSize = 'small' | 'large';

export interface LoadingSpinnerProps {
  size?: LoadingSize;
  color?: string;
}

export interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export interface LoadingScreenProps {
  message?: string;
}

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: any;
}

// Simple spinner
export function LoadingSpinner({ size = 'large', color }: LoadingSpinnerProps) {
  const colors = useThemeColors();
  return (
    <View style={skStyles.center}>
      <ActivityIndicator size={size} color={color ?? colors.primary} />
    </View>
  );
}

// Full screen loading overlay
export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  const colors = useThemeColors();
  if (!visible) return null;

  return (
    <View style={skStyles.overlay}>
      <View style={[skStyles.overlayCard, { backgroundColor: colors.surface }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        {message && (
          <Text style={[skStyles.overlayText, { color: colors.textSecondary }]}>{message}</Text>
        )}
      </View>
    </View>
  );
}

// Full screen loading (for initial loads)
export function LoadingScreen({ message = STRINGS.common.loading }: LoadingScreenProps) {
  const colors = useThemeColors();
  return (
    <View style={[skStyles.screen, { backgroundColor: colors.surfaceSecondary }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[skStyles.screenText, { color: colors.textSecondary }]}>{message}</Text>
    </View>
  );
}

// Animated pulse hook
function usePulse() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return opacity;
}

// Skeleton placeholder for loading states
export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const colors = useThemeColors();
  const opacity = usePulse();

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

// Skeleton group: Card (avatar + text lines)
export function SkeletonCard({ style }: { style?: any }) {
  const colors = useThemeColors();
  return (
    <View style={[skStyles.card, { backgroundColor: colors.surface }, style]}>
      <View style={skStyles.cardRow}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={skStyles.cardTexts}>
          <Skeleton width="60%" height={16} style={{ marginBottom: 8 }} />
          <Skeleton width="40%" height={12} />
        </View>
      </View>
      <Skeleton width="100%" height={14} style={{ marginBottom: 6 }} />
      <Skeleton width="80%" height={14} />
    </View>
  );
}

// Skeleton group: List (multiple cards)
export function SkeletonList({ count = 3, style }: { count?: number; style?: any }) {
  return (
    <View style={style}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} style={{ marginBottom: 12 }} />
      ))}
    </View>
  );
}

// Skeleton group: Stat row (3 equal boxes)
export function SkeletonStatRow({ style }: { style?: any }) {
  const colors = useThemeColors();
  return (
    <View style={[skStyles.statRow, style]}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[skStyles.statBox, { backgroundColor: colors.surface }]}>
          <Skeleton width={48} height={12} style={{ marginBottom: 8 }} />
          <Skeleton width={36} height={24} />
        </View>
      ))}
    </View>
  );
}

// Skeleton group: Dashboard (stat row + card list)
export function SkeletonDashboard({ style }: { style?: any }) {
  return (
    <View style={[skStyles.dashPad, style]}>
      <SkeletonStatRow style={{ marginBottom: 16 }} />
      <SkeletonList count={4} />
    </View>
  );
}

// Skeleton group: Detail (header + content blocks)
export function SkeletonDetail({ style }: { style?: any }) {
  const colors = useThemeColors();
  return (
    <View style={[skStyles.dashPad, style]}>
      <View style={[skStyles.detailHeader, { backgroundColor: colors.surface }]}>
        <Skeleton width={56} height={56} borderRadius={28} />
        <View style={skStyles.detailHeaderTexts}>
          <Skeleton width="50%" height={20} style={{ marginBottom: 8 }} />
          <Skeleton width="70%" height={14} />
        </View>
      </View>
      <Skeleton width="100%" height={100} borderRadius={16} style={{ marginBottom: 12 }} />
      <Skeleton width="100%" height={100} borderRadius={16} style={{ marginBottom: 12 }} />
      <Skeleton width="100%" height={60} borderRadius={16} />
    </View>
  );
}

const skStyles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  overlayCard: {
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 24,
    alignItems: 'center',
  },
  overlayText: { marginTop: 12, fontSize: 14 },
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  screenText: { marginTop: 16, fontSize: 14 },
  card: { borderRadius: 16, padding: 16 },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardTexts: { marginLeft: 12, flex: 1 },
  statRow: { flexDirection: 'row', gap: 10 },
  statBox: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  dashPad: { padding: 16 },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  detailHeaderTexts: { marginLeft: 16, flex: 1 },
});

export default LoadingSpinner;
