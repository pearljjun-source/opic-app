import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { router, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { getConnectedStudents } from '@/services/students';
import { getTeacherClasses } from '@/services/classes';
import { StudentCard, ClassCard } from '@/components/teacher';
import type { TeacherStudentListItem, TeacherClassListItem } from '@/lib/types';
import { getUserMessage } from '@/lib/errors';

type ActiveSection = 'students' | 'classes';

export default function TeacherDashboard() {
  const navigation = useNavigation();
  const [activeSection, setActiveSection] = useState<ActiveSection>('students');

  useLayoutEffect(() => {
    navigation.setOptions({
      title: activeSection === 'students' ? '학생 목록' : '반 관리',
    });
  }, [activeSection, navigation]);

  // Students state
  const [students, setStudents] = useState<TeacherStudentListItem[]>([]);
  const [isStudentsLoading, setIsStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);

  // Classes state
  const [classes, setClasses] = useState<TeacherClassListItem[]>([]);
  const [isClassesLoading, setIsClassesLoading] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [classesLoaded, setClassesLoaded] = useState(false);

  const fetchStudents = useCallback(async () => {
    setIsStudentsLoading(true);
    setStudentsError(null);

    const { data, error: fetchError } = await getConnectedStudents();

    if (fetchError) {
      setStudentsError(getUserMessage(fetchError));
    } else {
      setStudents(data || []);
    }

    setIsStudentsLoading(false);
  }, []);

  const fetchClasses = useCallback(async () => {
    setIsClassesLoading(true);
    setClassesError(null);

    const { data, error: fetchError } = await getTeacherClasses();

    if (fetchError) {
      setClassesError(getUserMessage(fetchError));
    } else {
      setClasses(data || []);
    }

    setIsClassesLoading(false);
    setClassesLoaded(true);
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // 반 관리 탭을 처음 누를 때 로드
  useEffect(() => {
    if (activeSection === 'classes' && !classesLoaded) {
      fetchClasses();
    }
  }, [activeSection, classesLoaded, fetchClasses]);

  // 탭 전환 시 데이터 새로고침
  const handleSectionChange = (section: ActiveSection) => {
    setActiveSection(section);
    if (section === 'students') {
      fetchStudents();
    } else {
      fetchClasses();
    }
  };

  const handleStudentPress = (studentId: string) => {
    router.push(`/student/${studentId}`);
  };

  const handleClassPress = (classId: string) => {
    router.push(`/class/${classId}` as any);
  };

  // ========== Render ==========

  const renderSegmentControl = () => (
    <View style={styles.segmentContainer}>
      <Pressable
        style={[
          styles.segmentButton,
          activeSection === 'students' && styles.segmentButtonActive,
        ]}
        onPress={() => handleSectionChange('students')}
      >
        <Text
          style={[
            styles.segmentText,
            activeSection === 'students' && styles.segmentTextActive,
          ]}
        >
          학생 목록
        </Text>
      </Pressable>
      <Pressable
        style={[
          styles.segmentButton,
          activeSection === 'classes' && styles.segmentButtonActive,
        ]}
        onPress={() => handleSectionChange('classes')}
      >
        <Text
          style={[
            styles.segmentText,
            activeSection === 'classes' && styles.segmentTextActive,
          ]}
        >
          반 관리
        </Text>
      </Pressable>
    </View>
  );

  const renderLoading = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={COLORS.PRIMARY} />
    </View>
  );

  const renderError = (message: string, onRetry: () => void) => (
    <View style={styles.centerContainer}>
      <Text style={styles.errorText}>{message}</Text>
      <Pressable style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>다시 시도</Text>
      </Pressable>
    </View>
  );

  const renderStudents = () => {
    if (isStudentsLoading) return renderLoading();
    if (studentsError) return renderError(studentsError, fetchStudents);

    if (students.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color={COLORS.GRAY_300} />
          <Text style={styles.emptyTitle}>연결된 학생이 없습니다</Text>
          <Text style={styles.emptyHint}>
            초대 탭에서 초대 코드를 생성하여{'\n'}
            학생들을 초대하세요.
          </Text>
          <Pressable
            style={styles.actionButton}
            onPress={() => router.push('/invite')}
          >
            <Text style={styles.actionButtonText}>학생 초대하기</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <FlatList
        data={students}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <StudentCard
            student={item}
            onPress={() => handleStudentPress(item.id)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderClasses = () => {
    if (isClassesLoading) return renderLoading();
    if (classesError) return renderError(classesError, fetchClasses);

    return (
      <View style={{ flex: 1 }}>
        {/* 반 만들기 버튼 */}
        <Pressable
          style={styles.createClassButton}
          onPress={() => router.push('/class/create')}
        >
          <Ionicons name="add-circle-outline" size={20} color={COLORS.PRIMARY} />
          <Text style={styles.createClassButtonText}>반 만들기</Text>
        </Pressable>

        {classes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="school-outline" size={48} color={COLORS.GRAY_300} />
            <Text style={styles.emptyTitle}>생성된 반이 없습니다</Text>
            <Text style={styles.emptyHint}>
              반을 만들어 학생들을{'\n'}그룹으로 관리하세요
            </Text>
          </View>
        ) : (
          <FlatList
            data={classes}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ClassCard
                classItem={item}
                onPress={() => handleClassPress(item.id)}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderSegmentControl()}
      {activeSection === 'students' ? renderStudents() : renderClasses()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: COLORS.GRAY_100,
    borderRadius: 10,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: COLORS.WHITE,
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.TEXT_SECONDARY,
  },
  segmentTextActive: {
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.ERROR,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.WHITE,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
  },
  actionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    marginTop: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.WHITE,
  },
  createClassButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 14,
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
    borderStyle: 'dashed',
  },
  createClassButtonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.PRIMARY,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
});
