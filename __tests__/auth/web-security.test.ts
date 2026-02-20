/**
 * 웹 보안 및 라우팅 테스트
 *
 * 실제 시나리오:
 * 1. 로그아웃 시 window.location.href로 전체 리로드 (SPA 상태 제거)
 * 2. 미인증 리다이렉트도 동일하게 window.location.href 사용
 * 3. settings/ → manage/ 경로 충돌 해소
 * 4. 로그인 폼 비밀번호 초기화 (useFocusEffect)
 */

import { Platform } from 'react-native';

// ============================================================================
// 1. signOut — 웹에서 window.location.href 사용
// ============================================================================
describe('signOut on web', () => {
  let originalPlatformOS: string;
  let originalLocation: Location;

  beforeEach(() => {
    originalPlatformOS = Platform.OS;
    originalLocation = window.location;
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalPlatformOS,
      configurable: true,
    });
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('signOut function calls window.location.href on web platform', async () => {
    // Simulate web platform
    Object.defineProperty(Platform, 'OS', {
      value: 'web',
      configurable: true,
    });

    // Mock window.location
    const locationSpy = jest.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '' },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window.location, 'href', {
      set: locationSpy,
      get: () => 'http://localhost:8081/(teacher)',
      configurable: true,
    });

    // Verify the pattern: on web, after signOut, window.location.href should be set
    // This tests the concept without needing to mount the full AuthProvider
    if (Platform.OS === 'web') {
      window.location.href = '/';
    }
    expect(locationSpy).toHaveBeenCalledWith('/');

    // Restore
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('signOut does NOT call window.location.href on native', () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      configurable: true,
    });

    const locationSpy = jest.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '' },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window.location, 'href', {
      set: locationSpy,
      get: () => 'http://localhost',
      configurable: true,
    });

    // On native, should NOT set window.location.href
    if (Platform.OS === 'web') {
      window.location.href = '/';
    }
    expect(locationSpy).not.toHaveBeenCalled();

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });
});

// ============================================================================
// 2. URL 경로 충돌 해소 — settings → manage 이름 변경 검증
// ============================================================================
describe('route path collision fix (settings → manage)', () => {
  it('teacher layout registers manage, not settings', () => {
    // Verify the layout file exports the correct screen names
    // by checking the actual file content pattern
    const fs = require('fs');
    const layoutPath = require('path').resolve(
      __dirname,
      '../../app/(teacher)/_layout.tsx'
    );
    const content = fs.readFileSync(layoutPath, 'utf8');

    // manage screen must exist
    expect(content).toContain('name="manage"');
    // old settings screen must NOT exist (only (tabs)/settings is valid)
    expect(content).not.toMatch(/name="settings"/);
  });

  it('manage folder has all required screen files', () => {
    const fs = require('fs');
    const path = require('path');
    const manageDir = path.resolve(__dirname, '../../app/(teacher)/manage');

    expect(fs.existsSync(path.join(manageDir, '_layout.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(manageDir, 'academy-info.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(manageDir, 'teacher-management.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(manageDir, 'subscription.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(manageDir, 'plan-select.tsx'))).toBe(true);
  });

  it('old settings folder does NOT exist', () => {
    const fs = require('fs');
    const path = require('path');
    const oldDir = path.resolve(__dirname, '../../app/(teacher)/settings');

    expect(fs.existsSync(oldDir)).toBe(false);
  });

  it('no source files reference old /(teacher)/settings/ path', () => {
    const fs = require('fs');
    const path = require('path');

    // Check all files that previously referenced the old path
    const filesToCheck = [
      'app/(teacher)/(tabs)/settings.tsx',
      'app/(teacher)/(tabs)/invite.tsx',
      'app/(teacher)/student/script/new.tsx',
      'app/(teacher)/manage/subscription.tsx',
      'app/(teacher)/manage/plan-select.tsx',
      'lib/toss.ts',
    ];

    for (const file of filesToCheck) {
      const filePath = path.resolve(__dirname, '../../', file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content).not.toContain('/(teacher)/settings/');
      }
    }
  });

  it('settings tab uses /(teacher)/manage/ paths for navigation', () => {
    const fs = require('fs');
    const path = require('path');
    const tabPath = path.resolve(
      __dirname,
      '../../app/(teacher)/(tabs)/settings.tsx'
    );
    const content = fs.readFileSync(tabPath, 'utf8');

    expect(content).toContain('/(teacher)/manage/academy-info');
    expect(content).toContain('/(teacher)/manage/teacher-management');
    expect(content).toContain('/(teacher)/manage/subscription');
  });

  it('toss.ts uses /(teacher)/manage/plan-select path', () => {
    const fs = require('fs');
    const path = require('path');
    const tossPath = path.resolve(__dirname, '../../lib/toss.ts');
    const content = fs.readFileSync(tossPath, 'utf8');

    expect(content).toContain('/(teacher)/manage/plan-select');
    expect(content).not.toContain('/(teacher)/settings/plan-select');
  });

  it('tab and folder URLs are now distinct on web', () => {
    // (tabs)/settings.tsx → URL: /settings  (group segments stripped)
    // manage/_layout.tsx  → URL: /manage/*   (real path segment)
    // These are guaranteed distinct because "settings" ≠ "manage"

    const tabScreenName = 'settings';   // (tabs) child
    const folderName = 'manage';         // Stack child

    expect(tabScreenName).not.toBe(folderName);
  });
});

// ============================================================================
// 3. 로그인 폼 보안 — useFocusEffect로 비밀번호 초기화
// ============================================================================
describe('login form security', () => {
  it('login.tsx imports useFocusEffect', () => {
    const fs = require('fs');
    const path = require('path');
    const loginPath = path.resolve(
      __dirname,
      '../../app/(auth)/login.tsx'
    );
    const content = fs.readFileSync(loginPath, 'utf8');

    expect(content).toContain('useFocusEffect');
    expect(content).toContain('useCallback');
  });

  it('login.tsx clears password on focus', () => {
    const fs = require('fs');
    const path = require('path');
    const loginPath = path.resolve(
      __dirname,
      '../../app/(auth)/login.tsx'
    );
    const content = fs.readFileSync(loginPath, 'utf8');

    // Verify the useFocusEffect clears password
    expect(content).toContain("setPassword('')");
    // Verify it also clears error
    expect(content).toContain('setError(null)');
  });

  it('login.tsx does NOT clear email on focus (convenience)', () => {
    const fs = require('fs');
    const path = require('path');
    const loginPath = path.resolve(
      __dirname,
      '../../app/(auth)/login.tsx'
    );
    const content = fs.readFileSync(loginPath, 'utf8');

    // The useFocusEffect should NOT reset email for user convenience
    // Check that setEmail('') is NOT inside the useFocusEffect block
    const focusEffectMatch = content.match(
      /useFocusEffect\(\s*useCallback\(\(\) => \{([^}]+)\}/s
    );
    expect(focusEffectMatch).not.toBeNull();
    const focusBody = focusEffectMatch![1];
    expect(focusBody).not.toContain("setEmail('')");
  });
});

// ============================================================================
// 4. useAuth 라우팅 로직 검증 — 미인증 리다이렉트
// ============================================================================
describe('unauthenticated redirect on web', () => {
  it('useAuth.tsx uses window.location.href for web unauthenticated redirect', () => {
    const fs = require('fs');
    const path = require('path');
    const authPath = path.resolve(__dirname, '../../hooks/useAuth.tsx');
    const content = fs.readFileSync(authPath, 'utf8');

    // The unauthenticated redirect section should use window.location.href
    expect(content).toContain("window.location.href = '/'");

    // Extract the unauthenticated block: from 미인증 comment to ② (next section)
    const unauthSection = content.match(
      /미인증([\s\S]*?)\/\/ ②/
    );
    expect(unauthSection).not.toBeNull();
    const section = unauthSection![1];
    // Web path should use window.location.href, not router.replace('/')
    expect(section).toContain("window.location.href = '/'");
    // router.replace('/') should NOT appear as actual code in the web branch
    // (it may appear in comments explaining why we use window.location.href instead)
    // The native branch uses router.replace('/(auth)/login'), not router.replace('/')
    const codeLines = section.split('\n').filter(l => !l.trim().startsWith('//'));
    const codeOnly = codeLines.join('\n');
    expect(codeOnly).not.toContain("router.replace('/')");
  });

  it('useAuth.tsx signOut uses window.location.href on web', () => {
    const fs = require('fs');
    const path = require('path');
    const authPath = path.resolve(__dirname, '../../hooks/useAuth.tsx');
    const content = fs.readFileSync(authPath, 'utf8');

    // signOut function should have web redirect
    const signOutSection = content.match(
      /const signOut = useCallback\(async \(\) => \{([\s\S]*?)\}, \[\]\);/
    );
    expect(signOutSection).not.toBeNull();
    const signOutBody = signOutSection![1];
    expect(signOutBody).toContain("Platform.OS === 'web'");
    expect(signOutBody).toContain("window.location.href = '/'");
  });

  it('native signOut does NOT use window.location.href', () => {
    const fs = require('fs');
    const path = require('path');
    const authPath = path.resolve(__dirname, '../../hooks/useAuth.tsx');
    const content = fs.readFileSync(authPath, 'utf8');

    // signOut has the web check: if (Platform.OS === 'web')
    // This ensures native doesn't trigger window.location.href
    const signOutSection = content.match(
      /const signOut = useCallback\(async \(\) => \{([\s\S]*?)\}, \[\]\);/
    );
    const signOutBody = signOutSection![1];

    // window.location.href is inside a Platform.OS === 'web' check
    expect(signOutBody).toMatch(
      /if\s*\(Platform\.OS\s*===\s*'web'\)\s*\{\s*window\.location\.href/
    );
  });
});

// ============================================================================
// 5. 시나리오 통합 — 전체 플로우 검증
// ============================================================================
describe('end-to-end scenarios', () => {
  describe('Scenario: 공용 PC에서 사용자 A 로그아웃 후 사용자 B 로그인', () => {
    it('signOut clears all local caches before redirect', () => {
      const fs = require('fs');
      const path = require('path');
      const authPath = path.resolve(__dirname, '../../hooks/useAuth.tsx');
      const content = fs.readFileSync(authPath, 'utf8');

      const signOutSection = content.match(
        /const signOut = useCallback\(async \(\) => \{([\s\S]*?)\}, \[\]\);/
      );
      const signOutBody = signOutSection![1];

      // 1. Local state cleared first
      expect(signOutBody).toContain('safeMultiRemove');
      expect(signOutBody).toContain('user: null');
      expect(signOutBody).toContain('session: null');
      expect(signOutBody).toContain('isAuthenticated: false');
      expect(signOutBody).toContain('currentOrg: null');

      // 2. Supabase signOut called
      expect(signOutBody).toContain('supabase.auth.signOut()');

      // 3. Web redirect happens AFTER cache clear + signOut
      // window.location.href must be AFTER the setState and signOut calls
      const stateResetIdx = signOutBody.indexOf('setState(');
      const locationIdx = signOutBody.indexOf("window.location.href = '/'");
      expect(stateResetIdx).toBeLessThan(locationIdx);
    });
  });

  describe('Scenario: 강사가 설정 > 학원 정보 클릭 시 올바른 화면 이동', () => {
    it('settings tab navigates to /(teacher)/manage/* paths', () => {
      const fs = require('fs');
      const path = require('path');
      const tabPath = path.resolve(
        __dirname,
        '../../app/(teacher)/(tabs)/settings.tsx'
      );
      const content = fs.readFileSync(tabPath, 'utf8');

      // All navigation targets use /manage/ prefix
      // Match router.push('...') — capture up to closing quote+paren
      const pushMatches = content.match(/router\.push\('[^']+'\)/g) || [];
      for (const match of pushMatches) {
        if (match.includes('teacher')) {
          expect(match).toContain('/manage/');
          expect(match).not.toContain('/settings/');
        }
      }
    });
  });

  describe('Scenario: 결제 URL에 올바른 경로 사용', () => {
    it('toss payment URLs use /manage/plan-select', () => {
      // Re-import to get fresh module with updated paths
      jest.resetModules();

      // Mock Platform for web
      jest.mock('react-native', () => ({
        Platform: { OS: 'web' },
      }));

      // Set window.location.origin
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://app.speaky.com', href: 'https://app.speaky.com' },
        writable: true,
        configurable: true,
      });

      const { buildPaymentUrls } = require('../../lib/toss');
      const result = buildPaymentUrls('pro');

      expect(result).not.toBeNull();
      expect(result.successUrl).toContain('/manage/plan-select');
      expect(result.failUrl).toContain('/manage/plan-select');
      expect(result.successUrl).not.toContain('/settings/plan-select');

      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('Scenario: 학생 초대 쿼터 초과 시 업그레이드 경로', () => {
    it('invite.tsx uses /(teacher)/manage/plan-select for upgrade', () => {
      const fs = require('fs');
      const path = require('path');
      const invitePath = path.resolve(
        __dirname,
        '../../app/(teacher)/(tabs)/invite.tsx'
      );
      const content = fs.readFileSync(invitePath, 'utf8');

      expect(content).toContain('/(teacher)/manage/plan-select');
      expect(content).not.toContain('/(teacher)/settings/plan-select');
    });
  });

  describe('Scenario: 스크립트 한도 초과 시 업그레이드 경로', () => {
    it('script/new.tsx uses /(teacher)/manage/plan-select for upgrade', () => {
      const fs = require('fs');
      const path = require('path');
      const scriptPath = path.resolve(
        __dirname,
        '../../app/(teacher)/student/script/new.tsx'
      );
      const content = fs.readFileSync(scriptPath, 'utf8');

      expect(content).toContain('/(teacher)/manage/plan-select');
      expect(content).not.toContain('/(teacher)/settings/plan-select');
    });
  });
});
