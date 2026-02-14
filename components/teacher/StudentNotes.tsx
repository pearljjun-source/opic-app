import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, OPIC_GRADES } from '@/lib/constants';
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
    <View style={styles.container}>
      {/* 목표 등급 선택 */}
      <Text style={styles.sectionTitle}>목표 등급</Text>
      <View style={styles.gradeRow}>
        {OPIC_GRADES.map((grade) => {
          const isSelected = targetGrade === grade;
          return (
            <Pressable
              key={grade}
              style={[styles.gradeChip, isSelected && styles.gradeChipSelected]}
              onPress={() => setTargetGrade(isSelected ? null : (grade as OpicGrade))}
            >
              <Text
                style={[styles.gradeChipText, isSelected && styles.gradeChipTextSelected]}
              >
                {grade}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 메모 입력 */}
      <Text style={styles.sectionTitle}>메모</Text>
      <TextInput
        style={styles.textInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="학생에 대한 메모를 입력하세요"
        placeholderTextColor={COLORS.GRAY_400}
        multiline
        maxLength={2000}
        textAlignVertical="top"
      />
      <Text style={styles.charCount}>{notes.length}/2000</Text>

      {/* 저장 버튼 + 상태 메시지 */}
      <View style={styles.footer}>
        {saveMessage && (
          <Text
            style={[
              styles.saveMessage,
              { color: saveMessage === '저장 완료' ? COLORS.SUCCESS : COLORS.ERROR },
            ]}
          >
            {saveMessage}
          </Text>
        )}
        <Pressable
          style={[styles.saveButton, (!hasChanges || isSaving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={COLORS.WHITE} />
          ) : (
            <>
              <Ionicons name="save-outline" size={16} color={COLORS.WHITE} />
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
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
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
    backgroundColor: COLORS.GRAY_100,
  },
  gradeChipSelected: {
    backgroundColor: COLORS.PRIMARY,
  },
  gradeChipText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.TEXT_SECONDARY,
  },
  gradeChipTextSelected: {
    color: COLORS.WHITE,
  },
  textInput: {
    backgroundColor: COLORS.GRAY_50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: 12,
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.TEXT_PRIMARY,
    minHeight: 100,
  },
  charCount: {
    fontSize: 11,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.GRAY_400,
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
    backgroundColor: COLORS.PRIMARY,
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
    color: COLORS.WHITE,
  },
});
