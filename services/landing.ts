import { supabase } from '@/lib/supabase';
import { AppError, classifyError, classifyRpcError } from '@/lib/errors';
import { safeParse } from 'valibot';
import {
  LandingSectionUpdateSchema,
  LandingItemSchema,
  ReorderItemsSchema,
  ImageUploadSchema,
  VideoUploadSchema,
} from '@/lib/validations';
import { STORAGE_BUCKETS } from '@/lib/constants';
import type { LandingSection, LandingItem } from '@/lib/types';

// ============================================================================
// Landing CMS 서비스
// ============================================================================

/** 랜딩 섹션 목록 조회 (공개) */
export async function getLandingSections(): Promise<{
  data: LandingSection[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('landing_sections')
    .select('*')
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) return { data: null, error: classifyError(error, { resource: 'landing_section' }) };
  return { data: data as LandingSection[], error: null };
}

/** 특정 섹션의 아이템 목록 조회 (공개) */
export async function getLandingItems(sectionId: string): Promise<{
  data: LandingItem[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('landing_items')
    .select('*')
    .eq('section_id', sectionId)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) return { data: null, error: classifyError(error, { resource: 'landing_item' }) };
  return { data: data as LandingItem[], error: null };
}

/** 모든 섹션 + 아이템 일괄 조회 (공개, 랜딩 페이지 렌더링용) */
export async function getLandingData(): Promise<{
  data: { sections: LandingSection[]; items: Record<string, LandingItem[]> } | null;
  error: Error | null;
}> {
  // 두 쿼리를 병렬 실행
  const [sectionsResult, itemsResult] = await Promise.all([
    supabase
      .from('landing_sections')
      .select('*')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('landing_items')
      .select('*')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ]);

  if (sectionsResult.error) {
    return { data: null, error: classifyError(sectionsResult.error, { resource: 'landing_section' }) };
  }
  if (itemsResult.error) {
    return { data: null, error: classifyError(itemsResult.error, { resource: 'landing_item' }) };
  }

  const sections = sectionsResult.data as LandingSection[];
  const allItems = itemsResult.data as LandingItem[];

  // section_id별로 아이템 그룹핑
  const items: Record<string, LandingItem[]> = {};
  for (const item of allItems) {
    if (!items[item.section_id]) {
      items[item.section_id] = [];
    }
    items[item.section_id].push(item);
  }

  return { data: { sections, items }, error: null };
}

// ============================================================================
// Admin 전용 — CRUD
// ============================================================================

/** 모든 섹션 조회 (admin, 비활성 포함) */
export async function getAllLandingSections(): Promise<{
  data: LandingSection[] | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await supabase
    .from('landing_sections')
    .select('*')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });

  if (error) return { data: null, error: classifyError(error, { resource: 'landing_section' }) };
  return { data: data as LandingSection[], error: null };
}

/** 섹션의 모든 아이템 조회 (admin, 비활성 포함) */
export async function getAllLandingItems(sectionId: string): Promise<{
  data: LandingItem[] | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await supabase
    .from('landing_items')
    .select('*')
    .eq('section_id', sectionId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });

  if (error) return { data: null, error: classifyError(error, { resource: 'landing_item' }) };
  return { data: data as LandingItem[], error: null };
}

/** 섹션 수정 */
export async function updateLandingSection(
  sectionKey: string,
  updates: Record<string, unknown>
): Promise<{ data: { success: boolean } | null; error: Error | null }> {
  // Valibot 검증
  const result = safeParse(LandingSectionUpdateSchema, updates);
  if (!result.success) {
    return { data: null, error: new AppError('VAL_FAILED') };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'admin_update_landing_section',
    {
      p_section_key: sectionKey,
      p_updates: result.output,
    }
  );

  if (error) return { data: null, error: classifyError(error, { resource: 'landing_section' }) };

  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'landing_section' }) };
  }

  return { data: { success: true }, error: null };
}

/** 아이템 생성/수정 */
export async function upsertLandingItem(
  item: Record<string, unknown>
): Promise<{ data: { id: string } | null; error: Error | null }> {
  // Valibot 검증
  const result = safeParse(LandingItemSchema, item);
  if (!result.success) {
    return { data: null, error: new AppError('VAL_FAILED') };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'admin_upsert_landing_item',
    { p_item: result.output }
  );

  if (error) return { data: null, error: classifyError(error, { resource: 'landing_item' }) };

  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'landing_item' }) };
  }

  return { data: { id: data?.id || '' }, error: null };
}

/** 아이템 삭제 (soft delete) */
export async function deleteLandingItem(
  itemId: string
): Promise<{ data: { success: boolean } | null; error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'admin_delete_landing_item',
    { p_item_id: itemId }
  );

  if (error) return { data: null, error: classifyError(error, { resource: 'landing_item' }) };

  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'landing_item' }) };
  }

  return { data: { success: true }, error: null };
}

/** 아이템 순서 변경 */
export async function reorderLandingItems(
  items: Array<{ id: string; sort_order: number }>
): Promise<{ data: { success: boolean } | null; error: Error | null }> {
  // Valibot 검증
  const result = safeParse(ReorderItemsSchema, items);
  if (!result.success) {
    return { data: null, error: new AppError('ADMIN_REORDER_FAILED') };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  const { data, error } = await (supabase.rpc as CallableFunction)(
    'admin_reorder_items',
    { p_items: result.output }
  );

  if (error) return { data: null, error: classifyError(error, { resource: 'landing_item' }) };

  if (data?.error) {
    return { data: null, error: classifyRpcError(data.error, { resource: 'landing_item' }) };
  }

  return { data: { success: true }, error: null };
}

/** 랜딩 에셋 업로드 (이미지 또는 동영상) */
export async function uploadLandingAsset(
  file: Blob,
  section: string,
  filename: string,
  fileInfo: { size: number; mimeType: string },
  type: 'image' | 'video' = 'image'
): Promise<{ data: { url: string } | null; error: Error | null }> {
  // Valibot 검증 (타입에 따라 스키마 선택)
  const schema = type === 'video' ? VideoUploadSchema : ImageUploadSchema;
  const validation = safeParse(schema, {
    fileSize: fileInfo.size,
    mimeType: fileInfo.mimeType,
  });
  if (!validation.success) {
    return { data: null, error: new AppError('ADMIN_UPLOAD_FAILED') };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new AppError('AUTH_REQUIRED') };

  // 파일명 sanitize + timestamp prefix
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${section}/${Date.now()}_${sanitized}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.LANDING_ASSETS)
    .upload(path, file, {
      contentType: fileInfo.mimeType,
      upsert: false,
    });

  if (uploadError) {
    return { data: null, error: new AppError('ADMIN_UPLOAD_FAILED', { originalError: uploadError }) };
  }

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKETS.LANDING_ASSETS)
    .getPublicUrl(path);

  return { data: { url: urlData.publicUrl }, error: null };
}
