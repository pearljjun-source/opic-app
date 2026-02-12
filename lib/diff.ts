export interface DiffWord {
  word: string;
  matched: boolean;
}

/** 비교용 정규화: 구두점 제거, 소문자 변환 */
function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9']/g, '');
}

/**
 * 원본 스크립트와 STT 답변을 단어 단위로 비교.
 * LCS(Longest Common Subsequence)로 매칭하여
 * 원본의 각 단어가 답변에 포함되었는지 반환.
 */
export function diffScript(original: string, transcription: string): DiffWord[] {
  const origWords = original.split(/\s+/).filter((w) => w.length > 0);
  if (!transcription || transcription.trim().length === 0) {
    return origWords.map((word) => ({ word, matched: false }));
  }

  const transWords = transcription.split(/\s+/).filter((w) => w.length > 0);
  const origNorm = origWords.map(normalizeWord);
  const transNorm = transWords.map(normalizeWord);

  const m = origNorm.length;
  const n = transNorm.length;

  // LCS DP 테이블
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origNorm[i - 1] === transNorm[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 역추적: 매칭된 원본 인덱스 수집
  const matched = new Set<number>();
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (origNorm[i - 1] === transNorm[j - 1]) {
      matched.add(i - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return origWords.map((word, idx) => ({
    word,
    matched: matched.has(idx),
  }));
}
