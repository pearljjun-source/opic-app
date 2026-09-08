import { View, Text, StyleSheet, Platform } from 'react-native';

import { BUSINESS } from '@/lib/constants';

/**
 * 사업자 정보 표시 (전자상거래법 제10조).
 *
 * 랜딩 · 이용약관 · 개인정보처리방침 · 환불정책 푸터에 같은 내용을 둔다.
 * 한 곳에서만 보이면 크롤러나 이용자가 그 페이지에 닿지 못했을 때 없는 것과 같다.
 *
 * ⚠️ 값은 `lib/constants.ts` 의 BUSINESS 하나에서만 온다. 페이지마다 적어두면
 *    반드시 어긋나고, 법정 표시 사항에서 두 벌이 존재하는 것은 그 자체로 문제다.
 */
export function BusinessInfo() {
  const rows: Array<[string, string]> = [
    ['상호', BUSINESS.NAME],
    ['대표자', BUSINESS.CEO],
    ['사업자등록번호', BUSINESS.REGISTRATION_NO],
    // 신고번호가 없으면 줄을 아예 그리지 않는다 — 빈 값이나 "준비중" 을 보여주면
    // 표시한 것으로 인정되지 않고 오히려 미비를 드러낸다.
    ...(BUSINESS.MAIL_ORDER_NO
      ? ([['통신판매업신고번호', BUSINESS.MAIL_ORDER_NO]] as Array<[string, string]>)
      : []),
    ['주소', BUSINESS.ADDRESS],
    ['전화', BUSINESS.PHONE],
    ['이메일', BUSINESS.EMAIL],
  ];

  return (
    <View style={styles.container}>
      {rows.map(([label, value]) => (
        <Text key={label} style={styles.line} selectable>
          <Text style={styles.label}>{label}</Text>
          {'  '}
          {value}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
    marginTop: 8,
  },
  line: {
    fontSize: 12,
    lineHeight: 18,
    color: '#737373',
    ...(Platform.OS === 'web' ? { userSelect: 'text' as never } : null),
  },
  label: {
    color: '#525252',
    fontFamily: 'Pretendard-Medium',
  },
});
