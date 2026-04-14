import { View, Text, StyleSheet, Pressable, ActivityIndicator, Share, Platform } from 'react-native';
import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { getInviteLink } from '@/services/invites';
import { showToast } from '@/lib/toast';
import type { InviteWithClass } from '@/lib/types';

interface InviteCodeCardProps {
  invite: InviteWithClass | null;
  isLoading?: boolean;
  onDelete?: () => void;
  onShowQR?: () => void;
  targetRole?: 'student' | 'teacher';
}

/**
 * InviteCodeCard - 초대 코드 표시 카드
 *
 * 기능:
 * - 초대 코드 표시 (큰 글씨)
 * - 반 이름 뱃지 (연결 시)
 * - 사용량 표시 (다회용)
 * - 공유 버튼: 코드 복사, 링크 복사/공유, QR 보기
 * - 만료일 표시
 * - 삭제 기능
 */
export function InviteCodeCard({ invite, isLoading, onDelete, onShowQR, targetRole }: InviteCodeCardProps) {
  const colors = useThemeColors();
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);

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

  const isMultiUse = invite.max_uses !== 1;
  const maxUses = invite.max_uses;
  const useCount = invite.use_count;
  const className = invite.classes?.name;
  const inviteLink = getInviteLink(invite.code);

  const copyToClipboard = async (text: string) => {
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // fallback: execCommand
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } else {
      await Clipboard.setStringAsync(text);
    }
  };

  const handleCopyCode = async () => {
    try {
      await copyToClipboard(invite.code);
      setCopiedType('code');
      showToast('코드가 복사되었습니다', 'success');
      setTimeout(() => setCopiedType(null), 2000);
    } catch (e) {
      if (__DEV__) console.warn('[InviteCodeCard] copyCode error:', e);
      showToast('복사에 실패했습니다', 'error');
    }
  };

  const handleCopyLink = async () => {
    try {
      await copyToClipboard(inviteLink);
      setCopiedType('link');
      showToast('링크가 복사되었습니다', 'success');
      setTimeout(() => setCopiedType(null), 2000);
    } catch (e) {
      if (__DEV__) console.warn('[InviteCodeCard] copyLink error:', e);
      showToast('복사에 실패했습니다', 'error');
    }
  };

  const handleShare = async () => {
    const message = className
      ? `${className} 반에 참여하세요!\n초대 코드: ${invite.code}\n링크: ${inviteLink}`
      : `Speaky에 참여하세요!\n초대 코드: ${invite.code}\n링크: ${inviteLink}`;

    try {
      if (__DEV__) console.warn('[InviteCodeCard] handleShare called, Platform.OS:', Platform.OS);
      if (Platform.OS === 'web') {
        await copyToClipboard(message);
        if (__DEV__) console.warn('[InviteCodeCard] clipboard copy succeeded');
        showToast('초대 메시지가 복사되었습니다', 'success');
      } else {
        await Share.share({ message, url: inviteLink });
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      if (__DEV__) console.warn('[InviteCodeCard] share error:', e);
      showToast('공유에 실패했습니다', 'error');
    }
  };

  const formatExpiryDate = (expiresAt: string) => {
    const date = new Date(expiresAt);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 36500) return null; // 100년 이상 = 영구 코드, 표시 안 함
    if (diffDays <= 0) return '만료됨';
    if (diffDays === 1) return '내일 만료';
    return `${diffDays}일 후 만료`;
  };

  const formatUsage = () => {
    if (maxUses === 0) return `${useCount}명 사용`;
    return `${useCount}/${maxUses}명`;
  };

  const usageRatio = maxUses > 0 ? useCount / maxUses : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, shadowColor: '#000000' }]}>
      {/* 헤더: 라벨 + 반 뱃지 */}
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {targetRole === 'teacher' ? '강사 초대 코드' : '학생 초대 코드'}
        </Text>
        {className && (
          <View style={[styles.classBadge, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="school-outline" size={12} color={colors.primary} />
            <Text style={[styles.classBadgeText, { color: colors.primary }]}>{className}</Text>
          </View>
        )}
      </View>

      {/* 코드 */}
      <Pressable onPress={handleCopyCode} style={[styles.codeContainer, { backgroundColor: colors.primaryLight }]}>
        <Text style={[styles.code, { color: colors.primary }]}>{invite.code}</Text>
        <Text style={[styles.copyHint, { color: colors.primaryDark }]}>
          {copiedType === 'code' ? '복사됨!' : '탭하여 복사'}
        </Text>
      </Pressable>

      {/* 사용량 (다회용) */}
      {isMultiUse && (
        <View style={styles.usageContainer}>
          <Text style={[styles.usageText, { color: colors.textSecondary }]}>사용: {formatUsage()}</Text>
          {maxUses > 0 && (
            <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressBarFill,
                  { backgroundColor: usageRatio >= 0.9 ? colors.error : colors.primary, width: `${Math.min(usageRatio * 100, 100)}%` },
                ]}
              />
            </View>
          )}
        </View>
      )}

      {/* 만료일 (영구 코드는 표시 안 함) */}
      {formatExpiryDate(invite.expires_at) && (
        <View style={styles.infoRow}>
          <Text style={[styles.expiryText, { color: colors.warning }]}>
            {formatExpiryDate(invite.expires_at)}
          </Text>
        </View>
      )}

      {/* 공유 버튼 3개 */}
      <View style={styles.shareRow}>
        <Pressable
          style={[styles.shareButton, { backgroundColor: colors.surfaceSecondary }]}
          onPress={handleCopyLink}
        >
          <Ionicons name="link-outline" size={18} color={colors.textPrimary} />
          <Text style={[styles.shareButtonText, { color: colors.textPrimary }]}>
            {copiedType === 'link' ? '복사됨!' : '링크 복사'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.shareButton, { backgroundColor: colors.surfaceSecondary }]}
          onPress={handleShare}
        >
          <Ionicons name="share-outline" size={18} color={colors.textPrimary} />
          <Text style={[styles.shareButtonText, { color: colors.textPrimary }]}>공유</Text>
        </Pressable>

        {onShowQR && (
          <Pressable
            style={[styles.shareButton, { backgroundColor: colors.surfaceSecondary }]}
            onPress={onShowQR}
          >
            <Ionicons name="qr-code-outline" size={18} color={colors.textPrimary} />
            <Text style={[styles.shareButtonText, { color: colors.textPrimary }]}>QR</Text>
          </Pressable>
        )}
      </View>

      {/* 삭제 */}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
  },
  classBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  classBadgeText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
  },
  codeContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 12,
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
  usageContainer: {
    width: '100%',
    marginBottom: 12,
    alignItems: 'center',
    gap: 6,
  },
  usageText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
  },
  progressBarBg: {
    width: '80%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
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
  shareRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  shareButtonText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
  },
  deleteButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  deleteButtonText: {
    fontSize: 14,
  },
});

export default InviteCodeCard;
