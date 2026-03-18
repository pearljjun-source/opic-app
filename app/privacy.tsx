import { ScrollView, View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

/**
 * 개인정보 처리방침 페이지
 *
 * 인증 불필요 — 누구나 접근 가능 (앱스토어 심사, 회원가입 전 확인용)
 * URL: /privacy (웹), 앱 내에서는 Linking.openURL로 접근
 */
export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        {Platform.OS !== 'web' && (
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#171717" />
          </Pressable>
        )}
        <Text style={styles.title}>개인정보 처리방침</Text>
        <Text style={styles.date}>시행일: 2026년 3월 17일</Text>
      </View>

      <Text style={styles.intro}>
        Speaky(이하 "회사")는 개인정보보호법, 정보통신망 이용촉진 및 정보보호 등에 관한 법률 등 관련 법령에 따라 이용자의 개인정보를 보호하고 이와 관련된 고충을 신속하게 처리하기 위해 다음과 같이 개인정보 처리방침을 수립·공개합니다.
      </Text>

      <Section title="제1조 (수집하는 개인정보)">
        {`회사는 서비스 제공을 위해 다음의 개인정보를 수집합니다.

1. 필수 수집 항목
  • 회원가입: 이메일 주소, 비밀번호(암호화 저장), 이름
  • 서비스 이용: 학습 기록, 연습 녹음 파일, 스크립트 내용
  • 결제: 빌링키(토스페이먼츠에서 관리, 회사는 카드번호를 저장하지 않음)

2. 자동 수집 항목
  • 기기 정보 (OS 종류, 앱 버전)
  • 접속 로그 (접속 시간, IP 주소)
  • 푸시 알림 토큰 (Expo Push Token)`}
      </Section>

      <Section title="제2조 (개인정보의 수집 및 이용 목적)">
        {`회사는 수집한 개인정보를 다음의 목적으로 이용합니다.

① 회원 관리: 회원가입, 본인 확인, 서비스 이용 자격 관리
② 서비스 제공: OPIc 학습 서비스, AI 피드백, TTS/STT 기능 제공
③ 구독 및 결제: 유료 서비스 제공, 결제 처리, 환불 처리
④ 학습 분석: 학습 진도 추적, 통계 제공, 서비스 개선
⑤ 알림: 학습 관련 알림, 서비스 공지사항 전달
⑥ 고객 지원: 문의 응대, 분쟁 해결`}
      </Section>

      <Section title="제3조 (개인정보의 제3자 제공)">
        {`회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만 다음의 경우는 예외로 합니다.

① 법령에 의해 요구되는 경우
② 수사 목적으로 법령에 정해진 절차에 따라 수사기관의 요구가 있는 경우

서비스 제공을 위해 다음 외부 서비스를 이용하며, 해당 서비스의 개인정보처리방침이 적용됩니다:
  • Supabase (데이터베이스, 인증): 암호화된 데이터 저장
  • OpenAI (Whisper STT, TTS): 음성 데이터 처리 (저장하지 않음)
  • Anthropic (Claude AI): 피드백 생성 (저장하지 않음)
  • 토스페이먼츠: 결제 처리
  • Expo (푸시 알림): 알림 전달`}
      </Section>

      <Section title="제4조 (개인정보의 보유 및 이용 기간)">
        {`① 회사는 이용자가 서비스를 이용하는 동안 개인정보를 보유합니다.
② 회원 탈퇴 시 개인정보는 즉시 파기합니다. 단, 다음의 경우 명시된 기간 동안 보관합니다:

  • 결제 및 공급에 관한 기록: 5년 (전자상거래법)
  • 소비자 불만 또는 분쟁 처리에 관한 기록: 3년 (전자상거래법)
  • 접속 로그: 3개월 (통신비밀보호법)

③ 연습 녹음 파일은 회원 탈퇴 시 즉시 삭제됩니다.`}
      </Section>

      <Section title="제5조 (개인정보의 파기)">
        {`① 회사는 개인정보 보유 기간이 경과하거나 처리 목적이 달성된 경우 지체 없이 해당 개인정보를 파기합니다.
② 전자적 파일 형태의 정보는 복구할 수 없는 방법으로 삭제합니다.
③ 연습 녹음 파일은 Supabase Storage에서 물리적으로 삭제합니다.`}
      </Section>

      <Section title="제6조 (이용자의 권리)">
        {`이용자는 다음의 권리를 행사할 수 있습니다.

① 개인정보 열람 요구
② 개인정보 정정·삭제 요구
③ 개인정보 처리 정지 요구
④ 회원 탈퇴 (서비스 내 설정에서 직접 처리 가능)

권리 행사는 서비스 내 설정 또는 이메일(speaky@support.com)을 통해 할 수 있으며, 회사는 지체 없이 조치합니다.`}
      </Section>

      <Section title="제7조 (개인정보의 안전성 확보 조치)">
        {`회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.

① 비밀번호 암호화: Supabase Auth의 bcrypt 해싱 적용
② 데이터 암호화: 전송 시 TLS/SSL 암호화, 저장 시 AES-256 암호화
③ 접근 권한 관리: Row Level Security(RLS) 정책으로 데이터 격리
④ 보안 트리거: 역할 변경 방지, 컬럼 보호 트리거 적용
⑤ API Rate Limiting: 외부 API 호출 횟수 제한
⑥ 인증 토큰 관리: URL에서 토큰 즉시 제거, 서버 사이드 검증`}
      </Section>

      <Section title="제8조 (쿠키 및 자동 수집 장치)">
        {`① 회사는 웹 서비스에서 인증 세션 관리를 위해 쿠키를 사용합니다.
② 이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 서비스 이용에 제한이 있을 수 있습니다.
③ 모바일 앱에서는 Expo SecureStore를 통해 인증 정보를 안전하게 저장합니다.`}
      </Section>

      <Section title="제9조 (만 14세 미만 아동의 개인정보)">
        회사는 만 14세 미만 아동의 개인정보를 수집하지 않습니다. 만 14세 미만 아동이 서비스에 가입한 사실을 인지한 경우, 해당 계정의 개인정보를 즉시 삭제합니다.
      </Section>

      <Section title="제10조 (개인정보 보호책임자)">
        {`회사는 개인정보 처리에 관한 업무를 총괄하여 책임지고, 관련 불만 처리를 위해 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.

  • 담당: Speaky 개인정보보호팀
  • 이메일: speaky@support.com

이용자는 서비스 이용 중 발생하는 개인정보 관련 문의, 불만, 피해구제 등을 위 연락처로 문의할 수 있습니다.`}
      </Section>

      <Section title="제11조 (개인정보 처리방침의 변경)">
        {`① 본 방침은 관련 법령 및 내부 방침에 따라 변경될 수 있습니다.
② 변경 시 시행일 7일 전부터 서비스 내 공지를 통해 안내합니다.
③ 중요 변경사항은 이메일 또는 푸시 알림으로 별도 안내합니다.`}
      </Section>

      <Section title="부칙">
        본 개인정보 처리방침은 2026년 3월 17일부터 시행됩니다.
      </Section>

      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2026 Speaky. All rights reserved.</Text>
        <Text style={styles.footerText}>문의: speaky@support.com</Text>
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
  intro: { fontSize: 14, fontFamily: 'Pretendard-Regular', color: '#404040', lineHeight: 22, marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontFamily: 'Pretendard-SemiBold', color: '#171717', marginBottom: 8 },
  sectionBody: { fontSize: 14, fontFamily: 'Pretendard-Regular', color: '#404040', lineHeight: 22 },
  footer: { marginTop: 32, paddingTop: 24, borderTopWidth: 1, borderTopColor: '#E5E5E5', gap: 4 },
  footerText: { fontSize: 13, fontFamily: 'Pretendard-Regular', color: '#A3A3A3' },
});
