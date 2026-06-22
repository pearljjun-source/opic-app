-- ============================================================================
-- 076: 일일 학습 목표 & 달성 추적
--
-- 변경 내용:
-- 1. NEW TABLE: daily_goals (학생별 일일 목표 설정)
-- 2. NEW RPC: get_daily_progress (오늘 달성도 + 스트릭 조회)
-- 3. NEW RPC: set_daily_goal (목표 설정/변경)
--
-- 보안:
-- - RLS: 본인 데이터만 접근 가능
-- - set_daily_goal: auth.uid() 검증
-- - get_daily_progress: auth.uid() 검증
-- ============================================================================

-- ============================================================================
-- 1. TABLE: daily_goals
-- ============================================================================
-- 학생별 일일 연습 목표 설정 (1인 1행)

CREATE TABLE IF NOT EXISTS public.daily_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  daily_target int NOT NULL DEFAULT 3 CHECK (daily_target >= 1 AND daily_target <= 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_goals_student_unique UNIQUE (student_id)
);

COMMENT ON TABLE public.daily_goals IS '학생별 일일 연습 목표 설정 (1인 1행)';

-- RLS 활성화
ALTER TABLE public.daily_goals ENABLE ROW LEVEL SECURITY;

-- 본인만 조회
CREATE POLICY daily_goals_select ON public.daily_goals
  FOR SELECT USING (auth.uid() = student_id);

-- 본인만 삽입
CREATE POLICY daily_goals_insert ON public.daily_goals
  FOR INSERT WITH CHECK (auth.uid() = student_id);

-- 본인만 수정
CREATE POLICY daily_goals_update ON public.daily_goals
  FOR UPDATE USING (auth.uid() = student_id);

-- ============================================================================
-- 2. RPC: set_daily_goal
-- ============================================================================
-- 학생이 일일 목표를 설정/변경 (UPSERT)

CREATE OR REPLACE FUNCTION public.set_daily_goal(p_daily_target int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  IF p_daily_target < 1 OR p_daily_target > 20 THEN
    RETURN jsonb_build_object('error', 'INVALID_TARGET');
  END IF;

  INSERT INTO public.daily_goals (student_id, daily_target, updated_at)
  VALUES (v_user_id, p_daily_target, now())
  ON CONFLICT (student_id) DO UPDATE
  SET daily_target = EXCLUDED.daily_target,
      updated_at = now();

  RETURN jsonb_build_object('success', true, 'daily_target', p_daily_target);
END;
$$;

COMMENT ON FUNCTION public.set_daily_goal IS '학생 일일 연습 목표 설정/변경 (1~20)';

-- ============================================================================
-- 3. RPC: get_daily_progress
-- ============================================================================
-- 오늘 연습 횟수, 목표, 달성 여부를 한 번에 반환
-- KST 기준으로 "오늘" 계산

CREATE OR REPLACE FUNCTION public.get_daily_progress()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_daily_target int;
  v_today_count int;
  v_today_date date;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  -- KST 기준 오늘 날짜
  v_today_date := (now() AT TIME ZONE 'Asia/Seoul')::date;

  -- 목표 조회 (미설정 시 기본 3회)
  SELECT daily_target INTO v_daily_target
  FROM public.daily_goals
  WHERE student_id = v_user_id;

  IF v_daily_target IS NULL THEN
    v_daily_target := 3;
  END IF;

  -- 오늘 연습 횟수 (KST 기준)
  SELECT COUNT(*)::int INTO v_today_count
  FROM public.practices
  WHERE student_id = v_user_id
    AND deleted_at IS NULL
    AND (created_at AT TIME ZONE 'Asia/Seoul')::date = v_today_date;

  RETURN jsonb_build_object(
    'daily_target', v_daily_target,
    'today_count', v_today_count,
    'completed', v_today_count >= v_daily_target
  );
END;
$$;

COMMENT ON FUNCTION public.get_daily_progress IS '오늘의 연습 달성도 조회 (목표, 현재 횟수, 달성 여부)';
