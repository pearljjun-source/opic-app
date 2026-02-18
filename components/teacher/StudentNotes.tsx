import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { OPIC_GRADES } from '@/lib/constants';
import { useThemeColors } from '@/hooks/useTheme';
import { updateStudentNotes } from '@/services/students';
import { getUserMessage } from '@/lib/errors';
import type { OpicGrade } from '@/lib/types';

interface StudentNotesProps {
  studentId: string;
  initialNotes: string | null;
  initialTargetGrade: OpicGrade | null;
  onSaved?: () => void;
}

/**
 * StudentNotes - 학생별 메모 + 목표 등급 설정
 *
 * 기능:
 * - 메모 텍스트 입력 (2000자 제한)
 * - OPIc 목표 등급 선택 (OPIC_GRADES 기반)
 * - 저장 버튼으로 RPC 호출
 */
export function StudentNotes({
  studentId,
  initialNotes,
  initialTargetGrade,
  onSaved,
}: StudentNotesProps) {
  const colors = useThemeColors();
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [targetGrade, setTargetGrade] = useState<OpicGrade | null>(initialTargetGrade);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const hasChanges =
    notes !== (initialNotes ?? '') || targetGrade !== initialTargetGrade;

  const handleSave = useCallback(async () => {
    if (!hasChanges || isSaving) return;

    setIsSaving(true);
    setSaveMessage(null);

    const { error } = await updateStudentNotes({
      studentId,
      notes,           // '' = 비우기, 텍스트 = 설정
      targetGrade,     // null = 비우기, OpicGrade = 설정
    });

    setIsSaving(false);

    if (error) {
      setSaveMessage(getUserMessage(error));
    } else {
      setSaveMessage('저장 완료');
      onSaved?.();
      setTimeout(() => setSaveMessage(null), 2000);
    }
  }, [studentId, notes, targetGrade, hasChanges, isSaving, onSaved]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, shadowColor: '#000000' }]}>
      {/* 목표 등급 선택 */}
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>목표 등급</Text>
      <View style={styles.gradeRow}>
        {OPIC_GRADES.map((grade) => {
          const isSelected = targetGrade === grade;
          return (
            <Pressable
              key={grade}
              style={[
                styles.gradeChip,
                { backgroundColor: colors.borderLight },
                isSelected && { backgroundColor: colors.primary },
              ]}
              onPress={() => setTargetGrade(isSelected ? null : (grade as OpicGrade))}
            >
              <Text
                style={[
                  styles.gradeChipText,
                  { color: colors.textSecondary },
                  isSelected && { color: '#FFFFFF' },
                ]}
              >
                {grade}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 메모 입력 */}
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>메모</Text>
      <TextInput
        style={[styles.textInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.textPrimary }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="학생에 대한 메모를 입력하세요"
        placeholderTextColor={colors.gray400}
        multiline
        maxLength={2000}
        textAlignVertical="top"
      />
      <Text style={[styles.charCount, { color: colors.gray400 }]}>{notes.length}/2000</Text>

      {/* 저장 버튼 + 상태 메시지 */}
      <View style={styles.footer}>
        {saveMessage && (
          <Text
            style={[
              styles.saveMessage,
              { color: saveMessage === '저장 완료' ? colors.success : colors.error },
            ]}
          >
            {saveMessage}
          </Text>
        )}
        <Pressable
          style={[styles.saveButton, { backgroundColor: colors.primary }, (!hasChanges || isSaving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="save-outline" size={16} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>저장</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 8,
  },
  gradeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  gradeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  gradeChipText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    minHeight: 100,
  },
  charCount: {
    fontSize: 11,
    fontFamily: 'Pretendard-Regular',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  saveMessage: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
  },
});
