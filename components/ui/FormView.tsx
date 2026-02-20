import { createElement } from 'react';
import { Platform, View, ViewProps } from 'react-native';

interface FormViewProps extends ViewProps {
  onSubmit?: () => void;
  autoComplete?: string;
}

/**
 * 웹: <form> 렌더링 — Chrome 경고 제거 + Enter 키 제출 + 비밀번호 관리자 지원
 * 네이티브: <View> 렌더링 — 기존 동작 유지
 */
export function FormView({ onSubmit, autoComplete, style, children }: FormViewProps) {
  if (Platform.OS === 'web') {
    return createElement('form', {
      onSubmit: (e: { preventDefault: () => void }) => {
        e.preventDefault();
        onSubmit?.();
      },
      autoComplete,
      style,
      children,
    });
  }
  return <View style={style}>{children}</View>;
}
