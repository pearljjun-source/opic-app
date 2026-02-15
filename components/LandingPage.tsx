import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getLandingData } from '@/services/landing';
import type { LandingSection, LandingItem } from '@/lib/types';
import {
  Clock, Headphones, FileText, EyeSlash,
  PencilLine, Microphone, Lightning, TrendUp,
  Cpu, ChatCircle, Trophy, Users,
  UserPlus, Link as LinkIcon, ChartBar,
  ArrowRight, ArrowDown, CaretUp, CaretDown,
  Check, CheckCircle, CircleIcon,
  PlayCircle, BookOpen, User,
  GooglePlayLogo,
} from 'phosphor-react-native';

const ROSE = '#D4707F';
const ROSE_LIGHT = '#FDE8EB';
const DARK = '#111827';

// ============================================================================
// Animation helpers
// ============================================================================

function FadeInView({
  children,
  delay = 0,
  direction = 'up',
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'left' | 'right';
  style?: any;
}) {
  const opacity = useRef(new Animated.Value(Platform.OS === 'web' ? 0 : 1)).current;
  const translate = useRef(new Animated.Value(Platform.OS === 'web' ? (direction === 'up' ? 50 : direction === 'left' ? -50 : 50) : 0)).current;
  const viewRef = useRef<View>(null);
  const triggered = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = viewRef.current as unknown as Element;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered.current) {
          triggered.current = true;
          setTimeout(() => {
            Animated.parallel([
              Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: false }),
              Animated.timing(translate, { toValue: 0, duration: 700, useNativeDriver: false }),
            ]).start();
          }, delay);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [delay, opacity, translate]);

  const transform =
    direction === 'up'
      ? [{ translateY: translate }]
      : direction === 'left'
        ? [{ translateX: translate }]
        : [{ translateX: translate }];

  return (
    <Animated.View ref={viewRef as any} style={[{ opacity, transform }, style]}>
      {children}
    </Animated.View>
  );
}

function FloatingOrb({ size, color, top, left, duration }: {
  size: number; color: string; top: string; left: string; duration: number;
}) {
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: -25, duration, useNativeDriver: false }),
        Animated.timing(y, { toValue: 25, duration: duration * 1.1, useNativeDriver: false }),
        Animated.timing(y, { toValue: 0, duration: duration * 0.9, useNativeDriver: false }),
      ]),
    ).start();
  }, [y, duration]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        top: top as any,
        left: left as any,
        transform: [{ translateY: y }],
        ...(Platform.OS === 'web' ? { filter: `blur(${size * 0.4}px)` } as any : {}),
      }}
    />
  );
}

// ============================================================================
// Hero Background Animations (4 options — toggle with DEV switcher)
// ============================================================================
type HeroBgMode = 'blob' | 'glass' | 'aurora' | 'mesh';
const HERO_BG_LABELS: Record<HeroBgMode, string> = {
  blob: 'Blob',
  glass: 'Glass',
  aurora: 'Aurora',
  mesh: 'Mesh',
};

/** 1. Morphing Blob — organic gradient blobs that morph shape (Stripe/Linear style) */
function BlobBg() {
  const canvasRef = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let w = 0, h = 0, t = 0;

    const blobs = [
      { cx: 0.3, cy: 0.4, r: 220, color: [212, 112, 127], speed: 0.008, phase: 0 },
      { cx: 0.7, cy: 0.3, r: 180, color: [124, 58, 237], speed: 0.006, phase: 2 },
      { cx: 0.5, cy: 0.7, r: 200, color: [16, 185, 129], speed: 0.007, phase: 4 },
      { cx: 0.2, cy: 0.6, r: 160, color: [99, 102, 241], speed: 0.009, phase: 1.5 },
    ];

    const resize = () => {
      w = canvas.parentElement?.clientWidth || window.innerWidth;
      h = canvas.parentElement?.clientHeight || window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };

    const draw = () => {
      t += 1;
      ctx.clearRect(0, 0, w, h);

      for (const b of blobs) {
        const x = w * b.cx + Math.sin(t * b.speed + b.phase) * 80;
        const y = h * b.cy + Math.cos(t * b.speed * 1.3 + b.phase) * 60;
        const r = b.r + Math.sin(t * b.speed * 0.7 + b.phase * 2) * 40;

        // Draw 6 overlapping ellipses at different angles for organic shape
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI * 2 * i) / 6 + t * b.speed * 0.3;
          const stretch = 1.2 + Math.sin(t * b.speed + i) * 0.4;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);
          ctx.scale(stretch, 1 / stretch);
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${b.color.join(',')}, 0.06)`;
          ctx.fill();
          ctx.restore();
        }
      }
      animId = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  if (Platform.OS !== 'web') return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' } as any} />
    </View>
  );
}

/** 2. Floating Glass Cards — translucent cards with 3D tilt rotation */
function GlassBg() {
  const canvasRef = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let w = 0, h = 0, t = 0;

    const cards = Array.from({ length: 7 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      w: 80 + Math.random() * 100,
      h: 60 + Math.random() * 80,
      speed: 0.003 + Math.random() * 0.004,
      phase: Math.random() * Math.PI * 2,
      rotSpeed: 0.005 + Math.random() * 0.005,
      color: [[212, 112, 127], [124, 58, 237], [99, 102, 241], [16, 185, 129]][i % 4],
      radius: 12 + Math.random() * 8,
    }));

    const resize = () => {
      w = canvas.parentElement?.clientWidth || window.innerWidth;
      h = canvas.parentElement?.clientHeight || window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };

    const roundRect = (x: number, y: number, rw: number, rh: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + rw, y, x + rw, y + rh, r);
      ctx.arcTo(x + rw, y + rh, x, y + rh, r);
      ctx.arcTo(x, y + rh, x, y, r);
      ctx.arcTo(x, y, x + rw, y, r);
      ctx.closePath();
    };

    const draw = () => {
      t += 1;
      ctx.clearRect(0, 0, w, h);

      for (const c of cards) {
        const cx = w * c.x + Math.sin(t * c.speed + c.phase) * 50;
        const cy = h * c.y + Math.cos(t * c.speed * 0.8 + c.phase) * 40;
        const tilt = Math.sin(t * c.rotSpeed + c.phase) * 0.3;
        const scaleX = Math.cos(tilt);
        const depth = 0.5 + Math.sin(t * c.speed * 0.5 + c.phase) * 0.3;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.transform(scaleX, Math.sin(tilt) * 0.1, 0, 1, 0, 0);

        // Card shadow
        ctx.shadowColor = `rgba(${c.color.join(',')}, 0.15)`;
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 10;

        // Glass card
        const cw = c.w * (0.8 + depth * 0.4);
        const ch = c.h * (0.8 + depth * 0.4);
        roundRect(-cw / 2, -ch / 2, cw, ch, c.radius);
        ctx.fillStyle = `rgba(${c.color.join(',')}, ${0.05 + depth * 0.06})`;
        ctx.fill();

        // Glass border
        ctx.strokeStyle = `rgba(${c.color.join(',')}, ${0.08 + depth * 0.08})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner shine line
        roundRect(-cw / 2 + 4, -ch / 2 + 4, cw * 0.6, 1.5, 1);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.06 + depth * 0.06})`;
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.restore();
      }
      animId = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  if (Platform.OS !== 'web') return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' } as any} />
    </View>
  );
}

/** 3. Aurora / Northern Lights — flowing gradient ribbons (Vercel-inspired) */
function AuroraBg() {
  const canvasRef = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let w = 0, h = 0, t = 0;

    const bands = [
      { yBase: 0.35, amplitude: 80, wavelength: 400, speed: 0.015, color: [212, 112, 127], width: 120 },
      { yBase: 0.45, amplitude: 60, wavelength: 350, speed: 0.012, color: [124, 58, 237], width: 100 },
      { yBase: 0.55, amplitude: 70, wavelength: 450, speed: 0.018, color: [99, 102, 241], width: 90 },
      { yBase: 0.40, amplitude: 50, wavelength: 300, speed: 0.010, color: [16, 185, 129], width: 110 },
    ];

    const resize = () => {
      w = canvas.parentElement?.clientWidth || window.innerWidth;
      h = canvas.parentElement?.clientHeight || window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };

    const draw = () => {
      t += 1;
      ctx.clearRect(0, 0, w, h);

      for (const band of bands) {
        const y0 = h * band.yBase;

        // Draw ribbon as a filled path
        ctx.beginPath();
        ctx.moveTo(0, y0 + band.width / 2);

        // Top edge
        for (let x = 0; x <= w; x += 4) {
          const wave = Math.sin((x / band.wavelength) * Math.PI * 2 + t * band.speed) * band.amplitude;
          const wave2 = Math.sin((x / (band.wavelength * 0.7)) * Math.PI * 2 + t * band.speed * 1.3) * band.amplitude * 0.3;
          ctx.lineTo(x, y0 + wave + wave2 - band.width / 2);
        }

        // Bottom edge (reverse)
        for (let x = w; x >= 0; x -= 4) {
          const wave = Math.sin((x / band.wavelength) * Math.PI * 2 + t * band.speed) * band.amplitude;
          const wave2 = Math.sin((x / (band.wavelength * 0.7)) * Math.PI * 2 + t * band.speed * 1.3) * band.amplitude * 0.3;
          ctx.lineTo(x, y0 + wave + wave2 + band.width / 2);
        }

        ctx.closePath();

        // Gradient fill along x-axis
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        const [r, g, b] = band.color;
        grad.addColorStop(0, `rgba(${r},${g},${b}, 0)`);
        grad.addColorStop(0.2, `rgba(${r},${g},${b}, 0.08)`);
        grad.addColorStop(0.5, `rgba(${r},${g},${b}, 0.12)`);
        grad.addColorStop(0.8, `rgba(${r},${g},${b}, 0.08)`);
        grad.addColorStop(1, `rgba(${r},${g},${b}, 0)`);
        ctx.fillStyle = grad;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  if (Platform.OS !== 'web') return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' } as any} />
    </View>
  );
}

/** 4. Animated Gradient Mesh — 4-5 color blobs blending smoothly */
function MeshBg() {
  const canvasRef = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let w = 0, h = 0, t = 0;

    const spots = [
      { cx: 0.2, cy: 0.3, r: 300, color: [212, 112, 127], speed: 0.004, phase: 0 },
      { cx: 0.8, cy: 0.2, r: 280, color: [124, 58, 237], speed: 0.005, phase: 1 },
      { cx: 0.5, cy: 0.8, r: 320, color: [16, 185, 129], speed: 0.003, phase: 2 },
      { cx: 0.7, cy: 0.6, r: 260, color: [99, 102, 241], speed: 0.006, phase: 3 },
      { cx: 0.3, cy: 0.7, r: 240, color: [245, 158, 11], speed: 0.004, phase: 4 },
    ];

    const resize = () => {
      w = canvas.parentElement?.clientWidth || window.innerWidth;
      h = canvas.parentElement?.clientHeight || window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };

    const draw = () => {
      t += 1;
      ctx.clearRect(0, 0, w, h);

      for (const sp of spots) {
        const x = w * sp.cx + Math.sin(t * sp.speed + sp.phase) * 120;
        const y = h * sp.cy + Math.cos(t * sp.speed * 1.2 + sp.phase) * 90;
        const r = sp.r + Math.sin(t * sp.speed * 0.5 + sp.phase * 1.5) * 60;

        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        const [cr, cg, cb] = sp.color;
        grad.addColorStop(0, `rgba(${cr},${cg},${cb}, 0.14)`);
        grad.addColorStop(0.5, `rgba(${cr},${cg},${cb}, 0.06)`);
        grad.addColorStop(1, `rgba(${cr},${cg},${cb}, 0)`);

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  if (Platform.OS !== 'web') return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' } as any} />
    </View>
  );
}

/** Switcher component — renders selected bg + toggle buttons */
function HeroBgSwitcher({ mode, onSwitch }: { mode: HeroBgMode; onSwitch: (m: HeroBgMode) => void }) {
  if (Platform.OS !== 'web') return null;

  const BgComponent = { blob: BlobBg, glass: GlassBg, aurora: AuroraBg, mesh: MeshBg }[mode];

  return (
    <>
      <BgComponent />
      <View style={heroBgStyles.switcher}>
        {(Object.keys(HERO_BG_LABELS) as HeroBgMode[]).map((key) => (
          <Pressable
            key={key}
            style={[heroBgStyles.switchBtn, mode === key && heroBgStyles.switchBtnActive]}
            onPress={() => onSwitch(key)}
          >
            <Text style={[heroBgStyles.switchText, mode === key && heroBgStyles.switchTextActive]}>
              {HERO_BG_LABELS[key]}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

const heroBgStyles = StyleSheet.create({
  switcher: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 3,
    zIndex: 50,
    gap: 2,
  },
  switchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 17,
  },
  switchBtnActive: {
    backgroundColor: ROSE,
  },
  switchText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Pretendard-Medium',
  },
  switchTextActive: {
    color: '#fff',
  },
});

function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(Platform.OS === 'web' ? 0 : target);
  const viewRef = useRef<View>(null);
  const started = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = viewRef.current as unknown as Element;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const steps = 45;
          const inc = target / steps;
          let cur = 0;
          const timer = setInterval(() => {
            cur += inc;
            if (cur >= target) {
              setCount(target);
              clearInterval(timer);
            } else {
              setCount(Math.floor(cur));
            }
          }, 1400 / steps);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [target]);

  return (
    <View ref={viewRef}>
      <Text style={s.statNumber}>
        {count}
        {suffix}
      </Text>
    </View>
  );
}

function FAQItem({ item }: { item: { q: string; a: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      style={[s.faqItem, open && s.faqItemOpen]}
      onPress={() => setOpen(!open)}
    >
      <View style={s.faqRow}>
        <Text style={s.faqQ}>{item.q}</Text>
        {open ? <CaretUp size={20} color="#9ca3af" weight="bold" /> : <CaretDown size={20} color="#9ca3af" weight="bold" />}
      </View>
      {open && <Text style={s.faqA}>{item.a}</Text>}
    </Pressable>
  );
}

function HoverCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = useCallback(() => {
    Animated.spring(scale, { toValue: 1.03, useNativeDriver: false, friction: 8 }).start();
  }, [scale]);
  const onOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: false, friction: 8 }).start();
  }, [scale]);

  return (
    <Pressable onHoverIn={onIn} onHoverOut={onOut}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ============================================================================
// Data
// ============================================================================

const STATS = [
  { value: 336, suffix: '+', label: '자동화 테스트' },
  { value: 53, suffix: '개', label: 'AI 에러 분류' },
  { value: 6, suffix: '종', label: 'OPIc 질문 유형' },
  { value: 40, suffix: '분', label: '모의고사 시간' },
];

const PAIN_POINTS = [
  { Icon: Clock, title: '반복되는 스크립트 작성', desc: '학생마다 토픽별 맞춤 스크립트를 매번 만들고 수정하는 시간' },
  { Icon: Headphones, title: '실전 연습 환경 부재', desc: '수업 외 시간에 학생이 Ava 음성으로 연습할 도구가 없음' },
  { Icon: FileText, title: '피드백의 한계', desc: '녹음된 답변을 일일이 듣고 스크립트와 비교하는 건 현실적으로 불가능' },
  { Icon: EyeSlash, title: '학습 현황 블랙박스', desc: '누가 얼마나 연습했는지, 어디서 막히는지 데이터 기반 파악이 어려움' },
];

// 사진 교체 방법: image 필드에 require('@/assets/images/파일명.png') 넣기
// 예: image: require('@/assets/images/feature-script.png')
// image가 없으면 그라디언트 + 아이콘으로 표시
const FEATURES_NOW = [
  { Icon: PencilLine, image: null as any, title: '맞춤 스크립트', desc: '학생별 토픽 배정 + 스크립트 작성·관리를 한 곳에서' },
  { Icon: Microphone, image: null as any, title: 'Ava 음성 시뮬레이션', desc: 'OPIc 가상 진행자의 실제 음성으로 시험 환경 재현' },
  { Icon: Lightning, image: null as any, title: 'AI 자동 피드백', desc: '빠뜨린 표현, 문법 교정, 발음 팁까지 AI가 즉시 분석' },
  { Icon: TrendUp, image: null as any, title: '학습 기록 대시보드', desc: '학생별 연습 이력·점수·재현율을 한눈에 추적' },
];

const FEATURES_SOON = [
  { Icon: Cpu, title: 'AI 스크립트 생성', desc: '토픽만 고르면 AI가 수준별 스크립트를 자동 생성' },
  { Icon: ChatCircle, title: '3콤보 롤플레이', desc: 'OPIc 핵심 3콤보 상황극을 AI와 실시간 시뮬레이션' },
  { Icon: Trophy, title: '실전 모의고사', desc: '40분 12~15문항, 실제 시험과 동일한 환경' },
  { Icon: Users, title: '학원 멀티 관리', desc: '강사 여러 명이 학원 단위로 학생을 함께 관리' },
];

const STEPS = [
  { num: '01', Icon: UserPlus, title: '강사 등록', desc: '이메일로 간편 가입' },
  { num: '02', Icon: LinkIcon, title: '학생 초대', desc: '초대 코드 한 줄로 연결' },
  { num: '03', Icon: PencilLine, title: '스크립트 배정', desc: '토픽별 맞춤 작성' },
  { num: '04', Icon: ChartBar, title: '결과 확인', desc: 'AI 피드백 자동 수신' },
];

const ROADMAP = [
  { phase: 'Phase 1', status: 'live' as const, title: '강사-학생 맞춤 학습', items: ['강사-학생 연결 시스템', '맞춤 스크립트 작성', '실전 녹음 + AI 피드백', '학습 기록 관리'] },
  { phase: 'Phase 2', status: 'next' as const, title: '혼자서도 학습', items: ['AI 스크립트 자동 생성', '학습 통계 대시보드', '독학 모드', '다크모드 지원'] },
  { phase: 'Phase 3', status: 'planned' as const, title: '실전 시뮬레이션', items: ['3콤보 롤플레이', '실전 모의고사 40분', 'AI 실시간 대화', '성적 분석 리포트'] },
  { phase: 'Phase 4', status: 'planned' as const, title: '학원·기업 확장', items: ['멀티 강사 대시보드', '학원 조직 관리', '구독 서비스', 'iOS + 다국어'] },
];

const PRICING = [
  {
    name: 'Free', price: '₩0', period: '영구 무료', desc: '개인 강사 시작용',
    features: ['학생 5명 연결', '스크립트 작성·관리', '녹음 연습 + AI 피드백', '학습 기록 확인'],
    cta: '무료로 시작', highlighted: false,
  },
  {
    name: 'Pro', price: '₩29,900', period: '/월', desc: '전문 OPIc 강사용',
    features: ['학생 무제한', 'Free 전체 기능', 'AI 스크립트 자동 생성', '학습 통계 대시보드', '우선 지원'],
    cta: '프로 시작하기', highlighted: true,
  },
  {
    name: 'Academy', price: '문의', period: '', desc: '학원·기관 맞춤',
    features: ['멀티 강사 관리', '학원 대시보드', '맞춤 브랜딩', 'API 연동', '전담 매니저'],
    cta: '도입 문의', highlighted: false,
  },
];

const FAQ = [
  { q: 'Speaky는 어떤 서비스인가요?', a: 'OPIc 강사와 학원을 위한 AI 학습 관리 플랫폼입니다. 강사가 학생별 맞춤 스크립트를 작성하고, 학생은 Ava 음성으로 실전 연습을 하며, AI가 자동 피드백을 제공합니다.' },
  { q: '학생은 어떻게 가입하나요?', a: '강사가 발급한 초대 코드를 입력하면 자동으로 연결됩니다. 학생은 별도 결제 없이 배정된 스크립트로 바로 연습을 시작할 수 있어요.' },
  { q: 'AI 피드백은 어떤 방식인가요?', a: '녹음된 답변을 음성 인식(Whisper)으로 텍스트 변환 후, AI(Claude)가 원본 스크립트와 비교하여 빠뜨린 표현, 문법 교정, 발음 팁, 개선 제안 등을 자동 생성합니다.' },
  { q: '무료 플랜으로 충분한가요?', a: '학생 5명 이하라면 핵심 기능을 모두 무료로 사용할 수 있습니다. 학생 수가 늘거나 AI 스크립트 생성이 필요하면 Pro로 전환하세요.' },
  { q: '학원 단위로 도입할 수 있나요?', a: 'Academy 플랜으로 여러 강사와 학생을 조직 단위로 관리할 수 있습니다. 도입 문의를 남겨주시면 맞춤 안내를 드립니다.' },
];

// ============================================================================
// Main
// ============================================================================
export default function LandingPage() {

  const router = useRouter();
  const go = (path: string) => () => router.push(path as any);
  const { width } = useWindowDimensions();
  const mob = width < 768;
  const [heroBgMode, setHeroBgMode] = useState<HeroBgMode>('blob');
  const [dbSections, setDbSections] = useState<LandingSection[]>([]);
  const [dbItems, setDbItems] = useState<Record<string, LandingItem[]>>({});

  // DB에서 랜딩 데이터 로드 (실패 시 하드코딩 fallback)
  useEffect(() => {
    getLandingData().then(({ data }) => {
      if (data) {
        setDbSections(data.sections);
        setDbItems(data.items);
      }
    });
  }, []);

  // DB 데이터를 섹션별로 찾는 헬퍼
  const getSection = useCallback((key: string) =>
    dbSections.find(s => s.section_key === key), [dbSections]);

  const getItems = useCallback((key: string) => {
    const section = dbSections.find(s => s.section_key === key);
    return section ? (dbItems[section.id] || []) : [];
  }, [dbSections, dbItems]);

  // DB 기반 동적 pricing (fallback: 하드코딩)
  const pricingData = useMemo(() => {
    const dbPricingItems = getItems('pricing');
    if (dbPricingItems.length > 0) {
      return dbPricingItems.map(item => ({
        name: item.title,
        price: (item.metadata as any)?.price || '₩0',
        period: (item.metadata as any)?.period || '',
        desc: item.description || '',
        features: ((item.metadata as any)?.features as string[]) || [],
        cta: (item.metadata as any)?.cta || '시작하기',
        highlighted: (item.metadata as any)?.highlighted === true,
      }));
    }
    return PRICING;
  }, [getItems]);

  // DB 기반 동적 FAQ (fallback: 하드코딩)
  const faqData = useMemo(() => {
    const dbFaqItems = getItems('faq');
    if (dbFaqItems.length > 0) {
      return dbFaqItems.map(item => ({
        q: item.title,
        a: item.description || '',
      }));
    }
    return FAQ;
  }, [getItems]);

  // DB 기반 동적 Stats (fallback: 하드코딩)
  const statsData = useMemo(() => {
    const dbStatsItems = getItems('stats');
    if (dbStatsItems.length > 0) {
      return dbStatsItems.map(item => ({
        value: (item.metadata as any)?.value || 0,
        suffix: (item.metadata as any)?.suffix || '',
        label: item.title,
      }));
    }
    return STATS;
  }, [getItems]);


  return (
    <ScrollView style={s.root}>
      {/* ── Hero ────────────────────────────────────── */}
      <View style={[s.hero, Platform.OS === 'web' && ({ minHeight: '100vh' } as any)]}>
        {/* Floating orbs */}
        <FloatingOrb size={300} color="rgba(212,112,127,0.15)" top="10%" left="5%" duration={4000} />
        <FloatingOrb size={200} color="rgba(99,102,241,0.12)" top="60%" left="70%" duration={5000} />
        <FloatingOrb size={150} color="rgba(16,185,129,0.10)" top="30%" left="80%" duration={3500} />

        {/* Hero background animation */}
        <HeroBgSwitcher mode={heroBgMode} onSwitch={setHeroBgMode} />

        {/* Nav */}
        <View style={s.nav}>
          <View style={s.navInner}>
            <View style={s.navLogoGroup}>
              <Image source={require('@/assets/images/speaky-icon.png')} style={s.navIcon} />
              <Image source={require('@/assets/images/speaky-text-logo.png')} style={s.navTextLogo} resizeMode="contain" />
            </View>
            <View style={s.navRight}>
              <Pressable onPress={go('/(auth)/login')}>
                <Text style={s.navLink}>로그인</Text>
              </Pressable>
              <Pressable style={s.navCta} onPress={go('/(auth)/signup')}>
                <Text style={s.navCtaText}>무료 체험</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Hero content */}
        <View style={s.heroBody}>
          <FadeInView delay={300}>
            <Text style={[s.heroTitle, mob && s.heroTitleM]}>
              OPIc 수업,{'\n'}
              <Text style={{ color: ROSE }}>AI가 함께</Text> 합니다
            </Text>
          </FadeInView>

          <FadeInView delay={600}>
            <View style={s.heroButtons}>
              <Pressable style={s.heroBtn} onPress={go('/(auth)/signup')}>
                <Text style={s.heroBtnText}>무료로 시작하기</Text>
                <ArrowRight size={18} color="#fff" weight="bold" />
              </Pressable>
              <Pressable style={s.heroBtnOutline}>
                <GooglePlayLogo size={18} color="#e8b4bb" weight="duotone" />
                <Text style={s.heroBtnOutlineText}>앱 다운로드</Text>
              </Pressable>
            </View>
          </FadeInView>
        </View>
      </View>

      {/* ── About ──────────────────────────────────── */}
      <View style={s.section}>
        <FadeInView>
          <Text style={s.secLabel}>SERVICE</Text>
          <Text style={[s.secTitle, { lineHeight: 48 }]}>
            강사가 만들고, AI가 돕고,{'\n'}학생이 성장합니다
          </Text>
        </FadeInView>

        <View style={[s.aboutRow, mob && s.aboutRowM]}>
          <FadeInView delay={0} direction="left" style={[s.aboutCard, mob && s.aboutCardM]}>
            <View style={[s.aboutIcon, { backgroundColor: '#EDE9FE' }]}>
              <User size={26} color="#7C3AED" weight="duotone" />
            </View>
            <Text style={s.aboutName}>강사</Text>
            <Text style={s.aboutDesc}>학생별 토픽 배정{'\n'}맞춤 스크립트 작성</Text>
          </FadeInView>

          {!mob && <View style={s.aboutConnector}><View style={s.aboutLine} /><ArrowRight size={16} color="#d1d5db" weight="bold" /></View>}
          {mob && <ArrowDown size={20} color="#d1d5db" weight="bold" style={{ alignSelf: 'center', marginVertical: 8 } as any} />}

          <FadeInView delay={200} style={[s.aboutCard, s.aboutCardCenter, mob && s.aboutCardM]}>
            <View style={[s.aboutIcon, { backgroundColor: ROSE_LIGHT }]}>
              <Lightning size={26} color={ROSE} weight="duotone" />
            </View>
            <Text style={s.aboutName}>Speaky AI</Text>
            <Text style={s.aboutDesc}>Ava 음성 · STT 분석{'\n'}자동 피드백 생성</Text>
          </FadeInView>

          {!mob && <View style={s.aboutConnector}><View style={s.aboutLine} /><ArrowRight size={16} color="#d1d5db" weight="bold" /></View>}
          {mob && <ArrowDown size={20} color="#d1d5db" weight="bold" style={{ alignSelf: 'center', marginVertical: 8 } as any} />}

          <FadeInView delay={400} direction="right" style={[s.aboutCard, mob && s.aboutCardM]}>
            <View style={[s.aboutIcon, { backgroundColor: '#D1FAE5' }]}>
              <BookOpen size={26} color="#059669" weight="duotone" />
            </View>
            <Text style={s.aboutName}>학생</Text>
            <Text style={s.aboutDesc}>실전 녹음 연습{'\n'}AI 피드백으로 성장</Text>
          </FadeInView>
        </View>

        {/* 소개 영상/이미지 */}
        <FadeInView delay={300}>
          <View style={[s.mediaWrap, mob && s.mediaWrapM]}>
            {Platform.OS === 'web' ? (
              <View style={[s.mediaFrame, mob && s.mediaFrameM]}>
                {/*
                  영상 교체 방법:
                  1) YouTube → iframe의 src를 교체
                  2) 직접 영상 → <video src="..." /> 로 교체
                  3) 이미지 → <Image source={require('@/assets/images/demo.png')} style={...} /> 로 교체
                */}
                <iframe
                  src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
                  title="Speaky 소개"
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    borderRadius: 16,
                  } as any}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </View>
            ) : (
              <View style={[s.mediaPlaceholder, mob && s.mediaFrameM]}>
                <PlayCircle size={48} color={ROSE} weight="duotone" />
                <Text style={s.mediaPlaceholderText}>소개 영상 보기</Text>
              </View>
            )}
          </View>
        </FadeInView>
      </View>

      {/* ── Problem ────────────────────────────────── */}
      <View style={[s.section, { backgroundColor: '#f8f7f4' }]}>
        <FadeInView>
          <Text style={s.secLabel}>PROBLEM</Text>
          <Text style={s.secTitle}>
            이런 고민,{'\n'}혹시 겪고 계신가요?
          </Text>
        </FadeInView>
        <View style={[s.painGrid, mob && s.painGridM]}>
          {PAIN_POINTS.map((p, i) => (
            <FadeInView key={i} delay={i * 120} style={mob ? { width: '100%' } : {}}>
              <HoverCard style={[s.painCard, mob && s.painCardM]}>
                <View style={s.painIconBox}>
                  <p.Icon size={20} color={ROSE} weight="duotone" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.painTitle}>{p.title}</Text>
                  <Text style={s.painDesc}>{p.desc}</Text>
                </View>
              </HoverCard>
            </FadeInView>
          ))}
        </View>
      </View>

      {/* ── Stats Band ─────────────────────────────── */}
      <View style={s.statsBand}>
        {statsData.map((st, i) => (
          <View key={i} style={s.statItem}>
            <CountUp target={st.value} suffix={st.suffix} />
            <Text style={s.statLabel}>{st.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Features ────────────────────────────────── */}
      <View style={s.featSection}>
        <FadeInView>
          <Text style={s.featSecLabel}>FEATURES</Text>
          <Text style={s.featSecTitle}>
            지금 바로 사용할 수 있는 기능
          </Text>
          <Text style={s.featSecSub}>
            현재 총 <Text style={{ color: ROSE, fontFamily: 'Pretendard-Bold' }}>{FEATURES_NOW.length}가지</Text> 핵심 기능을 제공하고 있습니다.
          </Text>
        </FadeInView>

        {/* Gallery row */}
        <View style={[s.featGallery, mob && s.featGalleryM]}>
          {FEATURES_NOW.map((f, i) => {
            const colors = [
              ['#4C1D95', '#7C3AED'],  // 보라
              [DARK, ROSE],            // 다크→로즈
              ['#064E3B', '#10B981'],   // 에메랄드
              ['#1E3A5F', '#3B82F6'],   // 블루
            ];
            const [bg1, bg2] = colors[i % colors.length];
            return (
              <FadeInView key={i} delay={i * 120}>
                <HoverCard style={[s.featVisualCard, mob && s.featVisualCardM]}>
                  {f.image ? (
                    <Image source={f.image} style={s.featVisualImg} resizeMode="cover" />
                  ) : (
                    <View style={[
                      s.featVisualTop,
                      Platform.OS === 'web'
                        ? { background: `linear-gradient(135deg, ${bg1}, ${bg2})` } as any
                        : { backgroundColor: bg2 },
                    ]}>
                      <f.Icon size={40} color="rgba(255,255,255,0.9)" weight="duotone" duotoneColor="rgba(255,255,255,0.4)" />
                    </View>
                  )}
                  <View style={s.featVisualBottom}>
                    <Text style={s.featVisualTitle}>{f.title}</Text>
                    <Text style={s.featVisualDesc}>{f.desc}</Text>
                  </View>
                </HoverCard>
              </FadeInView>
            );
          })}
        </View>

        {/* Coming Soon */}
        <FadeInView delay={300}>
          <Text style={s.featComingSoon}>Coming Soon</Text>
        </FadeInView>
        <View style={[s.featSoonRow, mob && s.featSoonRowM]}>
          {FEATURES_SOON.map((f, i) => (
            <FadeInView key={i} delay={400 + i * 80}>
              <View style={[s.featSoonCard, mob && s.featSoonCardM]}>
                <View style={s.featSoonIcon}>
                  <f.Icon size={18} color={ROSE} weight="duotone" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.featSoonTitle}>{f.title}</Text>
                  <Text style={s.featSoonDesc}>{f.desc}</Text>
                </View>
              </View>
            </FadeInView>
          ))}
        </View>
      </View>

      {/* ── How It Works ───────────────────────────── */}
      <View style={[s.section, { backgroundColor: '#f9fafb' }]}>
        <FadeInView>
          <Text style={s.secLabel}>HOW IT WORKS</Text>
          <Text style={s.secTitle}>5분이면 시작할 수 있어요</Text>
        </FadeInView>
        <View style={[s.stepsRow, mob && s.stepsRowM]}>
          {STEPS.map((st, i) => (
            <FadeInView key={i} delay={i * 150} style={s.stepWrap}>
              <View style={s.stepCircle}>
                <st.Icon size={24} color={ROSE} weight="duotone" />
              </View>
              {i < STEPS.length - 1 && !mob && <View style={s.stepLine} />}
              <Text style={s.stepNum}>{st.num}</Text>
              <Text style={s.stepTitle}>{st.title}</Text>
              <Text style={s.stepDesc}>{st.desc}</Text>
            </FadeInView>
          ))}
        </View>
      </View>

      {/* ── Roadmap ────────────────────────────────── */}
      <View style={s.section}>
        <FadeInView>
          <Text style={s.secLabel}>ROADMAP</Text>
          <Text style={s.secTitle}>계속 진화합니다</Text>
          <Text style={s.secSub}>Speaky는 OPIc 학습의 모든 영역으로 확장됩니다</Text>
        </FadeInView>
        <View style={[s.rmGrid, mob && s.rmGridM]}>
          {ROADMAP.map((r, i) => (
            <FadeInView key={i} delay={i * 120}>
              <HoverCard style={[s.rmCard, mob && s.rmCardM]}>
                <View style={s.rmHeader}>
                  <Text style={s.rmPhase}>{r.phase}</Text>
                  <View style={[s.rmBadge, r.status === 'live' && s.rmBadgeLive, r.status === 'next' && s.rmBadgeNext]}>
                    <Text style={[s.rmBadgeText, r.status === 'live' && { color: '#059669' }, r.status === 'next' && { color: '#2563EB' }]}>
                      {r.status === 'live' ? '사용 가능' : r.status === 'next' ? '개발 중' : '예정'}
                    </Text>
                  </View>
                </View>
                <Text style={s.rmTitle}>{r.title}</Text>
                {r.items.map((item, j) => (
                  <View key={j} style={s.rmItem}>
                    {r.status === 'live'
                      ? <CheckCircle size={14} color="#10B981" weight="duotone" />
                      : <CircleIcon size={14} color="#d1d5db" weight="regular" />
                    }
                    <Text style={s.rmItemText}>{item}</Text>
                  </View>
                ))}
              </HoverCard>
            </FadeInView>
          ))}
        </View>
      </View>

      {/* ── Pricing ────────────────────────────────── */}
      <View style={[s.section, { backgroundColor: '#f9fafb' }]}>
        <FadeInView>
          <Text style={s.secLabel}>PRICING</Text>
          <Text style={s.secTitle}>합리적인 요금제</Text>
          <Text style={s.secSub}>부담 없이 시작하고, 성장에 맞춰 확장하세요</Text>
        </FadeInView>
        <View style={[s.priceGrid, mob && s.priceGridM]}>
          {pricingData.map((p, i) => (
            <FadeInView key={i} delay={i * 150}>
              <HoverCard style={[s.priceCard, mob && s.priceCardM, p.highlighted && s.priceHL]}>
                {p.highlighted && (
                  <View style={s.pricePopular}>
                    <Text style={s.pricePopularText}>추천</Text>
                  </View>
                )}
                <Text style={s.priceName}>{p.name}</Text>
                <View style={s.priceRow}>
                  <Text style={[s.priceVal, p.highlighted && { color: ROSE }]}>{p.price}</Text>
                  {p.period ? <Text style={s.pricePer}>{p.period}</Text> : null}
                </View>
                <Text style={s.priceDesc}>{p.desc}</Text>
                <View style={s.priceDivider} />
                {p.features.map((f, j) => (
                  <View key={j} style={s.priceFeat}>
                    <Check size={15} color={p.highlighted ? ROSE : '#10B981'} weight="bold" />
                    <Text style={s.priceFeatText}>{f}</Text>
                  </View>
                ))}
                <Pressable style={[s.priceCta, p.highlighted && s.priceCtaHL]} onPress={go('/(auth)/signup')}>
                  <Text style={[s.priceCtaText, p.highlighted && { color: '#fff' }]}>{p.cta}</Text>
                </Pressable>
              </HoverCard>
            </FadeInView>
          ))}
        </View>
      </View>

      {/* ── FAQ ────────────────────────────────────── */}
      <View style={s.section}>
        <FadeInView>
          <Text style={s.secLabel}>FAQ</Text>
          <Text style={s.secTitle}>자주 묻는 질문</Text>
        </FadeInView>
        <FadeInView delay={200}>
          <View style={s.faqList}>
            {faqData.map((item, i) => (
              <FAQItem key={i} item={item} />
            ))}
          </View>
        </FadeInView>
      </View>

      {/* ── CTA ────────────────────────────────────── */}
      <View style={s.cta}>
        <FadeInView>
          <Text style={[s.ctaTitle, mob && s.ctaTitleM]}>
            OPIc 수업의 새로운 기준,{'\n'}Speaky와 시작하세요
          </Text>
          <Text style={s.ctaSub}>카드 등록 없이, 지금 바로 무료로 체험해 보세요</Text>
          <View style={s.ctaButtons}>
            <Pressable style={s.ctaBtn} onPress={go('/(auth)/signup')}>
              <Text style={s.ctaBtnText}>무료로 시작하기</Text>
            </Pressable>
            <Pressable style={s.ctaBtnOutline}>
              <GooglePlayLogo size={18} color="#fff" weight="duotone" />
              <Text style={s.ctaBtnOutlineText}>앱 다운로드</Text>
            </Pressable>
          </View>
        </FadeInView>
      </View>

      {/* ── Footer ─────────────────────────────────── */}
      <View style={s.footer}>
        <View style={s.footerInner}>
          <View style={s.footerLogos}>
            <Image source={require('@/assets/images/speaky-icon.png')} style={s.footerIcon} />
            <Image source={require('@/assets/images/speaky-text-logo.png')} style={s.footerText} resizeMode="contain" />
          </View>
          <Text style={s.footerTag}>OPIc 강사·학원을 위한 AI 학습 관리 플랫폼</Text>
          <View style={s.footerLinks}>
            <Pressable><Text style={s.footerLink}>개인정보처리방침</Text></Pressable>
            <Text style={s.footerDiv}>|</Text>
            <Pressable><Text style={s.footerLink}>이용약관</Text></Pressable>
            <Text style={s.footerDiv}>|</Text>
            <Pressable><Text style={s.footerLink}>문의하기</Text></Pressable>
          </View>
          <Text style={s.footerCopy}>© 2026 Speaky. All rights reserved.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ============================================================================
// Styles
// ============================================================================
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  // ── Hero ──
  hero: { minHeight: 720, backgroundColor: DARK, position: 'relative', overflow: 'hidden' },
  nav: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12, zIndex: 10 },
  navInner: { maxWidth: 1200, width: '100%', alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navLogoGroup: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  navIcon: { width: 54, height: 54, borderRadius: 27 },
  navTextLogo: { height: 68, width: 240 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  navLink: { color: '#9ca3af', fontSize: 15, fontFamily: 'Pretendard-Medium' },
  navCta: { backgroundColor: ROSE, borderRadius: 22, paddingHorizontal: 20, paddingVertical: 9 },
  navCtaText: { color: '#fff', fontSize: 14, fontFamily: 'Pretendard-SemiBold' },

  heroBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 60, zIndex: 10 },
  heroTitle: { fontSize: 56, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 72, fontFamily: 'Pretendard-Bold', letterSpacing: -0.5 },
  heroTitleM: { fontSize: 36, lineHeight: 50 },
  heroButtons: { flexDirection: 'row', gap: 12, marginTop: 48, flexWrap: 'wrap', justifyContent: 'center' },
  heroBtn: { backgroundColor: ROSE, borderRadius: 26, paddingHorizontal: 28, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Pretendard-Bold' },
  heroBtnOutline: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(212,112,127,0.35)', borderRadius: 26, paddingHorizontal: 22, paddingVertical: 14 },
  heroBtnOutlineText: { color: '#e8b4bb', fontSize: 15, fontFamily: 'Pretendard-Medium' },

  // ── Section common ──
  section: { paddingVertical: 80, paddingHorizontal: 24 },
  secLabel: { fontSize: 12, fontFamily: 'Pretendard-Bold', color: ROSE, textAlign: 'center', letterSpacing: 3, marginBottom: 14, textTransform: 'uppercase' },
  secTitle: { fontSize: 32, fontWeight: '700', color: DARK, textAlign: 'center', fontFamily: 'Pretendard-Bold', lineHeight: 44 },
  secSub: { fontSize: 16, color: '#6b7280', textAlign: 'center', marginTop: 10, fontFamily: 'Pretendard-Regular', lineHeight: 24 },

  // ── About ──
  aboutRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 48, maxWidth: 840, alignSelf: 'center', width: '100%', gap: 0 },
  aboutRowM: { flexDirection: 'column' },
  aboutCard: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  aboutCardCenter: { borderColor: ROSE_LIGHT, borderWidth: 2 },
  aboutCardM: { width: '100%', maxWidth: 360 },
  aboutIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  aboutName: { fontSize: 18, fontFamily: 'Pretendard-Bold', color: DARK, marginBottom: 6 },
  aboutDesc: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22, fontFamily: 'Pretendard-Regular' },
  aboutConnector: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 4 },
  aboutLine: { width: 24, height: 1, backgroundColor: '#e5e7eb' },
  mediaWrap: { marginTop: 56, alignItems: 'center' },
  mediaWrapM: { marginTop: 40 },
  mediaFrame: { width: '100%', maxWidth: 800, aspectRatio: 16 / 9, borderRadius: 16, overflow: 'hidden', backgroundColor: '#0a0a0a', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 32, elevation: 8, alignSelf: 'center' },
  mediaFrameM: { maxWidth: '100%' },
  mediaPlaceholder: { width: '100%', maxWidth: 800, aspectRatio: 16 / 9, borderRadius: 16, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', borderWidth: 2, borderColor: '#e5e7eb', borderStyle: 'dashed' },
  mediaPlaceholderText: { fontSize: 15, color: '#6b7280', marginTop: 12, fontFamily: 'Pretendard-Medium' },

  // ── Problem ──
  painGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 48, maxWidth: 860, alignSelf: 'center', width: '100%' },
  painGridM: { flexDirection: 'column', alignItems: 'center' },
  painCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, backgroundColor: '#fff', borderRadius: 16, padding: 22, width: 400, borderWidth: 1, borderColor: '#eeece6' },
  painCardM: { width: '100%', maxWidth: 420 },
  painIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: ROSE_LIGHT, justifyContent: 'center', alignItems: 'center' },
  painTitle: { fontSize: 15, fontFamily: 'Pretendard-SemiBold', color: DARK, marginBottom: 4 },
  painDesc: { fontSize: 13, color: '#6b7280', lineHeight: 20, fontFamily: 'Pretendard-Regular' },

  // ── Stats ──
  statsBand: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', backgroundColor: DARK, paddingVertical: 40, paddingHorizontal: 24, gap: 8 },
  statItem: { alignItems: 'center', width: 160, paddingVertical: 12 },
  statNumber: { fontSize: 36, fontFamily: 'Pretendard-Bold', color: ROSE },
  statLabel: { fontSize: 14, color: '#9ca3af', marginTop: 4, fontFamily: 'Pretendard-Regular' },

  // ── Features (dark gallery) ──
  featSection: { backgroundColor: DARK, paddingVertical: 80, paddingHorizontal: 24 },
  featSecLabel: { fontSize: 12, fontFamily: 'Pretendard-Bold', color: ROSE, textAlign: 'center', letterSpacing: 3, marginBottom: 14, textTransform: 'uppercase' },
  featSecTitle: { fontSize: 32, fontWeight: '700', color: '#fff', textAlign: 'center', fontFamily: 'Pretendard-Bold', lineHeight: 44 },
  featSecSub: { fontSize: 16, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 10, fontFamily: 'Pretendard-Regular', lineHeight: 24 },

  featGallery: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 48, maxWidth: 1000, alignSelf: 'center', width: '100%' },
  featGalleryM: { flexDirection: 'column', alignItems: 'center' },
  featVisualCard: { width: 230, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1a1a2e' },
  featVisualCardM: { width: '100%', maxWidth: 340 },
  featVisualTop: { height: 180, justifyContent: 'center', alignItems: 'center' },
  featVisualImg: { width: '100%', height: 180 },
  featVisualBottom: { padding: 20 },
  featVisualTitle: { fontSize: 16, fontFamily: 'Pretendard-Bold', color: '#fff', marginBottom: 6 },
  featVisualDesc: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20, fontFamily: 'Pretendard-Regular' },

  featComingSoon: { fontSize: 14, fontFamily: 'Pretendard-Bold', color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 56, marginBottom: 20, letterSpacing: 2 },
  featSoonRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, maxWidth: 800, alignSelf: 'center', width: '100%' },
  featSoonRowM: { flexDirection: 'column', alignItems: 'center' },
  featSoonCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 20, width: 380, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  featSoonCardM: { width: '100%', maxWidth: 400 },
  featSoonIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(212,112,127,0.15)', justifyContent: 'center', alignItems: 'center' },
  featSoonTitle: { fontSize: 14, fontFamily: 'Pretendard-SemiBold', color: '#fff' },
  featSoonDesc: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Pretendard-Regular', marginTop: 2 },

  // ── Steps ──
  stepsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 48, maxWidth: 900, alignSelf: 'center', width: '100%' },
  stepsRowM: { flexDirection: 'column', alignItems: 'center', gap: 32 },
  stepWrap: { alignItems: 'center', width: 180, position: 'relative' },
  stepCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: ROSE_LIGHT, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  stepLine: { position: 'absolute', top: 30, left: 140, width: 80, height: 1, backgroundColor: '#e5e7eb' },
  stepNum: { fontSize: 12, fontFamily: 'Pretendard-Bold', color: ROSE, marginBottom: 4 },
  stepTitle: { fontSize: 16, fontFamily: 'Pretendard-SemiBold', color: DARK, marginBottom: 4 },
  stepDesc: { fontSize: 13, color: '#6b7280', textAlign: 'center', fontFamily: 'Pretendard-Regular' },

  // ── Roadmap ──
  rmGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 48, maxWidth: 1000, alignSelf: 'center', width: '100%' },
  rmGridM: { flexDirection: 'column', alignItems: 'center' },
  rmCard: { backgroundColor: '#fff', borderRadius: 18, padding: 24, width: 228, borderWidth: 1, borderColor: '#f3f4f6' },
  rmCardM: { width: '100%', maxWidth: 400 },
  rmHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  rmPhase: { fontSize: 12, fontFamily: 'Pretendard-Bold', color: '#9ca3af', letterSpacing: 1 },
  rmBadge: { backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  rmBadgeLive: { backgroundColor: '#D1FAE5' },
  rmBadgeNext: { backgroundColor: '#DBEAFE' },
  rmBadgeText: { fontSize: 11, fontFamily: 'Pretendard-SemiBold', color: '#9ca3af' },
  rmTitle: { fontSize: 16, fontFamily: 'Pretendard-SemiBold', color: DARK, marginBottom: 12 },
  rmItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  rmItemText: { fontSize: 13, color: '#4b5563', fontFamily: 'Pretendard-Regular' },

  // ── Pricing ──
  priceGrid: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 48, maxWidth: 1000, alignSelf: 'center', width: '100%', alignItems: 'flex-start' },
  priceGridM: { flexDirection: 'column', alignItems: 'center' },
  priceCard: { backgroundColor: '#fff', borderRadius: 20, padding: 28, width: 300, borderWidth: 1, borderColor: '#e5e7eb', position: 'relative' },
  priceCardM: { width: '100%', maxWidth: 360 },
  priceHL: { borderColor: ROSE, borderWidth: 2, shadowColor: ROSE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 6 },
  pricePopular: { position: 'absolute', top: -12, right: 24, backgroundColor: ROSE, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4 },
  pricePopularText: { color: '#fff', fontSize: 12, fontFamily: 'Pretendard-Bold' },
  priceName: { fontSize: 18, fontFamily: 'Pretendard-Bold', color: DARK },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 8 },
  priceVal: { fontSize: 32, fontFamily: 'Pretendard-Bold', color: DARK },
  pricePer: { fontSize: 14, color: '#6b7280', fontFamily: 'Pretendard-Regular' },
  priceDesc: { fontSize: 13, color: '#6b7280', marginTop: 8, fontFamily: 'Pretendard-Regular' },
  priceDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 20 },
  priceFeat: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  priceFeatText: { fontSize: 14, color: '#374151', fontFamily: 'Pretendard-Regular' },
  priceCta: { marginTop: 20, paddingVertical: 13, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#d1d5db' },
  priceCtaHL: { backgroundColor: ROSE, borderColor: ROSE },
  priceCtaText: { fontSize: 15, fontFamily: 'Pretendard-SemiBold', color: DARK },

  // ── FAQ ──
  faqList: { maxWidth: 680, alignSelf: 'center', width: '100%', marginTop: 40 },
  faqItem: { backgroundColor: '#fafafa', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 20, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0' },
  faqItemOpen: { backgroundColor: '#fff', borderColor: '#e5e7eb', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  faqRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQ: { fontSize: 15, fontFamily: 'Pretendard-SemiBold', color: DARK, flex: 1, paddingRight: 12 },
  faqA: { fontSize: 14, color: '#6b7280', lineHeight: 22, fontFamily: 'Pretendard-Regular', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' },

  // ── CTA ──
  cta: { backgroundColor: ROSE, paddingVertical: 80, paddingHorizontal: 24, alignItems: 'center' },
  ctaTitle: { fontSize: 32, fontWeight: '700', color: '#fff', textAlign: 'center', lineHeight: 44, fontFamily: 'Pretendard-Bold' },
  ctaTitleM: { fontSize: 24, lineHeight: 34 },
  ctaSub: { color: 'rgba(255,255,255,0.75)', fontSize: 16, marginTop: 12, textAlign: 'center', fontFamily: 'Pretendard-Regular' },
  ctaButtons: { flexDirection: 'row', gap: 14, marginTop: 32, flexWrap: 'wrap', justifyContent: 'center' },
  ctaBtn: { backgroundColor: '#fff', borderRadius: 26, paddingHorizontal: 32, paddingVertical: 15 },
  ctaBtnText: { color: ROSE, fontSize: 16, fontFamily: 'Pretendard-Bold' },
  ctaBtnOutline: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: '#fff', borderRadius: 26, paddingHorizontal: 24, paddingVertical: 13 },
  ctaBtnOutlineText: { color: '#fff', fontSize: 15, fontFamily: 'Pretendard-SemiBold' },

  // ── Footer ──
  footer: { backgroundColor: DARK, paddingVertical: 40, paddingHorizontal: 24 },
  footerInner: { maxWidth: 1200, width: '100%', alignSelf: 'center', alignItems: 'center' },
  footerLogos: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerIcon: { width: 28, height: 28, borderRadius: 14, opacity: 0.6 },
  footerText: { height: 22, width: 80, opacity: 0.6 },
  footerTag: { color: '#4b5563', fontSize: 13, marginTop: 10, fontFamily: 'Pretendard-Regular' },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  footerLink: { color: '#6b7280', fontSize: 14, fontFamily: 'Pretendard-Regular' },
  footerDiv: { color: '#374151', fontSize: 14 },
  footerCopy: { color: '#4b5563', fontSize: 13, marginTop: 16, fontFamily: 'Pretendard-Regular' },
});
