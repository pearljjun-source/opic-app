import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';

import { useThemeColors } from '@/hooks/useTheme';
import type { Invite } from '@/lib/types';

interface InviteCodeCardProps {
  invite: Invite | null;
  isLoading?: boolean;
  onDelete?: () => void;
  targetRole?: 'student' | 'teacher';
}

/**
 * InviteCodeCard - 초대 코드 표시 카드
 *
 * 기능:
 * - 초대 코드 표시 (큰 글씨)
 * - 만료일 표시
 * - 클립보드 복사
 * - 삭제 기능
 */
export function InviteCodeCard({ invite, isLoading, onDelete, targetRole }: InviteCodeCardProps) {
  const colors = useThemeColors();
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, shadowColor: '#000000' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>로딩 중...</Text>
      </View>
    );
  }

  if (!invite) {
    return null;
  }

  const handleCopy = async () => {
    await Clipboard.setStringAsync(invite.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatExpiryDate = (expiresAt: string) => {
    const date = new Date(expiresAt);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return '만료됨';
    } else if (diffDays === 1) {
      return '내일 만료';
    } else {
      return `${diffDays}일 후 만료`;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, shadowColor: '#000000' }]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {targetRole === 'teacher' ? '강사 초대 코드' : '학생 초대 코드'}
      </Text>

      <Pressable onPress={handleCopy} style={[styles.codeContainer, { backgroundColor: colors.primaryLight }]}>
        <Text style={[styles.code, { color: colors.primary }]}>{invite.code}</Text>
        <Text style={[styles.copyHint, { color: colors.primaryDark }]}>
          {copied ? '복사됨!' : '탭하여 복사'}
        </Text>
      </Pressable>

      <View style={styles.infoRow}>
        <Text style={[styles.expiryText, { color: colors.warning }]}>
          {formatExpiryDate(invite.expires_at)}
        </Text>
      </View>

      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {targetRole === 'teacher'
          ? '강사에게 이 코드를 공유하세요.\n강사가 앱에서 코드를 입력하면 학원에 합류합니다.'
          : '학생에게 이 코드를 공유하세요.\n학생이 앱에서 코드를 입력하면 연결됩니다.'}
      </Text>

      {onDelete && (
        <Pressable style={styles.deleteButton} onPress={onDelete}>
          <Text style={[styles.deleteButtonText, { color: colors.error }]}>코드 삭제</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  codeContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 16,
  },
  code: {
    fontSize: 40,
    fontFamily: 'Pretendard-Bold',
    letterSpacing: 6,
  },
  copyHint: {
    marginTop: 8,
    fontSize: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  expiryText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
  },
  hint: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  deleteButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  deleteButtonText: {
    fontSize: 14,
  },
});

export default InviteCodeCard;
