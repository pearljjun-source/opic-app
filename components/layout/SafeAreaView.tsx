import { forwardRef } from 'react';
import { View, ViewProps, Platform, StatusBar } from 'react-native';
import {
  SafeAreaView as RNSafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { useThemeColors } from '@/hooks/useTheme';

export interface SafeAreaViewProps extends ViewProps {
  children: React.ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  className?: string;
  backgroundColor?: string;
}

export const SafeAreaView = forwardRef<View, SafeAreaViewProps>(
  (
    {
      children,
      edges = ['top', 'bottom'],
      className = '',
      backgroundColor,
      style,
      ...props
    },
    ref
  ) => {
    const colors = useThemeColors();
    const bg = backgroundColor ?? colors.surface;

    return (
      <RNSafeAreaView
        ref={ref}
        edges={edges}
        className={`flex-1 ${className}`}
        style={[{ backgroundColor: bg }, style]}
        {...props}
      >
        {children}
      </RNSafeAreaView>
    );
  }
);

SafeAreaView.displayName = 'SafeAreaView';

// Screen wrapper with consistent padding
export interface ScreenContainerProps extends ViewProps {
  children: React.ReactNode;
  padded?: boolean;
  scroll?: boolean;
  className?: string;
  backgroundColor?: string;
}

export function ScreenContainer({
  children,
  padded = true,
  className = '',
  backgroundColor,
  ...props
}: ScreenContainerProps) {
  const colors = useThemeColors();
  const bg = backgroundColor ?? colors.surface;
  const baseClasses = ['flex-1', padded ? 'px-4' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <SafeAreaView backgroundColor={bg}>
      <View className={baseClasses} {...props}>
        {children}
      </View>
    </SafeAreaView>
  );
}

// Hook to get safe area insets with extra padding if needed
export function useSafeInsets() {
  const insets = useSafeAreaInsets();

  // On Android, add extra padding if status bar is translucent
  const topInset =
    Platform.OS === 'android'
      ? Math.max(insets.top, StatusBar.currentHeight || 0)
      : insets.top;

  return {
    ...insets,
    top: topInset,
  };
}

export default SafeAreaView;
