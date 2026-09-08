-- ============================================================================
-- 083: 예약 작업(pg_cron) 설치
--
-- 왜:
--   이 프로젝트에는 예약 작업이 하나도 없었다. pg_cron · pg_net 이 설치된 적이
--   없고, GitHub Actions 에도 함수를 부르는 워크플로가 없다 (2026-09-08 확인).
--   CLAUDE.md 가 "subscription-renew Cron (매시간)" 과 "[2차 방어]" 로 적어둔
--   복구 아키텍처는 문서에만 있었다.
--
--   그 결과:
--     · 구독 갱신이 한 번도 실행되지 않았다 (구독 하나가 5개월 밀림)
--     · incomplete 구독 복구, 트라이얼 만료, Dunning 전부 미동작
--     · 개인정보처리방침 제4조 ③ 이 고지한 녹음 6개월 자동 삭제 미동작
--
-- ⚠️ 적용 전에 반드시 할 것
--   1. Edge Function 시크릿 `CRON_SECRET` 설정 (Supabase 대시보드 또는 CLI)
--   2. 아래 Vault 시크릿 등록 — **이 파일에 값을 적지 않는다**
--
--        select vault.create_secret('<CRON_SECRET 과 같은 값>', 'cron_secret');
--        select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--        select vault.create_secret('<anon key>', 'anon_key');
--
--      Vault 를 쓰는 이유는 cron.job.command 에 시크릿이 평문으로 남지 않게
--      하기 위해서다. 저장소에도, 작업 정의에도 값이 들어가지 않는다.
--   3. `subscription-renew` · `purge-recordings` 를 fail-closed 버전으로 배포
--      (순서가 반대면 인증 없이 도는 창이 생긴다)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- 헬퍼: Edge Function 을 cron 인증 헤더와 함께 호출한다
--
-- 시크릿을 Vault 에서 그때그때 읽으므로 작업 정의에는 이름만 남는다.
--
-- 인증이 두 겹인 이유:
--   Authorization  Supabase 게이트웨이(verify_jwt)를 통과하기 위한 프로젝트 키.
--                  anon key 는 클라이언트 앱에 들어가는 공개 값이라 이것만으로는
--                  아무 권한도 없다. 인터넷의 아무 요청이나 함수까지 닿지 못하게
--                  하는 1차 문일 뿐이다.
--   x-cron-secret  실제 인가. 이 값을 아는 쪽만 함수를 실행할 수 있다.
--
--   ⚠️ 이 함수들은 verify_jwt 를 끄지 않는다. 다른 Edge Function 들은 꺼져 있지만
--      (자체 인증을 하므로), 결제를 일으키고 파일을 지우는 쪽은 문을 하나 더 둔다.
-- ============================================================================

CREATE OR REPLACE FUNCTION public._invoke_cron_function(p_function_name text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url text;
  v_secret text;
  v_anon_key text;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'project_url';

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'cron_secret';

  SELECT decrypted_secret INTO v_anon_key
  FROM vault.decrypted_secrets WHERE name = 'anon_key';

  IF v_url IS NULL OR v_secret IS NULL OR v_anon_key IS NULL THEN
    RAISE EXCEPTION 'Vault secrets (project_url, cron_secret, anon_key) are not configured';
  END IF;

  RETURN net.http_post(
    url := v_url || '/functions/v1/' || p_function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key,
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
END;
$$;

REVOKE ALL ON FUNCTION public._invoke_cron_function(text) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 작업 등록
-- ============================================================================

-- 구독 갱신 — 매시간 정각.
-- 시간 단위인 이유는 incomplete 구독 복구(10분~24시간 된 것) 때문이다. 하루 한 번
-- 이면 "돈은 나갔는데 서비스는 못 쓰는" 창이 최대 하루가 된다.
SELECT cron.schedule(
  'subscription-renew-hourly',
  '0 * * * *',
  $$SELECT public._invoke_cron_function('subscription-renew')$$
);

-- 녹음 파기 — 매일 새벽 3시 UTC (한국 낮 12시).
-- 사용이 적은 시간을 고를 이유가 없다. Storage 삭제는 사용자 요청과 경합하지 않는다.
SELECT cron.schedule(
  'purge-recordings-daily',
  '0 3 * * *',
  $$SELECT public._invoke_cron_function('purge-recordings')$$
);

-- ============================================================================
-- 확인
--
--   select jobid, jobname, schedule, active from cron.job;
--   select jobid, status, return_message, start_time
--     from cron.job_run_details order by start_time desc limit 10;
--
-- 되돌리려면:
--   select cron.unschedule('subscription-renew-hourly');
--   select cron.unschedule('purge-recordings-daily');
-- ============================================================================
