import { supabase } from '@/lib/supabase';
import type { TeacherClassListItem, ClassDetailResult } from '@/lib/types';
import { classifyError, classifyRpcError } from '@/lib/errors';

// ============================================================================
// Types
// ============================================================================

interface ClassMutationResult {
  success: boolean;
  class_id?: string;
  error?: string;
}

// ============================================================================
// 반 목록 조회
// ============================================================================

export async function getTeacherClasses(): Promise<{
  data: TeacherClassListItem[] | null;
  error: Error | null;
}> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'get_teacher_classes'
  );

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'class' }) };
  }

  return { data: (data as TeacherClassListItem[]) || [], error: null };
}

// ============================================================================
// 반 상세 조회
// ============================================================================

export async function getClassDetail(classId: string): Promise<{
  data: ClassDetailResult | null;
  error: Error | null;
}> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'get_class_detail',
    { p_class_id: classId }
  );

  if (error) {
    return { data: null, error: classifyError(error, { resource: 'class' }) };
  }

  const result = data as ClassDetailResult;
  if (!result.success && result.error) {
    result.error = classifyRpcError(result.error, { resource: 'class' }).userMessage;
  }
  return { data: result, error: null };
}

// ============================================================================
// 반 생성
// ============================================================================

export async function createClass(
  name: string,
  description?: string
): Promise<ClassMutationResult> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'create_class',
    { p_name: name, p_description: description || null }
  );

  if (error) {
    return { success: false, error: classifyError(error, { resource: 'class' }).userMessage };
  }

  const result = data as ClassMutationResult;
  if (!result.success && result.error) {
    result.error = classifyRpcError(result.error, { resource: 'class' }).userMessage;
  }
  return result;
}

// ============================================================================
// 반 수정
// ============================================================================

export async function updateClass(
  classId: string,
  name?: string,
  description?: string
): Promise<ClassMutationResult> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'update_class',
    { p_class_id: classId, p_name: name || null, p_description: description ?? null }
  );

  if (error) {
    return { success: false, error: classifyError(error, { resource: 'class' }).userMessage };
  }

  const result = data as ClassMutationResult;
  if (!result.success && result.error) {
    result.error = classifyRpcError(result.error, { resource: 'class' }).userMessage;
  }
  return result;
}

// ============================================================================
// 반 삭제
// ============================================================================

export async function deleteClass(classId: string): Promise<ClassMutationResult> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'soft_delete_class',
    { p_class_id: classId }
  );

  if (error) {
    return { success: false, error: classifyError(error, { resource: 'class' }).userMessage };
  }

  const result = data as ClassMutationResult;
  if (!result.success && result.error) {
    result.error = classifyRpcError(result.error, { resource: 'class' }).userMessage;
  }
  return result;
}

// ============================================================================
// 반 멤버 추가
// ============================================================================

export async function addClassMember(
  classId: string,
  studentId: string
): Promise<ClassMutationResult> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'add_class_member',
    { p_class_id: classId, p_student_id: studentId }
  );

  if (error) {
    return { success: false, error: classifyError(error, { resource: 'class' }).userMessage };
  }

  const result = data as ClassMutationResult;
  if (!result.success && result.error) {
    result.error = classifyRpcError(result.error, { resource: 'class' }).userMessage;
  }
  return result;
}

// ============================================================================
// 반 멤버 제외
// ============================================================================

export async function removeClassMember(
  classId: string,
  studentId: string
): Promise<ClassMutationResult> {
  const { data, error } = await (supabase.rpc as CallableFunction)(
    'remove_class_member',
    { p_class_id: classId, p_student_id: studentId }
  );

  if (error) {
    return { success: false, error: classifyError(error, { resource: 'class' }).userMessage };
  }

  const result = data as ClassMutationResult;
  if (!result.success && result.error) {
    result.error = classifyRpcError(result.error, { resource: 'class' }).userMessage;
  }
  return result;
}

// ============================================================================
// 반 멤버 이동 (A반 → B반)
// ============================================================================

export async function moveClassMember(
  fromClassId: string,
  toClassId: string,
  studentId: string,
): Promise<ClassMutationResult> {
  // 1. 대상 반에 추가 (먼저 — 실패해도 원래 반에 영향 없음)
  const addResult = await addClassMember(toClassId, studentId);
  if (!addResult.success) return addResult;

  // 2. 기존 반에서 제거
  const removeResult = await removeClassMember(fromClassId, studentId);
  if (!removeResult.success) {
    // 롤백: 대상 반에서 다시 제거
    await removeClassMember(toClassId, studentId);
    return removeResult;
  }

  return { success: true };
}
