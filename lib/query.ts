import NetInfo from '@react-native-community/netinfo';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus, Platform } from 'react-native';

/**
 * 서버 데이터 캐시 계층.
 *
 * 이걸 넣기 전에는 조회 결과가 화면 컴포넌트의 useState 안에만 살았다. 컴포넌트가
 * 언마운트되면 데이터도 같이 사라져서, 뒤로 돌아오거나 탭을 옮길 때마다 보여줄 게
 * 없어 스켈레톤부터 다시 떴다. 41개 화면이 같은 패턴을 각자 복사해 갖고 있었다.
 *
 * 캐시를 컴포넌트 바깥에 두면 이 문제가 고쳐지는 게 아니라 사라진다 —
 * 다시 마운트돼도 직전 데이터가 그대로 있으니 띄울 스켈레톤이 없다.
 */

// ============================================================================
// 서비스 레이어 어댑터
// ============================================================================

/**
 * `{ data, error }` 를 React Query 규약으로 바꾼다.
 *
 * services/ 는 전부 `{ data, error }` 를 돌려주고 던지지 않는다. React Query 는
 * 반대로 "성공하면 값을 반환하고 실패하면 던진다" 를 전제한다. 이 함수가 그 사이를
 * 잇는다. 서비스 시그니처를 바꾸지 않는 이유는, 서비스가 화면 밖(Edge Function
 * 호출, 백그라운드 작업)에서도 쓰이기 때문이다.
 *
 * `data` 가 null 인데 `error` 도 null 인 경우는 "없음" 이 정상인 조회다
 * (예: 연결된 강사가 없는 학생). 그대로 null 을 돌려준다.
 */
export async function unwrap<T>(
  promise: Promise<{ data: T; error: Error | null }>,
): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

// ============================================================================
// 쿼리 키
// ============================================================================

/**
 * 쿼리 키 규약.
 *
 * 앞에서부터 좁혀지는 배열로 둔다. 앞부분만 주면 그 아래가 전부 걸리므로,
 * 연습을 하나 저장한 뒤 `invalidateQueries({ queryKey: queryKeys.practices.all })`
 * 한 줄로 통계·스트릭·이력이 함께 갱신된다.
 *
 * ⚠️ 문자열을 화면에 직접 쓰지 않는다. 오타 하나가 조용히 다른 캐시를 만든다.
 */
export const queryKeys = {
  connection: {
    all: ['connection'] as const,
    myTeacher: () => ['connection', 'my-teacher'] as const,
  },
  topics: {
    all: ['topics'] as const,
    mine: () => ['topics', 'mine'] as const,
    questions: (topicId: string) => ['topics', 'questions', topicId] as const,
  },
  practices: {
    all: ['practices'] as const,
    mine: () => ['practices', 'mine'] as const,
    stats: () => ['practices', 'stats'] as const,
    streak: () => ['practices', 'streak'] as const,
    dailyProgress: () => ['practices', 'daily-progress'] as const,
    weakAreas: () => ['practices', 'weak-areas'] as const,
    detail: (practiceId: string) => ['practices', 'detail', practiceId] as const,
  },
  scripts: {
    all: ['scripts'] as const,
    detail: (scriptId: string) => ['scripts', 'detail', scriptId] as const,
  },
} as const;

// ============================================================================
// QueryClient
// ============================================================================

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 이 시간 안에는 다시 조회하지 않는다. 화면을 빠르게 오갈 때 같은 요청이
      // 연달아 나가는 것을 막는다.
      staleTime: 30_000,
      // 화면을 떠난 뒤에도 캐시를 이만큼 들고 있는다. 스켈레톤 깜빡임을 없애는
      // 것이 바로 이 값이다 — 기본 5분은 앱을 잠깐 두고 온 사이 비어버린다.
      gcTime: 30 * 60_000,
      // 네트워크가 잠깐 끊긴 경우만 한 번 더 시도한다. 인가 실패처럼 다시 해도
      // 같은 답이 오는 에러를 반복하지 않는다.
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
      // 앱이 포그라운드로 돌아왔을 때만 다시 조회한다 (focusManager 가 알린다).
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

// ============================================================================
// React Native 연동
// ============================================================================

/**
 * 온라인 여부와 포그라운드 복귀를 React Query 에 알린다.
 *
 * 이것이 `useOfflineGuard` 를 대체한다. 그 훅은 화면마다 "오프라인이면 건너뛰고
 * 복구되면 다시 부른다" 를 각자 구현했는데, onlineManager 에 한 번 연결하면
 * 모든 쿼리가 같은 동작을 얻는다.
 *
 * 앱 시작 시 한 번만 부른다 (`app/_layout.tsx`).
 */
export function initQueryClientBindings() {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(
        Boolean(state.isConnected) &&
          (state.isInternetReachable === true || state.isInternetReachable === null),
      );
    }),
  );

  // 웹에는 React Query 의 기본 focus 감지(visibilitychange)가 이미 맞게 동작한다.
  // AppState 로 덮어쓰면 오히려 탭 전환을 놓친다.
  if (Platform.OS !== 'web') {
    const onChange = (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active');
    };
    AppState.addEventListener('change', onChange);
  }
}
