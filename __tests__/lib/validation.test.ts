// ============================================================================
// OPIc 학습 앱 - validation.ts 테스트
// ============================================================================

import {
  sanitizeText,
  validateAudioFile,
  validateRecordingDuration,
  isValidEmail,
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
  validateName,
  isValidInviteCode,
  validateInviteCode,
  normalizeInviteCode,
  validateScript,
  validateFeedback,
  validateSignupForm,
  isSignupFormValid,
  validateLoginForm,
  isLoginFormValid,
  isValidScore,
  clampScore,
  isValidReproductionRate,
  clampReproductionRate,
} from '@/lib/validation';

// ============================================================================
// sanitizeText - XSS 방지 텍스트 정제
// ============================================================================

describe('sanitizeText', () => {
  it('< 문자를 &lt;로 변환한다', () => {
    expect(sanitizeText('<script>')).toBe('&lt;script&gt;');
  });

  it('> 문자를 &gt;로 변환한다', () => {
    expect(sanitizeText('a > b')).toBe('a &gt; b');
  });

  it('" 문자를 &quot;로 변환한다', () => {
    expect(sanitizeText('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it("' 문자를 &#x27;로 변환한다", () => {
    expect(sanitizeText("it's")).toBe("it&#x27;s");
  });

  it('앞뒤 공백을 제거한다', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });

  it('빈 문자열을 처리한다', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('여러 XSS 문자가 포함된 복합 입력을 처리한다', () => {
    expect(sanitizeText('<img src="x" onerror=\'alert(1)\'>')).toBe(
      '&lt;img src=&quot;x&quot; onerror=&#x27;alert(1)&#x27;&gt;'
    );
  });

  it('XSS 문자가 없는 일반 텍스트는 그대로 반환한다', () => {
    expect(sanitizeText('Hello World')).toBe('Hello World');
  });

  it('공백만 있는 문자열은 빈 문자열이 된다', () => {
    expect(sanitizeText('   ')).toBe('');
  });
});

// ============================================================================
// validateAudioFile - 오디오 파일 검증
// ============================================================================

describe('validateAudioFile', () => {
  it('유효한 m4a 파일을 통과시킨다', () => {
    const result = validateAudioFile({ type: 'audio/m4a', size: 1024 });
    expect(result.valid).toBe(true);
    expect(result.message).toBe('');
  });

  it('유효한 mp4 파일을 통과시킨다', () => {
    const result = validateAudioFile({ type: 'audio/mp4', size: 1024 });
    expect(result.valid).toBe(true);
  });

  it('유효한 wav 파일을 통과시킨다', () => {
    const result = validateAudioFile({ type: 'audio/wav', size: 1024 });
    expect(result.valid).toBe(true);
  });

  it('유효한 x-m4a 파일을 통과시킨다', () => {
    const result = validateAudioFile({ type: 'audio/x-m4a', size: 1024 });
    expect(result.valid).toBe(true);
  });

  it('유효한 mpeg 파일을 통과시킨다', () => {
    const result = validateAudioFile({ type: 'audio/mpeg', size: 1024 });
    expect(result.valid).toBe(true);
  });

  it('지원하지 않는 오디오 형식을 거부한다', () => {
    const result = validateAudioFile({ type: 'audio/ogg', size: 1024 });
    expect(result.valid).toBe(false);
    expect(result.message).toContain('지원하지 않는 오디오 형식');
  });

  it('오디오가 아닌 파일 형식을 거부한다', () => {
    const result = validateAudioFile({ type: 'image/png', size: 1024 });
    expect(result.valid).toBe(false);
    expect(result.message).toContain('지원하지 않는 오디오 형식');
  });

  it('50MB 초과 파일을 거부한다', () => {
    const tooLarge = 50 * 1024 * 1024 + 1; // 50MB + 1 byte
    const result = validateAudioFile({ type: 'audio/m4a', size: tooLarge });
    expect(result.valid).toBe(false);
    expect(result.message).toContain('파일이 너무 큽니다');
  });

  it('정확히 50MB 파일은 통과시킨다', () => {
    const exactMax = 50 * 1024 * 1024;
    const result = validateAudioFile({ type: 'audio/m4a', size: exactMax });
    expect(result.valid).toBe(true);
  });

  it('빈 파일(0 bytes)을 거부한다', () => {
    const result = validateAudioFile({ type: 'audio/m4a', size: 0 });
    expect(result.valid).toBe(false);
    expect(result.message).toContain('빈 파일');
  });
});

// ============================================================================
// validateRecordingDuration - 녹음 길이 검증
// ============================================================================

describe('validateRecordingDuration', () => {
  it('너무 짧은 녹음(5초 미만)을 거부한다', () => {
    const result = validateRecordingDuration(3);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('너무 짧습니다');
  });

  it('0초 녹음을 거부한다', () => {
    const result = validateRecordingDuration(0);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('너무 짧습니다');
  });

  it('너무 긴 녹음(120초 초과)을 거부한다', () => {
    const result = validateRecordingDuration(121);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('너무 깁니다');
  });

  it('최소 경계값(5초)을 통과시킨다', () => {
    const result = validateRecordingDuration(5);
    expect(result.valid).toBe(true);
    expect(result.message).toBe('');
  });

  it('최대 경계값(120초)을 통과시킨다', () => {
    const result = validateRecordingDuration(120);
    expect(result.valid).toBe(true);
    expect(result.message).toBe('');
  });

  it('유효한 중간 값(60초)을 통과시킨다', () => {
    const result = validateRecordingDuration(60);
    expect(result.valid).toBe(true);
  });

  it('경계 바로 아래 값(4.99초)을 거부한다', () => {
    const result = validateRecordingDuration(4.99);
    expect(result.valid).toBe(false);
  });

  it('경계 바로 위 값(120.01초)을 거부한다', () => {
    const result = validateRecordingDuration(120.01);
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// isValidEmail - 이메일 유효성 확인
// ============================================================================

describe('isValidEmail', () => {
  it('유효한 이메일을 true로 반환한다', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('서브도메인이 있는 이메일을 통과시킨다', () => {
    expect(isValidEmail('user@mail.example.com')).toBe(true);
  });

  it('+ 기호가 포함된 이메일을 통과시킨다', () => {
    expect(isValidEmail('user+tag@example.com')).toBe(true);
  });

  it('@ 없는 문자열을 거부한다', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('도메인 없는 이메일을 거부한다', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('TLD 없는 이메일을 거부한다', () => {
    expect(isValidEmail('user@example')).toBe(false);
  });

  it('빈 문자열을 거부한다', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('공백이 포함된 이메일을 거부한다', () => {
    expect(isValidEmail('user @example.com')).toBe(false);
  });

  it('앞뒤 공백이 있어도 trim 처리 후 유효하면 통과시킨다', () => {
    expect(isValidEmail('  user@example.com  ')).toBe(true);
  });
});

// ============================================================================
// validateEmail - 이메일 검증 (에러 메시지 반환)
// ============================================================================

describe('validateEmail', () => {
  it('유효한 이메일은 null을 반환한다', () => {
    expect(validateEmail('user@example.com')).toBeNull();
  });

  it('빈 문자열은 입력 요청 메시지를 반환한다', () => {
    expect(validateEmail('')).toBe('이메일을 입력해주세요');
  });

  it('공백만 있는 문자열은 입력 요청 메시지를 반환한다', () => {
    expect(validateEmail('   ')).toBe('이메일을 입력해주세요');
  });

  it('잘못된 형식은 형식 오류 메시지를 반환한다', () => {
    expect(validateEmail('invalid-email')).toBe('올바른 이메일 형식이 아닙니다');
  });

  it('@ 없는 이메일은 형식 오류 메시지를 반환한다', () => {
    expect(validateEmail('user.example.com')).toBe('올바른 이메일 형식이 아닙니다');
  });
});

// ============================================================================
// validatePassword - 비밀번호 검증
// ============================================================================

describe('validatePassword', () => {
  it('빈 비밀번호는 입력 요청 메시지를 반환한다', () => {
    expect(validatePassword('')).toBe('비밀번호를 입력해주세요');
  });

  it('너무 짧은 비밀번호(6자 미만)는 에러를 반환한다', () => {
    expect(validatePassword('abc')).toContain('최소 6자');
  });

  it('5자 비밀번호는 에러를 반환한다', () => {
    expect(validatePassword('12345')).toContain('최소 6자');
  });

  it('정확히 6자 비밀번호는 통과한다', () => {
    expect(validatePassword('123456')).toBeNull();
  });

  it('너무 긴 비밀번호(100자 초과)는 에러를 반환한다', () => {
    const longPassword = 'a'.repeat(101);
    expect(validatePassword(longPassword)).toContain('최대 100자');
  });

  it('정확히 100자 비밀번호는 통과한다', () => {
    const maxPassword = 'a'.repeat(100);
    expect(validatePassword(maxPassword)).toBeNull();
  });

  it('유효한 비밀번호는 null을 반환한다', () => {
    expect(validatePassword('securePassword123')).toBeNull();
  });
});

// ============================================================================
// validatePasswordConfirm - 비밀번호 확인 검증
// ============================================================================

describe('validatePasswordConfirm', () => {
  it('비밀번호가 일치하면 null을 반환한다', () => {
    expect(validatePasswordConfirm('password123', 'password123')).toBeNull();
  });

  it('비밀번호가 일치하지 않으면 에러를 반환한다', () => {
    expect(validatePasswordConfirm('password123', 'different')).toBe(
      '비밀번호가 일치하지 않습니다'
    );
  });

  it('확인 비밀번호가 비어있으면 입력 요청 메시지를 반환한다', () => {
    expect(validatePasswordConfirm('password123', '')).toBe(
      '비밀번호 확인을 입력해주세요'
    );
  });

  it('두 비밀번호 모두 비어있으면 확인 입력 요청 메시지를 반환한다', () => {
    expect(validatePasswordConfirm('', '')).toBe(
      '비밀번호 확인을 입력해주세요'
    );
  });
});

// ============================================================================
// validateName - 이름 검증
// ============================================================================

describe('validateName', () => {
  it('빈 이름은 입력 요청 메시지를 반환한다', () => {
    expect(validateName('')).toBe('이름을 입력해주세요');
  });

  it('공백만 있는 이름은 입력 요청 메시지를 반환한다', () => {
    expect(validateName('   ')).toBe('이름을 입력해주세요');
  });

  it('너무 짧은 이름(2자 미만)은 에러를 반환한다', () => {
    expect(validateName('a')).toContain('최소 2자');
  });

  it('정확히 2자 이름은 통과한다', () => {
    expect(validateName('ab')).toBeNull();
  });

  it('너무 긴 이름(50자 초과)은 에러를 반환한다', () => {
    const longName = 'a'.repeat(51);
    expect(validateName(longName)).toContain('최대 50자');
  });

  it('정확히 50자 이름은 통과한다', () => {
    const maxName = 'a'.repeat(50);
    expect(validateName(maxName)).toBeNull();
  });

  it('유효한 이름은 null을 반환한다', () => {
    expect(validateName('홍길동')).toBeNull();
  });

  it('앞뒤 공백이 있어도 trim 후 유효하면 통과한다', () => {
    expect(validateName('  김철수  ')).toBeNull();
  });

  it('앞뒤 공백 제거 후 1자면 에러를 반환한다', () => {
    expect(validateName('  a  ')).toContain('최소 2자');
  });
});

// ============================================================================
// isValidInviteCode - 초대 코드 유효성 확인
// ============================================================================

describe('isValidInviteCode', () => {
  it('유효한 6자리 대문자 영숫자 코드를 통과시킨다', () => {
    expect(isValidInviteCode('ABC123')).toBe(true);
  });

  it('소문자 코드도 toUpperCase 변환 후 통과시킨다', () => {
    expect(isValidInviteCode('abc123')).toBe(true);
  });

  it('혼합 대소문자 코드를 통과시킨다', () => {
    expect(isValidInviteCode('aBc12D')).toBe(true);
  });

  it('숫자만으로 된 6자리 코드를 통과시킨다', () => {
    expect(isValidInviteCode('123456')).toBe(true);
  });

  it('영문만으로 된 6자리 코드를 통과시킨다', () => {
    expect(isValidInviteCode('ABCDEF')).toBe(true);
  });

  it('5자리 코드(너무 짧음)를 거부한다', () => {
    expect(isValidInviteCode('ABC12')).toBe(false);
  });

  it('7자리 코드(너무 김)를 거부한다', () => {
    expect(isValidInviteCode('ABC1234')).toBe(false);
  });

  it('특수 문자가 포함된 코드를 거부한다', () => {
    expect(isValidInviteCode('ABC!@#')).toBe(false);
  });

  it('공백이 포함된 코드를 거부한다', () => {
    expect(isValidInviteCode('ABC 12')).toBe(false);
  });

  it('빈 문자열을 거부한다', () => {
    expect(isValidInviteCode('')).toBe(false);
  });

  it('앞뒤 공백이 있지만 trim 후 유효하면 통과시킨다', () => {
    expect(isValidInviteCode('  ABC123  ')).toBe(true);
  });
});

// ============================================================================
// validateInviteCode - 초대 코드 검증 (에러 메시지 반환)
// ============================================================================

describe('validateInviteCode', () => {
  it('빈 코드는 입력 요청 메시지를 반환한다', () => {
    expect(validateInviteCode('')).toBe('초대 코드를 입력해주세요');
  });

  it('공백만 있는 코드는 입력 요청 메시지를 반환한다', () => {
    expect(validateInviteCode('   ')).toBe('초대 코드를 입력해주세요');
  });

  it('잘못된 형식의 코드는 형식 오류 메시지를 반환한다', () => {
    expect(validateInviteCode('AB')).toContain('6자리 영문/숫자');
  });

  it('유효한 코드는 null을 반환한다', () => {
    expect(validateInviteCode('ABC123')).toBeNull();
  });

  it('소문자 유효 코드도 null을 반환한다', () => {
    expect(validateInviteCode('abc123')).toBeNull();
  });
});

// ============================================================================
// normalizeInviteCode - 초대 코드 정규화
// ============================================================================

describe('normalizeInviteCode', () => {
  it('소문자를 대문자로 변환한다', () => {
    expect(normalizeInviteCode('abc123')).toBe('ABC123');
  });

  it('앞뒤 공백을 제거한다', () => {
    expect(normalizeInviteCode('  ABC123  ')).toBe('ABC123');
  });

  it('소문자 변환과 공백 제거를 동시에 처리한다', () => {
    expect(normalizeInviteCode('  abc123  ')).toBe('ABC123');
  });

  it('이미 대문자인 코드는 그대로 반환한다', () => {
    expect(normalizeInviteCode('XYZ789')).toBe('XYZ789');
  });

  it('빈 문자열은 빈 문자열을 반환한다', () => {
    expect(normalizeInviteCode('')).toBe('');
  });
});

// ============================================================================
// validateScript - 스크립트 검증
// ============================================================================

describe('validateScript', () => {
  it('빈 스크립트는 입력 요청 메시지를 반환한다', () => {
    expect(validateScript('')).toBe('스크립트 내용을 입력해주세요');
  });

  it('공백만 있는 스크립트는 입력 요청 메시지를 반환한다', () => {
    expect(validateScript('   ')).toBe('스크립트 내용을 입력해주세요');
  });

  it('너무 짧은 스크립트(10자 미만)는 에러를 반환한다', () => {
    expect(validateScript('short')).toContain('최소 10자');
  });

  it('정확히 9자 스크립트는 에러를 반환한다', () => {
    expect(validateScript('123456789')).toContain('최소 10자');
  });

  it('정확히 10자 스크립트는 통과한다', () => {
    expect(validateScript('1234567890')).toBeNull();
  });

  it('너무 긴 스크립트(5000자 초과)는 에러를 반환한다', () => {
    const longScript = 'a'.repeat(5001);
    expect(validateScript(longScript)).toContain('최대 5000자');
  });

  it('정확히 5000자 스크립트는 통과한다', () => {
    const maxScript = 'a'.repeat(5000);
    expect(validateScript(maxScript)).toBeNull();
  });

  it('유효한 스크립트는 null을 반환한다', () => {
    expect(validateScript('This is a valid OPIc script content.')).toBeNull();
  });
});

// ============================================================================
// validateFeedback - 피드백 검증
// ============================================================================

describe('validateFeedback', () => {
  it('빈 피드백은 입력 요청 메시지를 반환한다', () => {
    expect(validateFeedback('')).toBe('피드백 내용을 입력해주세요');
  });

  it('공백만 있는 피드백은 입력 요청 메시지를 반환한다', () => {
    expect(validateFeedback('   ')).toBe('피드백 내용을 입력해주세요');
  });

  it('너무 긴 피드백(2000자 초과)은 에러를 반환한다', () => {
    const longFeedback = 'a'.repeat(2001);
    expect(validateFeedback(longFeedback)).toContain('최대 2000자');
  });

  it('정확히 2000자 피드백은 통과한다', () => {
    const maxFeedback = 'a'.repeat(2000);
    expect(validateFeedback(maxFeedback)).toBeNull();
  });

  it('유효한 피드백은 null을 반환한다', () => {
    expect(validateFeedback('발음이 좋아졌습니다.')).toBeNull();
  });

  it('1자 피드백도 통과한다 (최소 길이 제한 없음)', () => {
    expect(validateFeedback('a')).toBeNull();
  });
});

// ============================================================================
// validateSignupForm - 회원가입 폼 전체 검증
// ============================================================================

describe('validateSignupForm', () => {
  const validForm = {
    email: 'user@example.com',
    password: 'password123',
    passwordConfirm: 'password123',
    name: '홍길동',
  };

  it('모든 필드가 유효하면 빈 객체를 반환한다', () => {
    const errors = validateSignupForm(validForm);
    expect(errors).toEqual({});
  });

  it('이메일이 잘못되면 email 에러를 포함한다', () => {
    const errors = validateSignupForm({ ...validForm, email: 'invalid' });
    expect(errors.email).toBeDefined();
    expect(errors.password).toBeUndefined();
    expect(errors.name).toBeUndefined();
  });

  it('비밀번호가 너무 짧으면 password 에러를 포함한다', () => {
    const errors = validateSignupForm({ ...validForm, password: '12', passwordConfirm: '12' });
    expect(errors.password).toBeDefined();
  });

  it('비밀번호 확인이 일치하지 않으면 passwordConfirm 에러를 포함한다', () => {
    const errors = validateSignupForm({ ...validForm, passwordConfirm: 'different' });
    expect(errors.passwordConfirm).toBeDefined();
  });

  it('이름이 비어있으면 name 에러를 포함한다', () => {
    const errors = validateSignupForm({ ...validForm, name: '' });
    expect(errors.name).toBeDefined();
  });

  it('모든 필드가 비어있으면 모든 에러를 포함한다', () => {
    const errors = validateSignupForm({
      email: '',
      password: '',
      passwordConfirm: '',
      name: '',
    });
    expect(errors.email).toBeDefined();
    expect(errors.password).toBeDefined();
    expect(errors.passwordConfirm).toBeDefined();
    expect(errors.name).toBeDefined();
  });

  it('이메일만 잘못된 경우 email 에러만 포함한다', () => {
    const errors = validateSignupForm({ ...validForm, email: '' });
    expect(Object.keys(errors)).toEqual(['email']);
  });
});

// ============================================================================
// isSignupFormValid - 회원가입 폼 유효성 확인
// ============================================================================

describe('isSignupFormValid', () => {
  it('에러가 없으면 true를 반환한다', () => {
    expect(isSignupFormValid({})).toBe(true);
  });

  it('에러가 있으면 false를 반환한다', () => {
    expect(isSignupFormValid({ email: '이메일 에러' })).toBe(false);
  });

  it('여러 에러가 있어도 false를 반환한다', () => {
    expect(
      isSignupFormValid({
        email: '이메일 에러',
        password: '비밀번호 에러',
        name: '이름 에러',
      })
    ).toBe(false);
  });
});

// ============================================================================
// validateLoginForm - 로그인 폼 전체 검증
// ============================================================================

describe('validateLoginForm', () => {
  it('모든 필드가 유효하면 빈 객체를 반환한다', () => {
    const errors = validateLoginForm({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(errors).toEqual({});
  });

  it('이메일이 비어있으면 email 에러를 포함한다', () => {
    const errors = validateLoginForm({ email: '', password: 'password123' });
    expect(errors.email).toBeDefined();
  });

  it('이메일 형식이 잘못되면 email 에러를 포함한다', () => {
    const errors = validateLoginForm({ email: 'invalid', password: 'password123' });
    expect(errors.email).toBeDefined();
  });

  it('비밀번호가 비어있으면 password 에러를 포함한다', () => {
    const errors = validateLoginForm({ email: 'user@example.com', password: '' });
    expect(errors.password).toBe('비밀번호를 입력해주세요');
  });

  it('모든 필드가 비어있으면 모든 에러를 포함한다', () => {
    const errors = validateLoginForm({ email: '', password: '' });
    expect(errors.email).toBeDefined();
    expect(errors.password).toBeDefined();
  });
});

// ============================================================================
// isLoginFormValid - 로그인 폼 유효성 확인
// ============================================================================

describe('isLoginFormValid', () => {
  it('에러가 없으면 true를 반환한다', () => {
    expect(isLoginFormValid({})).toBe(true);
  });

  it('에러가 있으면 false를 반환한다', () => {
    expect(isLoginFormValid({ email: '에러' })).toBe(false);
  });

  it('password 에러만 있어도 false를 반환한다', () => {
    expect(isLoginFormValid({ password: '에러' })).toBe(false);
  });
});

// ============================================================================
// isValidScore - 점수 유효성 확인
// ============================================================================

describe('isValidScore', () => {
  it('유효 범위 내 점수(50)는 true를 반환한다', () => {
    expect(isValidScore(50)).toBe(true);
  });

  it('최소값(0)은 true를 반환한다', () => {
    expect(isValidScore(0)).toBe(true);
  });

  it('최대값(100)은 true를 반환한다', () => {
    expect(isValidScore(100)).toBe(true);
  });

  it('최소값 미만(-1)은 false를 반환한다', () => {
    expect(isValidScore(-1)).toBe(false);
  });

  it('최대값 초과(101)는 false를 반환한다', () => {
    expect(isValidScore(101)).toBe(false);
  });

  it('NaN은 false를 반환한다', () => {
    expect(isValidScore(NaN)).toBe(false);
  });

  it('소수점 점수(75.5)는 true를 반환한다', () => {
    expect(isValidScore(75.5)).toBe(true);
  });

  it('음수 점수(-50)는 false를 반환한다', () => {
    expect(isValidScore(-50)).toBe(false);
  });
});

// ============================================================================
// clampScore - 점수 클램핑
// ============================================================================

describe('clampScore', () => {
  it('범위 내 점수는 반올림하여 반환한다', () => {
    expect(clampScore(50)).toBe(50);
  });

  it('최소값 미만은 최소값(0)으로 클램핑한다', () => {
    expect(clampScore(-10)).toBe(0);
  });

  it('최대값 초과는 최대값(100)으로 클램핑한다', () => {
    expect(clampScore(150)).toBe(100);
  });

  it('소수점은 반올림한다 (75.4 -> 75)', () => {
    expect(clampScore(75.4)).toBe(75);
  });

  it('소수점은 반올림한다 (75.5 -> 76)', () => {
    expect(clampScore(75.5)).toBe(76);
  });

  it('경계값 0은 그대로 반환한다', () => {
    expect(clampScore(0)).toBe(0);
  });

  it('경계값 100은 그대로 반환한다', () => {
    expect(clampScore(100)).toBe(100);
  });

  it('매우 큰 음수도 0으로 클램핑한다', () => {
    expect(clampScore(-9999)).toBe(0);
  });
});

// ============================================================================
// isValidReproductionRate - 재현율 유효성 확인
// ============================================================================

describe('isValidReproductionRate', () => {
  it('0은 유효하다', () => {
    expect(isValidReproductionRate(0)).toBe(true);
  });

  it('100은 유효하다', () => {
    expect(isValidReproductionRate(100)).toBe(true);
  });

  it('중간값 50.5는 유효하다', () => {
    expect(isValidReproductionRate(50.5)).toBe(true);
  });

  it('음수(-1)는 유효하지 않다', () => {
    expect(isValidReproductionRate(-1)).toBe(false);
  });

  it('100 초과(100.1)는 유효하지 않다', () => {
    expect(isValidReproductionRate(100.1)).toBe(false);
  });

  it('NaN은 유효하지 않다', () => {
    expect(isValidReproductionRate(NaN)).toBe(false);
  });

  it('음의 큰 값(-100)은 유효하지 않다', () => {
    expect(isValidReproductionRate(-100)).toBe(false);
  });
});

// ============================================================================
// clampReproductionRate - 재현율 클램핑
// ============================================================================

describe('clampReproductionRate', () => {
  it('유효 범위 내 값은 소수 첫째 자리까지 반환한다', () => {
    expect(clampReproductionRate(50.55)).toBe(50.6);
  });

  it('음수는 0으로 클램핑한다', () => {
    expect(clampReproductionRate(-10)).toBe(0);
  });

  it('100 초과는 100으로 클램핑한다', () => {
    expect(clampReproductionRate(150)).toBe(100);
  });

  it('0은 그대로 반환한다', () => {
    expect(clampReproductionRate(0)).toBe(0);
  });

  it('100은 그대로 반환한다', () => {
    expect(clampReproductionRate(100)).toBe(100);
  });

  it('소수점 첫째 자리 반올림을 적용한다 (33.33 -> 33.3)', () => {
    expect(clampReproductionRate(33.33)).toBe(33.3);
  });

  it('소수점 첫째 자리 반올림을 적용한다 (66.67 -> 66.7)', () => {
    expect(clampReproductionRate(66.67)).toBe(66.7);
  });

  it('정수 값은 정수로 반환한다', () => {
    expect(clampReproductionRate(75)).toBe(75);
  });

  it('매우 큰 음수도 0으로 클램핑한다', () => {
    expect(clampReproductionRate(-9999)).toBe(0);
  });
});
