import { View, Text, ScrollView, Pressable, Image, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const DEEP_ROSE = '#D4707F';
const DEEP_ROSE_LIGHT = '#FDE8EB';

const FEATURES = [
  {
    icon: 'mic-outline' as const,
    title: '실전 시뮬레이션',
    desc: 'OPIc 시험의 Ava 음성으로\n실제와 동일한 환경에서 연습',
  },
  {
    icon: 'sparkles-outline' as const,
    title: 'AI 맞춤 피드백',
    desc: '스크립트와 실제 답변을\nAI가 자동 비교 분석',
  },
  {
    icon: 'people-outline' as const,
    title: '강사 맞춤 관리',
    desc: '강사가 학생별\n맞춤 스크립트 제공',
  },
  {
    icon: 'trending-up-outline' as const,
    title: '학습 기록 추적',
    desc: '연습 이력 관리 및\n성장 과정 확인',
  },
];

const STEPS = [
  { num: '01', title: '회원가입', desc: '간편하게 가입하고 강사와 연결' },
  { num: '02', title: '스크립트 학습', desc: '강사가 작성한 맞춤 스크립트로 준비' },
  { num: '03', title: '녹음 연습', desc: 'Ava 음성 질문에 실전처럼 답변' },
  { num: '04', title: 'AI 분석', desc: 'AI가 답변을 분석하고 피드백 제공' },
];

// ============================================================================
// ImagePlaceholder — 사용자가 나중에 실제 이미지로 교체
// ============================================================================
function ImagePlaceholder({ label, width, height }: { label: string; width: number | string; height: number | string }) {
  return (
    <View style={[styles.imagePlaceholder, { width: width as number, height: height as number }]}>
      <Ionicons name="image-outline" size={32} color="#9ca3af" />
      <Text style={styles.imagePlaceholderText}>{label}</Text>
    </View>
  );
}

// ============================================================================
// Main Landing Page
// ============================================================================
export default function LandingPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  return (
    <ScrollView style={styles.container}>
      {/* ================================================================ */}
      {/* Hero Section */}
      {/* ================================================================ */}
      <View style={[styles.hero, Platform.OS === 'web' && ({ minHeight: '100vh' } as any)]}>
        {/* 배경 이미지 자리 — 실제 이미지로 교체 시 ImageBackground 사용 */}
        <View style={[StyleSheet.absoluteFill, styles.heroBg]}>
          <ImagePlaceholder label="히어로 배경 이미지 (1920×1080)" width="100%" height="100%" />
        </View>
        <View style={[StyleSheet.absoluteFill, styles.heroOverlay]} />

        {/* Navigation */}
        <View style={styles.nav}>
          <View style={styles.navInner}>
            <View style={styles.navLogoGroup}>
              <Image
                source={require('@/assets/images/speaky-icon.png')}
                style={styles.navIcon}
              />
              <Image
                source={require('@/assets/images/speaky-text-logo.png')}
                style={styles.navLogo}
                resizeMode="contain"
              />
            </View>
            <View style={styles.navRight}>
              <Pressable onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.navLink}>로그인</Text>
              </Pressable>
              <Pressable
                style={styles.navSignupButton}
                onPress={() => router.push('/(auth)/signup')}
              >
                <Text style={styles.navSignupText}>시작하기</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Hero Content */}
        <View style={styles.heroContent}>
          <Text style={[styles.heroTitle, isMobile && styles.heroTitleMobile]}>
            SPEAK WITH{'\n'}
            <Text style={{ color: DEEP_ROSE }}>'CONFIDENCE'</Text>
            {'\n'}IN YOUR OPIc.
          </Text>
          <Text style={[styles.heroSubtitle, isMobile && styles.heroSubtitleMobile]}>
            AI 피드백과 맞춤 스크립트로{'\n'}OPIc 실전 연습을 시작하세요
          </Text>
          <Pressable
            style={styles.heroCta}
            onPress={() => router.push('/(auth)/signup')}
          >
            <Text style={styles.heroCtaText}>무료로 시작하기</Text>
          </Pressable>
        </View>
      </View>

      {/* ================================================================ */}
      {/* Features Section */}
      {/* ================================================================ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>왜 Speaky인가요?</Text>
        <Text style={styles.sectionSubtitle}>
          OPIc 고득점을 위한 모든 것을 한 곳에서
        </Text>
        <View style={[styles.featuresGrid, isMobile && styles.featuresGridMobile]}>
          {FEATURES.map((f, i) => (
            <View key={i} style={[styles.featureCard, isMobile && styles.featureCardMobile]}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon} size={28} color={DEEP_ROSE} />
              </View>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ================================================================ */}
      {/* How It Works */}
      {/* ================================================================ */}
      <View style={[styles.section, { backgroundColor: '#f9fafb' }]}>
        <Text style={styles.sectionTitle}>이용 방법</Text>
        <View style={[styles.stepsRow, isMobile && styles.stepsRowMobile]}>
          {STEPS.map((s, i) => (
            <View key={i} style={[styles.stepCard, isMobile && styles.stepCardMobile]}>
              <Text style={styles.stepNum}>{s.num}</Text>
              <Text style={styles.stepTitle}>{s.title}</Text>
              <Text style={styles.stepDesc}>{s.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ================================================================ */}
      {/* App Preview Section */}
      {/* ================================================================ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>앱 미리보기</Text>
        <View style={[styles.previewGrid, isMobile && styles.previewGridMobile]}>
          {['메인 화면', '연습 화면', '피드백 화면'].map((label, i) => (
            <View key={i} style={styles.phoneMockup}>
              <ImagePlaceholder label={label} width={240} height={480} />
            </View>
          ))}
        </View>
      </View>

      {/* ================================================================ */}
      {/* CTA Section */}
      {/* ================================================================ */}
      <View style={styles.ctaSection}>
        <Text style={styles.ctaTitle}>
          지금 Speaky와 함께{'\n'}OPIc 고득점을 향해 시작하세요
        </Text>
        <View style={styles.ctaButtons}>
          <Pressable
            style={styles.ctaPrimary}
            onPress={() => router.push('/(auth)/signup')}
          >
            <Text style={styles.ctaPrimaryText}>무료로 시작하기</Text>
          </Pressable>
          {/* 앱 다운로드 링크 — Google Play URL로 교체 */}
          <Pressable style={styles.ctaSecondary}>
            <Ionicons name="logo-google-playstore" size={20} color="#fff" />
            <Text style={styles.ctaSecondaryText}>앱 다운로드</Text>
          </Pressable>
        </View>
      </View>

      {/* ================================================================ */}
      {/* Footer */}
      {/* ================================================================ */}
      <View style={styles.footer}>
        <View style={styles.footerInner}>
          <View style={styles.footerLogoGroup}>
            <Image
              source={require('@/assets/images/speaky-icon.png')}
              style={styles.footerIcon}
            />
            <Image
              source={require('@/assets/images/speaky-text-logo.png')}
              style={styles.footerLogo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.footerLinks}>
            <Pressable><Text style={styles.footerLink}>개인정보처리방침</Text></Pressable>
            <Text style={styles.footerDivider}>|</Text>
            <Pressable><Text style={styles.footerLink}>이용약관</Text></Pressable>
            <Text style={styles.footerDivider}>|</Text>
            <Pressable><Text style={styles.footerLink}>문의하기</Text></Pressable>
          </View>
          <Text style={styles.footerCopy}>© 2026 Speaky. All rights reserved.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ============================================================================
// Styles
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // --- Image Placeholder ---
  imagePlaceholder: {
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#374151',
    borderStyle: 'dashed',
    borderRadius: 8,
  },
  imagePlaceholderText: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 8,
  },

  // --- Hero ---
  hero: {
    minHeight: 700,
    backgroundColor: '#111827',
    position: 'relative',
  },
  heroBg: {
    backgroundColor: '#111827',
  },
  heroOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  nav: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    zIndex: 10,
  },
  navInner: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navLogoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  navLogo: {
    height: 28,
    width: 100,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  navLink: {
    color: '#d1d5db',
    fontSize: 15,
    fontFamily: 'Pretendard-Medium',
  },
  navSignupButton: {
    backgroundColor: DEEP_ROSE,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  navSignupText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
  },
  heroContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  heroTitle: {
    fontSize: 52,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 66,
    fontFamily: 'Pretendard-Bold',
    letterSpacing: 1,
  },
  heroTitleMobile: {
    fontSize: 32,
    lineHeight: 42,
  },
  heroSubtitle: {
    color: '#d1d5db',
    marginTop: 24,
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 28,
    fontFamily: 'Pretendard-Regular',
  },
  heroSubtitleMobile: {
    fontSize: 16,
    lineHeight: 24,
  },
  heroCta: {
    backgroundColor: DEEP_ROSE,
    borderRadius: 32,
    paddingHorizontal: 36,
    paddingVertical: 16,
    marginTop: 36,
  },
  heroCtaText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Pretendard-Bold',
  },

  // --- Sections ---
  section: {
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    fontFamily: 'Pretendard-Bold',
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 12,
    fontFamily: 'Pretendard-Regular',
  },

  // --- Features ---
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 24,
    marginTop: 48,
    maxWidth: 960,
    alignSelf: 'center',
    width: '100%',
  },
  featuresGridMobile: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  featureCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    width: 220,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  featureCardMobile: {
    width: '100%',
    maxWidth: 320,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: DEEP_ROSE_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    fontFamily: 'Pretendard-SemiBold',
    textAlign: 'center',
  },
  featureDesc: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Pretendard-Regular',
  },

  // --- Steps ---
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginTop: 48,
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
  },
  stepsRowMobile: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
  },
  stepCard: {
    alignItems: 'center',
    width: 200,
  },
  stepCardMobile: {
    width: '100%',
    maxWidth: 280,
  },
  stepNum: {
    fontSize: 36,
    fontWeight: '800',
    color: DEEP_ROSE,
    fontFamily: 'Pretendard-Bold',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 8,
    fontFamily: 'Pretendard-SemiBold',
  },
  stepDesc: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
    fontFamily: 'Pretendard-Regular',
  },

  // --- Preview ---
  previewGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginTop: 48,
  },
  previewGridMobile: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
  },
  phoneMockup: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },

  // --- CTA ---
  ctaSection: {
    backgroundColor: DEEP_ROSE,
    paddingVertical: 80,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 40,
    fontFamily: 'Pretendard-Bold',
  },
  ctaButtons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 32,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  ctaPrimary: {
    backgroundColor: '#fff',
    borderRadius: 32,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  ctaPrimaryText: {
    color: DEEP_ROSE,
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
  },
  ctaSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 32,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  ctaSecondaryText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
  },

  // --- Footer ---
  footer: {
    backgroundColor: '#111827',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  footerInner: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  footerLogoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    opacity: 0.7,
  },
  footerLogo: {
    height: 22,
    width: 80,
    opacity: 0.7,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  footerLink: {
    color: '#9ca3af',
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
  },
  footerDivider: {
    color: '#4b5563',
    fontSize: 14,
  },
  footerCopy: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 16,
    fontFamily: 'Pretendard-Regular',
  },
});
