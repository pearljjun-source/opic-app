-- ============================================================================
-- 050: 스크립트 한국어 번역 (한→영 연습 기능)
-- 목적: 영어 스크립트의 한국어 번역을 캐싱하여 한→영 연습 지원
-- ============================================================================
-- 변경 내역:
--   1. scripts 테이블에 content_ko 컬럼 추가 (nullable)
--   2. content 변경 시 content_ko 자동 리셋 트리거
-- ============================================================================

-- 1. content_ko 컬럼 추가
ALTER TABLE public.scripts ADD COLUMN IF NOT EXISTS content_ko text;

COMMENT ON COLUMN public.scripts.content_ko
  IS '영어 스크립트의 한국어 번역 (AI 자동 생성, 캐시). content 변경 시 자동 NULL 리셋.';

-- 2. content 변경 시 content_ko 자동 리셋 트리거
CREATE OR REPLACE FUNCTION public.reset_content_ko_on_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- content가 실제로 변경된 경우에만 content_ko 리셋
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.content_ko := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reset_content_ko
  BEFORE UPDATE ON public.scripts
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_content_ko_on_update();

COMMENT ON FUNCTION public.reset_content_ko_on_update()
  IS '스크립트 content 변경 시 캐시된 한국어 번역(content_ko)을 자동 리셋';
