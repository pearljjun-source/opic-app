import { useEffect, useRef, useState } from 'react';
import { Animated, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { onToast } from '@/lib/toast';

const ICON_MAP = {
  success: 'checkmark-circle' as const,
  error: 'alert-circle' as const,
  info: 'information-circle' as const,
};

const COLOR_MAP = {
  success: { bg: '#10B981' },
  error: { bg: '#EF4444' },
  info: { bg: '#3B82F6' },
};

export function Toast() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'success' | 'error' | 'info'>('success');
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return onToast((msg, t) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      setMessage(msg);
      setType(t);
      setVisible(true);

      opacity.setValue(0);
      translateY.setValue(-20);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();

      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -20, duration: 300, useNativeDriver: true }),
        ]).start(() => setVisible(false));
      }, 2500);
    });
  }, [opacity, translateY]);

  if (!visible) return null;

  const colors = COLOR_MAP[type];
  const topOffset = Platform.OS === 'web' ? 16 : insets.top + 8;

  return (
    <Animated.View
      style={[
        styles.container,
        { top: topOffset, backgroundColor: colors.bg, opacity, transform: [{ translateY }] },
      ]}
      pointerEvents="none"
    >
      <Ionicons name={ICON_MAP[type]} size={20} color="#FFFFFF" />
      <Text style={styles.message} numberOfLines={2}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    color: '#FFFFFF',
  },
});
