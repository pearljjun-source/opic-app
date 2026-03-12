import { Alert, Platform } from 'react-native';

/**
 * 크로스 플랫폼 alert — 모바일은 Alert.alert(), 웹은 window.alert()/confirm()
 */
export function alert(title: string, message?: string, onOk?: () => void) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n${message}` : title);
    onOk?.();
  } else {
    Alert.alert(title, message, [
      { text: '확인', onPress: onOk },
    ]);
  }
}

/**
 * 크로스 플랫폼 confirm — 모바일은 Alert.alert(확인/취소), 웹은 window.confirm()
 */
export function confirm(
  title: string,
  message: string,
  onConfirm: () => void,
  options?: {
    confirmText?: string;
    cancelText?: string;
  }
) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: options?.cancelText || '취소', style: 'cancel' },
      { text: options?.confirmText || '확인', style: 'destructive', onPress: onConfirm },
    ]);
  }
}
