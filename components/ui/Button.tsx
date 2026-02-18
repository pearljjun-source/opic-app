import { forwardRef } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
  View,
} from 'react-native';

import { COLORS } from '@/lib/constants';
import { useThemeColors } from '@/hooks/useTheme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<TouchableOpacityProps, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
}

const variantStyles: Record<ButtonVariant, { container: string; text: string }> = {
  primary: {
    container: 'bg-primary',
    text: 'text-white',
  },
  secondary: {
    container: 'bg-secondary',
    text: 'text-white',
  },
  outline: {
    container: 'bg-transparent border border-primary',
    text: 'text-primary',
  },
  ghost: {
    container: 'bg-transparent',
    text: 'text-primary',
  },
  danger: {
    container: 'bg-error',
    text: 'text-white',
  },
};

const sizeStyles: Record<ButtonSize, { container: string; text: string }> = {
  sm: {
    container: 'px-3 py-2 rounded-md',
    text: 'text-sm',
  },
  md: {
    container: 'px-4 py-3 rounded-lg',
    text: 'text-base',
  },
  lg: {
    container: 'px-6 py-4 rounded-xl',
    text: 'text-lg',
  },
};

export const Button = forwardRef<View, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      children,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = '',
      ...props
    },
    ref
  ) => {
    const colors = useThemeColors();
    const isDisabled = disabled || loading;
    const variantStyle = variantStyles[variant];
    const sizeStyle = sizeStyles[size];

    const containerClasses = [
      'flex-row items-center justify-center',
      variantStyle.container,
      sizeStyle.container,
      fullWidth ? 'w-full' : '',
      isDisabled ? 'opacity-50' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const textClasses = [variantStyle.text, sizeStyle.text, 'font-semibold']
      .filter(Boolean)
      .join(' ');

    const loaderColor =
      variant === 'outline' || variant === 'ghost' ? colors.primary : '#FFFFFF';

    return (
      <TouchableOpacity
        ref={ref}
        className={containerClasses}
        disabled={isDisabled}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        {...props}
      >
        {loading ? (
          <ActivityIndicator size="small" color={loaderColor} />
        ) : (
          <>
            {leftIcon && <View className="mr-2">{leftIcon}</View>}
            <Text className={textClasses}>{children}</Text>
            {rightIcon && <View className="ml-2">{rightIcon}</View>}
          </>
        )}
      </TouchableOpacity>
    );
  }
);

Button.displayName = 'Button';

export default Button;
