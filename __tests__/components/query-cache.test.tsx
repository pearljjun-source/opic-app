/**
 * 서버 데이터 캐시 — 다시 열어도 스켈레톤이 뜨지 않는가
 *
 * 이 테스트가 지키려는 회귀는 이것이다.
 *
 *   연습을 마치고 뒤로 나오면 화면이 스켈레톤부터 다시 그렸다. 이미 봤던
 *   데이터인데도 "아무것도 없음" 을 한 번 보여준 뒤 채워 넣으니, 뒤로 가는
 *   순간 앱이 무너졌다 복구되는 것처럼 보였다.
 *
 * 원인은 조회 결과가 화면 컴포넌트의 useState 안에만 살았다는 것이다. 컴포넌트가
 * 언마운트되면 데이터도 같이 죽으니, 다시 마운트됐을 때 보여줄 게 정말 없었다.
 *
 * 그래서 여기서 보는 것은 **두 번째 마운트** 다. 첫 마운트에 스켈레톤이 뜨는 것은
 * 정상이고, 두 번째에 뜨면 회귀다.
 *
 * ⚠️ 테스트용 QueryClient 를 새로 만들지 않고 `lib/query.ts` 가 내보내는 실물을
 *    쓴다. gcTime 을 0 으로 되돌리는 것 같은 설정 회귀를 잡으려면 실제 설정을
 *    통과시켜야 한다. 새 인스턴스를 만들면 그 회귀를 놓친다.
 */

import { render, screen, act, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient, queryKeys, unwrap } from '@/lib/query';
import { TEST_IDS } from '@/lib/testIds';

// ── 라우팅 ───────────────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useSegments: () => ['(student)'],
}));

// ── 서비스 ───────────────────────────────────────────────────────────────────
const PRACTICE = {
  id: 'p1',
  score: 82,
  reproduction_rate: 71,
  duration: 65,
  created_at: '2026-09-07T01:00:00Z',
  question_text: 'Tell me about your neighborhood.',
  topic_name_ko: '이웃/동네',
};

const mockGetMyPractices = jest.fn();
const mockDeletePractice = jest.fn();

jest.mock('@/services/practices', () => ({
  getMyPractices: (...args: unknown[]) => mockGetMyPractices(...args),
  deletePractice: (...args: unknown[]) => mockDeletePractice(...args),
}));

import HistoryScreen from '@/app/(student)/(tabs)/history';

function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <HistoryScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  mockGetMyPractices.mockResolvedValue({ data: [PRACTICE], error: null });
  mockDeletePractice.mockResolvedValue({ error: null, fileRemainsWarning: false });
});

describe('연습 기록 화면 — 캐시', () => {
  it('처음 열면 스켈레톤을 보여주고, 데이터가 오면 목록으로 바뀐다', async () => {
    renderScreen();

    expect(screen.getByTestId(TEST_IDS.SKELETON)).toBeTruthy();

    await waitFor(() => expect(screen.getByTestId(TEST_IDS.HISTORY_CARD)).toBeTruthy());
    expect(screen.queryByTestId(TEST_IDS.SKELETON)).toBeNull();
  });

  it('떠난 지 10분이 지나도 캐시가 남아있다', async () => {
    // gcTime 검증. 관찰자가 사라진 뒤 캐시를 언제 버리는지는 타이머가 정한다.
    // 언마운트 직후 곧바로 다시 그려보는 것으로는 아무것도 검증되지 않는다 —
    // 정리 타이머가 아직 돌지 않았으니 gcTime 을 0 으로 만들어도 통과한다.
    // 실제로 그 실수를 했고, 돌연변이를 넣어보고서야 알았다.
    jest.useFakeTimers();
    try {
      const first = renderScreen();
      await act(async () => {});
      first.unmount();

      act(() => {
        jest.advanceTimersByTime(10 * 60_000);
      });

      expect(queryClient.getQueryData(queryKeys.practices.mine())).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('데이터가 오래돼 다시 불러오는 중에도 스켈레톤 대신 이전 목록을 보여준다', async () => {
    // isPending 과 isFetching 을 가르는 지점. 재조회가 실제로 일어나는 상황을
    // 만들어야 의미가 있다 — staleTime 안쪽에서는 재조회 자체가 없어서
    // isFetching 을 써도 티가 나지 않는다.
    const first = renderScreen();
    await waitFor(() => expect(screen.getByTestId(TEST_IDS.HISTORY_CARD)).toBeTruthy());
    first.unmount();

    // 서버 응답을 테스트가 붙잡아 둔다. 재조회가 "진행 중" 인 순간을 관찰하기 위해서다.
    let release: (v: unknown) => void = () => {};
    mockGetMyPractices.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    // 캐시를 오래된 것으로 표시 → 다시 그리면 배경에서 재조회가 나간다
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.practices.mine(),
        refetchType: 'none',
      });
    });

    renderScreen();
    await act(async () => {});

    // ⚠️ 붙잡아 둔 응답은 무슨 일이 있어도 놓아준다. 단언이 먼저 터지면 프로미스가
    //    영원히 남아 jest 가 종료되지 않는다 — 실패할 때 멈추는 테스트는 잘못
    //    통과하는 테스트만큼 나쁘다. 실제로 한 번 그렇게 매달렸다.
    try {
      // 재조회가 실제로 진행 중이어야 이 검사가 의미를 갖는다
      expect(queryClient.isFetching({ queryKey: queryKeys.practices.mine() })).toBe(1);
      // 그런데도 화면은 이전 데이터를 그대로 들고 있다
      expect(screen.queryByTestId(TEST_IDS.SKELETON)).toBeNull();
      expect(screen.getByTestId(TEST_IDS.HISTORY_CARD)).toBeTruthy();
    } finally {
      await act(async () => {
        release({ data: [PRACTICE], error: null });
      });
    }
  }, 15_000);

  it('조회에 실패하면 에러를 보여준다 — 빈 목록으로 위장하지 않는다', async () => {
    queryClient.clear();
    mockGetMyPractices.mockResolvedValue({ data: null, error: new Error('boom') });

    renderScreen();

    await waitFor(
      () => expect(screen.queryByTestId(TEST_IDS.SKELETON)).toBeNull(),
      { timeout: 10_000 },
    );
    expect(screen.getByText('다시 시도')).toBeTruthy();
    expect(screen.queryByTestId(TEST_IDS.HISTORY_CARD)).toBeNull();
  }, 15_000);
});

describe('unwrap — 서비스 규약을 쿼리 규약으로', () => {
  it('error 가 있으면 던진다', async () => {
    const boom = new Error('nope');
    await expect(unwrap(Promise.resolve({ data: null, error: boom }))).rejects.toBe(boom);
  });

  it('error 가 없으면 data 를 그대로 준다 — null 도 정상 값이다', async () => {
    await expect(unwrap(Promise.resolve({ data: [1, 2], error: null }))).resolves.toEqual([1, 2]);
    // 연결된 강사가 없는 학생처럼 "없음" 이 정답인 조회가 있다. 에러로 바꾸면 안 된다.
    await expect(unwrap(Promise.resolve({ data: null, error: null }))).resolves.toBeNull();
  });
});

describe('쿼리 키 — 앞부분으로 한꺼번에 무효화된다', () => {
  it('practices 하위 키들이 practices.all 로 모두 걸린다', () => {
    const all = queryKeys.practices.all as readonly string[];
    for (const key of [
      queryKeys.practices.mine(),
      queryKeys.practices.stats(),
      queryKeys.practices.streak(),
      queryKeys.practices.dailyProgress(),
      queryKeys.practices.weakAreas(),
      queryKeys.practices.detail('p1'),
    ]) {
      expect(key.slice(0, all.length)).toEqual(all);
    }
  });
});
