import * as v from 'valibot';

// ============================================================================
// Admin Dashboard — Valibot 검증 스키마
//
// 4단계 검증 전략의 클라이언트 레이어 (1단계: UI, 2단계: 서비스)
// 3단계: Edge Function, 4단계: PostgreSQL CHECK/Trigger
// ============================================================================

// ============================================================================
// Landing CMS
// ============================================================================

/** 랜딩 섹션 수정 (admin_update_landing_section) */
export const LandingSectionUpdateSchema = v.object({
  title: v.optional(v.pipe(v.string(), v.maxLength(200))),
  subtitle: v.optional(v.pipe(v.string(), v.maxLength(500))),
  content: v.optional(v.record(v.string(), v.unknown())),
  is_active: v.optional(v.boolean()),
});

export type LandingSectionUpdateInput = v.InferOutput<typeof LandingSectionUpdateSchema>;

/** 랜딩 아이템 생성/수정 (admin_upsert_landing_item) */
export const LandingItemSchema = v.object({
  id: v.optional(v.pipe(v.string(), v.uuid())),
  section_id: v.pipe(v.string(), v.uuid()),
  title: v.pipe(v.string(), v.minLength(1, '제목을 입력해주세요'), v.maxLength(200, '제목은 200자 이내여야 합니다')),
  description: v.optional(v.pipe(v.string(), v.maxLength(2000, '설명은 2000자 이내여야 합니다'))),
  icon: v.optional(v.pipe(v.string(), v.maxLength(50))),
  image_url: v.optional(v.pipe(
    v.string(),
    v.url('올바른 URL 형식이 아닙니다'),
    v.regex(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i, '지원하지 않는 이미지 형식입니다')
  )),
  video_url: v.optional(v.pipe(v.string(), v.url('올바른 URL 형식이 아닙니다'))),
  metadata: v.optional(v.record(v.string(), v.unknown())),
  sort_order: v.optional(v.pipe(v.number(), v.minValue(0, '순서는 0 이상이어야 합니다'))),
  is_active: v.optional(v.boolean()),
});

export type LandingItemInput = v.InferOutput<typeof LandingItemSchema>;

/** 아이템 순서 변경 (admin_reorder_items) */
export const ReorderItemSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  sort_order: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export const ReorderItemsSchema = v.array(ReorderItemSchema);

// ============================================================================
// 사용자 관리
// ============================================================================

/** 역할 변경 (admin_change_user_role) */
export const RoleChangeSchema = v.object({
  userId: v.pipe(v.string(), v.uuid('유효하지 않은 사용자 ID입니다')),
  newRole: v.picklist(['teacher', 'student'], '강사 또는 학생 역할만 지정할 수 있습니다'),
});

export type RoleChangeInput = v.InferOutput<typeof RoleChangeSchema>;

// ============================================================================
// 구독/결제
// ============================================================================

/** 빌링키 발급 요청 */
export const BillingKeySchema = v.object({
  planKey: v.picklist(['solo', 'pro', 'academy'], '유효하지 않은 플랜입니다'),
  authKey: v.pipe(v.string(), v.minLength(1, '인증 키가 필요합니다')),
});

export type BillingKeyInput = v.InferOutput<typeof BillingKeySchema>;

/** 플랜 수정 (admin_update_plan) */
export const PlanUpdateSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.minLength(1, '플랜 이름을 입력해주세요'), v.maxLength(100))),
  price_monthly: v.optional(v.pipe(v.number(), v.minValue(0, '가격은 0 이상이어야 합니다'))),
  price_yearly: v.optional(v.pipe(v.number(), v.minValue(0, '가격은 0 이상이어야 합니다'))),
  max_students: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1, '최소 1명 이상이어야 합니다'))),
  max_scripts: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1, '최소 1개 이상이어야 합니다'))),
  features: v.optional(v.array(v.string())),
});

export type PlanUpdateInput = v.InferOutput<typeof PlanUpdateSchema>;

// ============================================================================
// 이미지 업로드
// ============================================================================

/** 이미지 업로드 검증 */
export const ImageUploadSchema = v.object({
  fileSize: v.pipe(v.number(), v.maxValue(10 * 1024 * 1024, '파일 크기는 10MB 이하여야 합니다')),
  mimeType: v.picklist(
    ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    '지원하지 않는 이미지 형식입니다'
  ),
  width: v.optional(v.pipe(v.number(), v.maxValue(4000, '이미지 너비는 4000px 이하여야 합니다'))),
  height: v.optional(v.pipe(v.number(), v.maxValue(4000, '이미지 높이는 4000px 이하여야 합니다'))),
});

export type ImageUploadInput = v.InferOutput<typeof ImageUploadSchema>;

// ============================================================================
// 유틸리티
// ============================================================================

/**
 * Valibot 검증 결과에서 첫 번째 에러 메시지 추출
 *
 * 사용법:
 *   const result = v.safeParse(LandingItemSchema, input);
 *   if (!result.success) {
 *     const msg = getFirstValidationError(result);
 *     // → '제목을 입력해주세요'
 *   }
 */
export function getFirstValidationError(result: { success: boolean; issues?: Array<{ message?: string }> }): string {
  if (result.success) return '';
  const issue = result.issues?.[0];
  return issue?.message || '입력값이 올바르지 않습니다';
}
