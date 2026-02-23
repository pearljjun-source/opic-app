/**
 * 웹 환경 녹음 플로우 + 오디오 재생/정지 시뮬레이션 테스트
 *
 * 검증 항목:
 * - P1: 웹 FormData 업로드 수정 검증 (Platform 분기 + fetch blob)
 * - P2: 웹 파일 확장자 (.webm) 검증
 * - P3: 오디오 재생 정지 버튼 + 화면 이탈 시 cleanup
 * - P4: handleStopRecording 에러 처리 경로
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// P1: uploadRecording 웹 FormData 수정 검증
// ============================================================================

describe('uploadRecording 웹 호환성 (수정 후)', () => {
  const practicesServicePath = path.resolve(__dirname, '../../services/practices.ts');
  let practicesService: string;

  beforeAll(() => {
    practicesService = fs.readFileSync(practicesServicePath, 'utf8');
  });

  it('Platform import가 있다', () => {
    expect(practicesService).toContain("import { Platform } from 'react-native'");
  });

  it('웹 전용 blob fetch 코드가 있다', () => {
    expect(practicesService).toContain("Platform.OS === 'web'");
    expect(practicesService).toContain('await fetch(uri)');
    expect(practicesService).toContain('await response.blob()');
  });

  it('웹에서 Blob을 직접 upload한다', () => {
    expect(practicesService).toContain('.upload(filePath, blob,');
  });

  it('네이티브에서 기존 FormData 패턴을 유지한다', () => {
    expect(practicesService).toContain("formData.append('',");
    expect(practicesService).toContain("type: 'audio/m4a'");
  });

  it('웹의 contentType이 audio/webm이다', () => {
    expect(practicesService).toContain("blob.type || 'audio/webm'");
  });
});

// ============================================================================
// P2: 웹 파일 확장자 검증
// ============================================================================

describe('practice.tsx 웹 파일 확장자', () => {
  const practiceScreenPath = path.resolve(__dirname, '../../app/(student)/script/[id]/practice.tsx');
  let practiceScreen: string;

  beforeAll(() => {
    practiceScreen = fs.readFileSync(practiceScreenPath, 'utf8');
  });

  it('Platform.OS로 확장자를 분기한다', () => {
    expect(practiceScreen).toContain("Platform.OS === 'web' ? 'webm' : 'm4a'");
  });

  it('동적 확장자를 파일명에 사용한다', () => {
    expect(practiceScreen).toContain('`practice_${Date.now()}.${ext}`');
  });
});

// ============================================================================
// P3: 오디오 재생 정지 + 화면 이탈 cleanup 검증
// ============================================================================

describe('기록 상세 [practiceId].tsx: 오디오 정지', () => {
  const detailPath = path.resolve(__dirname, '../../app/(student)/script/practice/[practiceId].tsx');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(detailPath, 'utf8');
  });

  it('soundRef가 선언되어 있다', () => {
    expect(content).toContain('const soundRef = useRef<Audio.Sound | null>(null)');
  });

  it('useEffect cleanup에서 sound를 unload한다', () => {
    expect(content).toContain('soundRef.current');
    expect(content).toContain('soundRef.current.unloadAsync()');
  });

  it('화면 이탈 시 cleanup이 useEffect return에 있다', () => {
    // useEffect return 블록에 soundRef cleanup 존재
    const cleanupMatch = content.match(/return\s*\(\)\s*=>\s*\{[\s\S]*?soundRef\.current[\s\S]*?\}/);
    expect(cleanupMatch).not.toBeNull();
  });

  it('재생 중 버튼을 누르면 정지한다 (토글)', () => {
    // handlePlayAudio 내에 isPlaying 체크 후 stop 로직
    expect(content).toContain('if (isPlaying && soundRef.current)');
    expect(content).toContain('await soundRef.current.stopAsync()');
  });

  it('정지 버튼 아이콘이 stop으로 변경된다', () => {
    expect(content).toContain("name={isPlaying ? 'stop' : 'play'}");
  });

  it('정지 버튼 텍스트가 "정지"로 변경된다', () => {
    expect(content).toContain("isPlaying ? '정지' : '내 녹음 듣기'");
  });

  it('재생 버튼이 disabled={isPlaying}가 아니다 (정지 가능)', () => {
    // disabled={isPlaying}이 있으면 재생 중 정지 불가
    const playButtonSection = content.match(
      /내 녹음 듣기[\s\S]{0,200}/
    );
    expect(playButtonSection).not.toBeNull();
    // disabled={isPlaying} 패턴이 없어야 함
    expect(content).not.toContain('disabled={isPlaying}');
  });

  it('createAsync 후 soundRef에 저장한다', () => {
    expect(content).toContain('soundRef.current = sound');
  });

  it('재생 완료 시 soundRef를 null로 초기화한다', () => {
    // didJustFinish 핸들러에서 soundRef 정리
    const finishHandler = content.match(
      /didJustFinish[\s\S]*?soundRef\.current = null/
    );
    expect(finishHandler).not.toBeNull();
  });
});

describe('practice.tsx: 질문 듣기 오디오 정지', () => {
  const practicePath = path.resolve(__dirname, '../../app/(student)/script/[id]/practice.tsx');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(practicePath, 'utf8');
  });

  it('soundRef가 선언되어 있다', () => {
    expect(content).toContain('const soundRef = useRef<Audio.Sound | null>(null)');
  });

  it('useEffect cleanup에서 sound를 unload한다', () => {
    const cleanupMatch = content.match(/return\s*\(\)\s*=>\s*\{[\s\S]*?soundRef\.current[\s\S]*?unloadAsync/);
    expect(cleanupMatch).not.toBeNull();
  });

  it('재생 중 버튼을 누르면 정지한다 (토글)', () => {
    expect(content).toContain("practiceState === 'playing' && soundRef.current");
    expect(content).toContain('await soundRef.current.stopAsync()');
  });

  it('정지 버튼 아이콘이 stop으로 변경된다', () => {
    expect(content).toContain("name={practiceState === 'playing' ? 'stop' : 'play'}");
  });

  it('정지 버튼 텍스트가 "정지"로 변경된다', () => {
    expect(content).toContain("practiceState === 'playing' ? '정지' : '질문 듣기'");
  });

  it('녹음/처리 중에만 버튼이 비활성화된다', () => {
    expect(content).toContain("disabled={practiceState === 'recording'}");
  });

  it('createAsync 후 soundRef에 저장한다', () => {
    expect(content).toContain('soundRef.current = sound');
  });
});

describe('shadowing.tsx: 기존 정지 기능 유지 확인', () => {
  const shadowingPath = path.resolve(__dirname, '../../app/(student)/script/[id]/shadowing.tsx');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(shadowingPath, 'utf8');
  });

  it('soundRef가 선언되어 있다', () => {
    expect(content).toContain('const soundRef = useRef<Audio.Sound | null>(null)');
  });

  it('useEffect cleanup에서 sound를 unload한다', () => {
    expect(content).toContain('if (soundRef.current) soundRef.current.unloadAsync()');
  });

  it('handleStopTTS 함수가 있다', () => {
    expect(content).toContain('const handleStopTTS');
    expect(content).toContain('soundRef.current.stopAsync()');
  });

  it('handleStopPlaying 함수가 있다', () => {
    expect(content).toContain('const handleStopPlaying');
  });
});

// ============================================================================
// P4: handleStopRecording 에러 처리 경로 검증
// ============================================================================

describe('handleStopRecording 에러 처리', () => {
  const practicePath = path.resolve(__dirname, '../../app/(student)/script/[id]/practice.tsx');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(practicePath, 'utf8');
  });

  it('모든 에러 경로에서 Alert.alert을 호출한다', () => {
    const funcMatch = content.match(
      /const handleStopRecording = async[\s\S]*?(?=\n  \/\/ 시간 포맷|\n  const formatTime)/
    );
    expect(funcMatch).not.toBeNull();
    const funcBody = funcMatch![0];

    const alertCalls = (funcBody.match(/Alert\.alert\(/g) || []).length;
    // uri없음, upload실패, save실패, stt실패, 구독체크, feedback실패, catch
    expect(alertCalls).toBeGreaterThanOrEqual(6);
  });

  it('모든 에러 경로에서 setPracticeState("ready")를 호출한다', () => {
    const funcMatch = content.match(
      /const handleStopRecording = async[\s\S]*?(?=\n  \/\/ 시간 포맷|\n  const formatTime)/
    );
    expect(funcMatch).not.toBeNull();
    const funcBody = funcMatch![0];

    const readyCalls = (funcBody.match(/setPracticeState\('ready'\)/g) || []).length;
    // 각 에러 경로 + catch = 최소 6개
    expect(readyCalls).toBeGreaterThanOrEqual(6);
  });

  it('Alert import가 존재한다', () => {
    expect(content).toContain('Alert,');
    expect(content).toContain("} from 'react-native'");
  });
});

// ============================================================================
// FormData 시뮬레이션 (수정 전/후 비교)
// ============================================================================

describe('웹 FormData 시뮬레이션', () => {
  it('RN 패턴: { uri, name, type } 객체 → 웹에서 [object Object]', () => {
    const formData = new FormData();
    formData.append('file', { uri: 'blob:http://localhost/abc', name: 'test.m4a', type: 'audio/m4a' } as any);

    const value = formData.get('file');
    expect(typeof value).toBe('string');
    expect(value).toBe('[object Object]');
  });

  it('수정된 패턴: Blob → 웹에서 정상 동작', () => {
    const formData = new FormData();
    const blob = new Blob(['fake audio data'], { type: 'audio/webm' });
    formData.append('file', blob, 'test.webm');

    const value = formData.get('file');
    expect(value).toBeInstanceOf(Blob);
  });
});
