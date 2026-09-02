import { supabase } from '@/lib/supabase';
import { classifyError } from '@/lib/errors';
import { EXPRESSION_CATEGORIES } from '@/lib/expressions';
import type { ExpressionCategory, Expression } from '@/lib/expressions';

// ============================================================================
// Types
// ============================================================================

export interface DbExpressionCategory {
  id: string;
  key: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  is_custom: boolean;
  expressions: DbExpression[];
}

export interface DbExpression {
  id: string;
  en: string;
  ko: string;
  example: string;
  tip: string | null;
  level: 'basic' | 'intermediate' | 'advanced';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (table: string) => (supabase as any).from(table);

// ============================================================================
// 조회
// ============================================================================

/**
 * 핵심 표현 라이브러리 조회
 * DB에 데이터가 있으면 DB 우선, 없으면 로컬 기본 데이터 사용
 */
export async function getExpressions(organizationId?: string): Promise<{
  data: ExpressionCategory[];
  isFromDb: boolean;
  error: Error | null;
}> {
  // DB에서 조회 시도
  try {
    const { data, error } = await (supabase.rpc as CallableFunction)(
      'get_expressions',
      { p_organization_id: organizationId || null }
    );

    if (!error && data?.success && data.categories?.length > 0) {
      // DB 데이터를 ExpressionCategory 형태로 변환
      const categories: ExpressionCategory[] = data.categories.map((cat: DbExpressionCategory) => ({
        id: cat.id,
        key: cat.key,
        label: cat.label,
        icon: cat.icon,
        color: cat.color,
        description: cat.description,
        expressions: cat.expressions.map((expr: DbExpression) => ({
          id: expr.id,
          en: expr.en,
          ko: expr.ko,
          example: expr.example,
          tip: expr.tip || undefined,
          level: expr.level,
        })),
      }));
      return { data: categories, isFromDb: true, error: null };
    }
  } catch {
    // DB 조회 실패 시 로컬 폴백
    if (__DEV__) console.warn('[AppError] expressions RPC failed, using local data');
  }

  // 로컬 기본 데이터 폴백
  return { data: EXPRESSION_CATEGORIES, isFromDb: false, error: null };
}

// ============================================================================
// 강사용 CRUD
// ============================================================================

/**
 * 카테고리 생성 (조직 커스텀)
 */
export async function createExpressionCategory(params: {
  organizationId: string;
  key: string;
  label: string;
  icon?: string;
  color?: string;
  description?: string;
  sortOrder?: number;
}): Promise<{ data: { id: string } | null; error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new Error('AUTH_REQUIRED') };

  const { data, error } = await fromTable('expression_categories')
    .insert({
      organization_id: params.organizationId,
      key: params.key,
      label: params.label,
      icon: params.icon || 'bookmark-outline',
      color: params.color || '#6366F1',
      description: params.description || '',
      sort_order: params.sortOrder ?? 0,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) return { data: null, error: classifyError(error, { resource: 'expression_category' }) };
  return { data, error: null };
}

/**
 * 카테고리 수정
 */
export async function updateExpressionCategory(
  categoryId: string,
  updates: { label?: string; icon?: string; color?: string; description?: string; sort_order?: number; is_active?: boolean },
): Promise<{ error: Error | null }> {
  const { error } = await fromTable('expression_categories')
    .update(updates)
    .eq('id', categoryId);

  if (error) return { error: classifyError(error, { resource: 'expression_category' }) };
  return { error: null };
}

/**
 * 카테고리 삭제 (소프트)
 */
export async function deleteExpressionCategory(categoryId: string): Promise<{ error: Error | null }> {
  const { error } = await fromTable('expression_categories')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', categoryId);

  if (error) return { error: classifyError(error, { resource: 'expression_category' }) };
  return { error: null };
}

/**
 * 표현 추가
 */
export async function createExpression(params: {
  categoryId: string;
  expressionEn: string;
  expressionKo: string;
  example?: string;
  tip?: string;
  level?: 'basic' | 'intermediate' | 'advanced';
  sortOrder?: number;
}): Promise<{ data: { id: string } | null; error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new Error('AUTH_REQUIRED') };

  const { data, error } = await fromTable('expressions')
    .insert({
      category_id: params.categoryId,
      expression_en: params.expressionEn,
      expression_ko: params.expressionKo,
      example: params.example || '',
      tip: params.tip || null,
      level: params.level || 'basic',
      sort_order: params.sortOrder ?? 0,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) return { data: null, error: classifyError(error, { resource: 'expression' }) };
  return { data, error: null };
}

/**
 * 표현 수정
 */
export async function updateExpression(
  expressionId: string,
  updates: {
    expression_en?: string;
    expression_ko?: string;
    example?: string;
    tip?: string | null;
    level?: 'basic' | 'intermediate' | 'advanced';
    sort_order?: number;
    is_active?: boolean;
  },
): Promise<{ error: Error | null }> {
  const { error } = await fromTable('expressions')
    .update(updates)
    .eq('id', expressionId);

  if (error) return { error: classifyError(error, { resource: 'expression' }) };
  return { error: null };
}

/**
 * 표현 삭제 (소프트)
 */
export async function deleteExpression(expressionId: string): Promise<{ error: Error | null }> {
  const { error } = await fromTable('expressions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', expressionId);

  if (error) return { error: classifyError(error, { resource: 'expression' }) };
  return { error: null };
}

/**
 * 글로벌 기본 데이터를 조직 커스텀으로 복제
 * (강사가 "기본 데이터에서 시작" 할 때 사용)
 */
export async function cloneGlobalToOrg(organizationId: string, categoryKey: string): Promise<{
  data: { categoryId: string } | null;
  error: Error | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new Error('AUTH_REQUIRED') };

  // 로컬 데이터에서 해당 카테고리 찾기
  const localCat = EXPRESSION_CATEGORIES.find(c => c.key === categoryKey);
  if (!localCat) return { data: null, error: new Error('CATEGORY_NOT_FOUND') };

  // 카테고리 생성
  const { data: catData, error: catError } = await createExpressionCategory({
    organizationId,
    key: localCat.key,
    label: localCat.label,
    icon: localCat.icon,
    color: localCat.color,
    description: localCat.description,
  });

  if (catError || !catData) return { data: null, error: catError };

  // 표현 일괄 삽입
  const expressions = localCat.expressions.map((expr, i) => ({
    category_id: catData.id,
    expression_en: expr.en,
    expression_ko: expr.ko,
    example: expr.example,
    tip: expr.tip || null,
    level: expr.level || 'basic',
    sort_order: i,
    created_by: user.id,
  }));

  const { error: exprError } = await fromTable('expressions').insert(expressions);
  if (exprError) return { data: null, error: classifyError(exprError, { resource: 'expression' }) };

  return { data: { categoryId: catData.id }, error: null };
}
