-- ============================================================================
-- 082: 학생이 개별 연습 기록을 삭제할 수 있게 한다
--
-- 왜:
--   개인정보처리방침 제6조 ②는 "개인정보 정정·삭제 요구" 를 이용자 권리로
--   고지하고 있는데, 앱에는 연습 하나를 지우는 경로가 없었다. 전부 지우거나(탈퇴)
--   아무것도 못 지우거나 둘 중 하나였다.
--
--   실수로 개인적인 이야기를 녹음했거나 잘못 녹음한 것을 지우고 싶어도 방법이 없다.
--
-- 왜 RPC 인가:
--   practices_update_student 정책의 WITH CHECK 가 `deleted_at IS NULL` 을 요구해서
--   클라이언트가 UPDATE 로 소프트 삭제할 수 없다. 정책을 느슨하게 푸는 대신
--   서버가 소유권을 확인하는 RPC 를 둔다 (soft_delete_invite, soft_delete_class 와 동일 패턴).
--
-- ⚠️ 음성 파일은 이 함수가 지우지 못한다(DB 에서 Storage 에 접근할 수 없다).
--    반환된 audio_path 로 클라이언트가 Storage 객체를 지운다.
--    파일 삭제에 실패하면 기록만 숨겨지고 파일이 남으므로, 호출부는 실패를 삼키지 말 것.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_practice(p_practice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_audio_path text;
  v_rows int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 본인 기록만. CAS: 이미 삭제된 것은 0건이 되어 아래에서 걸러진다
  UPDATE public.practices
  SET deleted_at = now()
  WHERE id = p_practice_id
    AND student_id = v_user_id
    AND deleted_at IS NULL
  RETURNING audio_url INTO v_audio_path;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    -- 남의 기록이거나 이미 지워졌다. 어느 쪽인지 알려주지 않는다
    -- (존재 여부를 캐낼 수 있게 된다)
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'audio_path', v_audio_path
  );
END;
$$;

COMMENT ON FUNCTION public.soft_delete_practice IS
  '학생 본인의 연습 기록 소프트 삭제. 음성 파일 경로를 돌려주므로 호출부가 Storage 객체를 지운다';

REVOKE EXECUTE ON FUNCTION public.soft_delete_practice(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_practice(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
