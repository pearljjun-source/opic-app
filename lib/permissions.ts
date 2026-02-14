import type { OrgRole } from './types';

/** owner 또는 teacher인지 (수업 가능 권한) */
export function canTeach(role: OrgRole | null): boolean {
  return role === 'owner' || role === 'teacher';
}

/** owner인지 (학원 관리 권한) */
export function canManageOrg(role: OrgRole | null): boolean {
  return role === 'owner';
}

/** 강사 초대 가능 여부 */
export function canInviteTeacher(role: OrgRole | null): boolean {
  return role === 'owner';
}

/** 학생 초대 가능 여부 */
export function canInviteStudent(role: OrgRole | null): boolean {
  return role === 'owner' || role === 'teacher';
}
