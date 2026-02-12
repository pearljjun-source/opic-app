import { forwardRef, useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isPassword?: boolean;
  disabled?: boolean;
  className?: string;
  containerClassName?: string;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      isPassword = false,
      disabled = false,
      className = '',
      containerClassName = '',
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const hasError = !!error;

    const inputContainerClasses = [
      'flex-row items-center border rounded-lg px-3 py-3 bg-white',
      isFocused && !hasError ? 'border-primary' : '',
      hasError ? 'border-error' : '',
      !isFocused && !hasError ? 'border-gray-300' : '',
      disabled ? 'bg-gray-100 opacity-60' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const inputClasses = ['flex-1 text-base text-gray-900', className]
      .filter(Boolean)
      .join(' ');

    return (
      <View className={`mb-4 ${containerClassName}`}>
        {label && (
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            {label}
          </Text>
        )}

        <View className={inputContainerClasses}>
          {leftIcon && <View className="mr-2">{leftIcon}</View>}

          <TextInput
            ref={ref}
            className={inputClasses}
            placeholderTextColor={COLORS.GRAY_400}
            editable={!disabled}
            secureTextEntry={isPassword && !showPassword}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            accessibilityLabel={label}
            accessibilityState={{ disabled }}
            {...props}
          />

          {isPassword && (
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              className="ml-2 p-1"
              accessibilityLabel={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={COLORS.GRAY_500}
              />
            </TouchableOpacity>
          )}

          {rightIcon && !isPassword && <View className="ml-2">{rightIcon}</View>}
        </View>

        {error && (
          <Text className="text-sm text-error mt-1">{error}</Text>
        )}

        {hint && !error && (
          <Text className="text-sm text-gray-500 mt-1">{hint}</Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

export default Input;
