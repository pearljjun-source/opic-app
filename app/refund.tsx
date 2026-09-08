import { ScrollView, View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { BusinessInfo } from '@/components/BusinessInfo';
import { BUSINESS, CONTACT } from '@/lib/constants';

/**
 * 환불 정책 페이지
 *
 * 인증 불필요 — 누구나 접근 가능.
 * URL: /refund
 *
 * 왜 이용약관에서 떼어내 별도 페이지로 두는가:
 *   환불·청약철회 조항은 이용약관 제9조 안에 이미 있었다. 그런데 결제대행 심사는
 *   "환불 정책을 확인할 수 없다" 며 반려했다. 약관 본문 깊숙이 있으면 사람도
 *   크롤러도 찾지 못한다. 전자상거래법이 요구하는 것도 "이용자가 쉽게 알 수 있도록"
 *   이다 — 어딘가에 적혀 있는 것과 찾을 수 있는 것은 다르다.
 *
 * ⚠️ 이용약관 제9조와 내용이 어긋나면 안 된다. 한쪽을 고치면 다른 쪽도 본다.
 */
export default function RefundScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        {Platform.OS !== 'web' && (
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#171717" />
          </Pressable>
        )}
        <Text style={styles.title}>환불 및 청약철회 정책</Text>
        <Text style={styles.date}>시행일: 2026년 9월 8일</Text>
      </View>

      <Section title="제1조 (목적)">
        {`본 정책은 ${BUSINESS.NAME}(이하 "회사")가 제공하는 Speaky 서비스의 유료 구독에 대한 청약철회 및 환불 기준을 정합니다. 본 정책은 이용약관의 일부를 구성하며, 「전자상거래 등에서의 소비자보호에 관한 법률」을 따릅니다.`}
      </Section>

      <Section title="제2조 (청약철회)">
        {`① 이용자는 결제일로부터 7일 이내에 청약을 철회할 수 있습니다.
② 다만 서비스의 성격상 다음의 경우에는 청약철회가 제한될 수 있습니다.
  - 이용자가 결제 후 유료 기능(AI 피드백, 모의고사 등)을 이미 사용한 경우, 사용한 부분에 상당하는 금액을 공제할 수 있습니다.
③ 청약철회는 고객센터(${CONTACT.SUPPORT_EMAIL}) 또는 대표전화(${BUSINESS.PHONE})로 신청할 수 있습니다.`}
      </Section>

      <Section title="제3조 (구독 해지와 환불)">
        {`① 월간 구독
  - 언제든지 해지할 수 있으며, 해지 시 현재 결제 주기가 끝날 때까지 서비스를 이용할 수 있습니다.
  - 이미 결제된 해당 월의 요금은 환불되지 않습니다. 다만 제2조의 청약철회 기간 내에는 환불이 가능합니다.

② 연간 구독
  - 결제일로부터 14일 이내: 전액 환불
  - 14일 경과 후: 환불이 불가하며, 남은 기간 동안 서비스를 계속 이용할 수 있습니다.

③ 해지 신청은 서비스 내 [설정 → 구독 관리] 또는 고객센터를 통해 할 수 있습니다.`}
      </Section>

      <Section title="제4조 (회사의 귀책사유로 인한 환불)">
        {`① 결제 오류 또는 이중 결제가 확인된 경우 전액 환불합니다.
② 회사의 귀책사유로 서비스를 정상적으로 이용할 수 없었던 경우, 해당 기간에 상당하는 금액을 일할 계산하여 환불합니다.
③ 회사가 서비스를 종료하는 경우 잔여 기간에 대해 일할 계산하여 환불합니다.`}
      </Section>

      <Section title="제5조 (환불 절차 및 기간)">
        {`① 환불 신청은 고객센터(${CONTACT.SUPPORT_EMAIL})로 접수합니다.
② 회사는 신청일로부터 3영업일 이내에 처리 결과를 안내합니다.
③ 환불은 결제하신 수단으로 이루어지며, 카드 결제의 경우 카드사 사정에 따라 실제 반영까지 영업일 기준 3~5일이 추가로 걸릴 수 있습니다.
④ 환불 처리에 따른 수수료는 회사가 부담합니다.`}
      </Section>

      <Section title="제6조 (무료 체험)">
        {`① 무료 체험 기간에는 요금이 청구되지 않으므로 환불 대상이 아닙니다.
② 무료 체험 종료 전에 해지하면 요금이 청구되지 않습니다.`}
      </Section>

      <View style={styles.footer}>
        <Text style={styles.footerText}>문의: {CONTACT.SUPPORT_EMAIL} / {BUSINESS.PHONE}</Text>
        <BusinessInfo />
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { maxWidth: 800, width: '100%', alignSelf: 'center', padding: 24, paddingBottom: 60 },
  header: { marginBottom: 32 },
  backButton: { marginBottom: 16 },
  title: { fontSize: 28, fontFamily: 'Pretendard-Bold', color: '#171717', marginBottom: 8 },
  date: { fontSize: 14, fontFamily: 'Pretendard-Regular', color: '#737373' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontFamily: 'Pretendard-SemiBold', color: '#171717', marginBottom: 8 },
  sectionBody: { fontSize: 14, fontFamily: 'Pretendard-Regular', color: '#404040', lineHeight: 22 },
  footer: { marginTop: 32, paddingTop: 24, borderTopWidth: 1, borderTopColor: '#E5E5E5', gap: 4 },
  footerText: { fontSize: 13, fontFamily: 'Pretendard-Regular', color: '#A3A3A3' },
});
