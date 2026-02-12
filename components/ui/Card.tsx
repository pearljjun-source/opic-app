import { forwardRef } from 'react';
import { View, ViewProps, TouchableOpacity, TouchableOpacityProps, Platform, StyleSheet } from 'react-native';

export type CardVariant = 'default' | 'elevated' | 'outlined';

export interface CardProps extends ViewProps {
  variant?: CardVariant;
  className?: string;
  children: React.ReactNode;
}

export interface PressableCardProps extends Omit<TouchableOpacityProps, 'children'> {
  variant?: CardVariant;
  className?: string;
  children: React.ReactNode;
}

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-white rounded-xl p-4',
  elevated: 'bg-white rounded-xl p-4',
  outlined: 'bg-white rounded-xl p-4 border border-gray-200',
};

// React Native 그림자 스타일 (iOS + Android)
const shadowStyle = StyleSheet.create({
  elevated: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
});

export const Card = forwardRef<View, CardProps>(
  ({ variant = 'default', className = '', children, style, ...props }, ref) => {
    const baseClasses = variantClasses[variant];
    const combinedClasses = [baseClasses, className].filter(Boolean).join(' ');
    const elevatedStyle = variant === 'elevated' ? shadowStyle.elevated : undefined;

    return (
      <View ref={ref} className={combinedClasses} style={[elevatedStyle, style]} {...props}>
        {children}
      </View>
    );
  }
);

Card.displayName = 'Card';

export const PressableCard = forwardRef<View, PressableCardProps>(
  ({ variant = 'default', className = '', children, style, ...props }, ref) => {
    const baseClasses = variantClasses[variant];
    const combinedClasses = [baseClasses, className].filter(Boolean).join(' ');
    const elevatedStyle = variant === 'elevated' ? shadowStyle.elevated : undefined;

    return (
      <TouchableOpacity
        ref={ref}
        className={combinedClasses}
        style={[elevatedStyle, style]}
        activeOpacity={0.7}
        accessibilityRole="button"
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }
);

PressableCard.displayName = 'PressableCard';

// Card sub-components
export const CardHeader = forwardRef<View, ViewProps & { className?: string }>(
  ({ className = '', children, ...props }, ref) => (
    <View ref={ref} className={`mb-3 ${className}`} {...props}>
      {children}
    </View>
  )
);

CardHeader.displayName = 'CardHeader';

export const CardContent = forwardRef<View, ViewProps & { className?: string }>(
  ({ className = '', children, ...props }, ref) => (
    <View ref={ref} className={className} {...props}>
      {children}
    </View>
  )
);

CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<View, ViewProps & { className?: string }>(
  ({ className = '', children, ...props }, ref) => (
    <View ref={ref} className={`mt-3 pt-3 border-t border-gray-100 ${className}`} {...props}>
      {children}
    </View>
  )
);

CardFooter.displayName = 'CardFooter';

export default Card;
