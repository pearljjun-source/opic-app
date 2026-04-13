import { ScrollView, View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CONTACT } from '@/lib/constants';

/**
 * 이용약관 페이지
 *
 * 인증 불필요 — 누구나 접근 가능 (앱스토어 심사, 회원가입 전 확인용)
 * URL: /terms (웹), 앱 내에서는 Linking.openURL로 접근
 */
export default function TermsScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        {Platform.OS !== 'web' && (
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#171717" />
          </Pressable>
        )}
        <Text style={styles.title}>이용약관</Text>
        <Text style={styles.date}>시행일: 2026년 3월 17일</Text>
      </View>

      <Section title="제1조 (목적)">
        본 약관은 Speaky(이하 "회사")가 제공하는 OPIc 학습 플랫폼 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
      </Section>

      <Section title="제2조 (정의)">
        {`① "서비스"란 회사가 제공하는 OPIc 시험 대비 학습 관리 플랫폼으로, 웹 및 모바일 앱을 통해 이용할 수 있는 모든 서비스를 의미합니다.
② "이용자"란 본 약관에 따라 서비스를 이용하는 모든 자를 의미하며, 학원(조직), 강사, 학생을 포함합니다.
③ "조직"이란 서비스에 등록된 학원 또는 교육 기관을 의미합니다.
④ "원장"이란 조직의 소유자로서 구독 및 결제를 관리하는 이용자를 의미합니다.
⑤ "강사"란 조직에 소속되어 학생을 관리하고 스크립트를 작성하는 이용자를 의미합니다.
⑥ "학생"이란 조직에 소속되어 학습 서비스를 이용하는 이용자를 의미합니다.`}
      </Section>

      <Section title="제3조 (약관의 효력 및 변경)">
        {`① 본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.
② 회사는 관련 법령에 위배되지 않는 범위에서 약관을 변경할 수 있으며, 변경된 약관은 시행일 7일 전부터 서비스 내에 공지합니다.
③ 이용자가 변경된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.`}
      </Section>

      <Section title="제4조 (회원가입 및 계정)">
        {`① 이용자는 이메일 주소와 비밀번호를 사용하여 회원가입할 수 있습니다.
② 회원가입 시 이메일 인증을 완료해야 서비스를 이용할 수 있습니다.
③ 이용자는 정확한 정보를 제공해야 하며, 허위 정보 제공 시 서비스 이용이 제한될 수 있습니다.
④ 계정 정보의 관리 책임은 이용자에게 있으며, 타인에게 계정을 양도하거나 대여할 수 없습니다.`}
      </Section>

      <Section title="제5조 (서비스의 내용)">
        {`회사는 다음의 서비스를 제공합니다:
① 스크립트 기반 OPIc 연습 (강사 작성 → 학생 연습)
② AI 음성 인식(STT) 및 텍스트 음성 변환(TTS)
③ AI 피드백 (스크립트 대비 실제 답변 비교 분석)
④ 모의고사 및 레벨 테스트
⑤ 학습 기록 및 통계 대시보드
⑥ 학원(조직) 단위 학생/강사 관리
⑦ 푸시 알림 서비스`}
      </Section>

      <Section title="제6조 (구독 및 결제)">
        {`① 서비스는 무료 플랜과 유료 구독 플랜으로 제공됩니다.
② 유료 구독은 조직 단위로 관리되며, 원장만 구독을 변경할 수 있습니다.
③ 결제는 토스페이먼츠를 통한 빌링키 방식으로 처리됩니다.
④ 구독 기간 만료 시 자동으로 갱신되며, 갱신 전 안내를 제공합니다.
⑤ 구독 취소는 현재 결제 기간 만료 시 적용됩니다.
⑥ 환불 정책:
  - 월간 결제: 환불이 불가하며, 해지 시 현재 결제 주기가 끝날 때까지 서비스를 이용할 수 있습니다.
  - 연간 결제: 결제일로부터 14일 이내에 전액 환불이 가능합니다. 14일 이후에는 환불이 불가하며, 남은 기간 동안 서비스를 이용할 수 있습니다.
  - 결제 오류 또는 이중 결제: 고객 센터(${CONTACT.SUPPORT_EMAIL}) 확인 후 전액 환불됩니다.
⑦ 무료 체험 기간(30일) 중 유료 결제가 발생하지 않으며, 체험 종료 시 자동으로 무료 플랜으로 전환됩니다.`}
      </Section>

      <Section title="제7조 (이용자의 의무)">
        {`이용자는 다음 행위를 하여서는 안 됩니다:
① 타인의 개인정보를 도용하거나 허위 정보를 등록하는 행위
② 서비스의 정상적인 운영을 방해하는 행위
③ 서비스를 통해 얻은 정보를 회사의 동의 없이 상업적으로 이용하는 행위
④ 회사 및 타인의 지적재산권을 침해하는 행위
⑤ 음란, 폭력, 혐오 등 공서양속에 반하는 콘텐츠를 게시하는 행위
⑥ 서비스의 보안 시스템을 우회하거나 침투하려는 행위`}
      </Section>

      <Section title="제8조 (회사의 의무)">
        {`① 회사는 관련 법령과 본 약관이 정하는 바에 따라 안정적인 서비스 제공을 위해 노력합니다.
② 회사는 이용자의 개인정보를 보호하기 위해 개인정보처리방침을 수립하고 이를 준수합니다.
③ 회사는 서비스 장애 발생 시 신속하게 복구하기 위해 최선의 노력을 다합니다.`}
      </Section>

      <Section title="제9조 (서비스의 변경 및 중단)">
        {`① 회사는 운영상, 기술상의 필요에 따라 서비스의 전부 또는 일부를 변경할 수 있습니다.
② 서비스 변경 시 사전에 공지하며, 불가피한 경우 사후에 공지할 수 있습니다.
③ 회사는 천재지변, 시스템 장애 등 불가항력적 사유로 서비스 제공이 불가능한 경우 서비스를 일시적으로 중단할 수 있습니다.`}
      </Section>

      <Section title="제10조 (지적재산권)">
        {`① 서비스에 포함된 모든 콘텐츠(소프트웨어, 디자인, 텍스트, 이미지 등)에 대한 저작권 및 지적재산권은 회사에 귀속됩니다.
② 이용자가 작성한 스크립트, 연습 녹음 등의 콘텐츠에 대한 저작권은 해당 이용자에게 귀속됩니다.
③ 회사는 서비스 개선 및 AI 모델 학습을 위해 익명화된 데이터를 활용할 수 있습니다.`}
      </Section>

      <Section title="제11조 (계약 해지 및 이용 제한)">
        {`① 이용자는 언제든지 서비스 내에서 회원 탈퇴를 요청할 수 있습니다.
② 회사는 이용자가 본 약관을 위반한 경우 사전 통보 후 서비스 이용을 제한하거나 계약을 해지할 수 있습니다.
③ 회원 탈퇴 시 개인정보는 개인정보처리방침에 따라 처리됩니다.`}
      </Section>

      <Section title="제12조 (면책사항)">
        {`① 회사는 천재지변, 전쟁, 통신 장애 등 불가항력적 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다.
② AI 피드백은 참고용이며, 실제 OPIc 시험 결과를 보장하지 않습니다.
③ 이용자 간의 분쟁에 대해 회사는 개입할 의무가 없습니다.`}
      </Section>

      <Section title="제13조 (분쟁 해결)">
        {`① 본 약관에 관한 분쟁은 대한민국 법률을 적용합니다.
② 서비스 이용과 관련하여 분쟁이 발생한 경우 회사의 본점 소재지를 관할하는 법원을 제1심 관할 법원으로 합니다.`}
      </Section>

      <Section title="부칙">
        본 약관은 2026년 3월 17일부터 시행됩니다.
      </Section>

      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2026 Speaky. All rights reserved.</Text>
        <Text style={styles.footerText}>문의: {CONTACT.SUPPORT_EMAIL}</Text>
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
