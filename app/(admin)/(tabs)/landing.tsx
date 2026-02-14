import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { getUserMessage } from '@/lib/errors';
import {
  getAllLandingSections,
  getAllLandingItems,
  updateLandingSection,
  deleteLandingItem,
} from '@/services/landing';
import type { LandingSection, LandingItem } from '@/lib/types';

export default function AdminLandingScreen() {
  const [sections, setSections] = useState<LandingSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<LandingSection | null>(null);
  const [items, setItems] = useState<LandingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isItemsLoading, setIsItemsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSections = useCallback(async () => {
    setError(null);
    const { data, error: fetchError } = await getAllLandingSections();

    if (fetchError) {
      setError(getUserMessage(fetchError));
    } else {
      setSections(data || []);
      if (data && data.length > 0 && !selectedSection) {
        setSelectedSection(data[0]);
      }
    }
    setIsLoading(false);
  }, [selectedSection]);

  const fetchItems = useCallback(async (sectionId: string) => {
    setIsItemsLoading(true);
    const { data, error: fetchError } = await getAllLandingItems(sectionId);

    if (fetchError) {
      setError(getUserMessage(fetchError));
    } else {
      setItems(data || []);
    }
    setIsItemsLoading(false);
  }, []);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  useEffect(() => {
    if (selectedSection) {
      fetchItems(selectedSection.id);
    }
  }, [selectedSection, fetchItems]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchSections();
    if (selectedSection) {
      await fetchItems(selectedSection.id);
    }
    setIsRefreshing(false);
  }, [fetchSections, fetchItems, selectedSection]);

  const handleToggleSection = useCallback(async (section: LandingSection) => {
    const { error: updateError } = await updateLandingSection(section.section_key, {
      is_active: !section.is_active,
    });

    if (updateError) {
      Alert.alert('오류', getUserMessage(updateError));
    } else {
      setSections(prev =>
        prev.map(s => s.id === section.id ? { ...s, is_active: !s.is_active } : s)
      );
    }
  }, []);

  const handleDeleteItem = useCallback(async (itemId: string) => {
    Alert.alert('삭제 확인', '이 아이템을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          const { error: deleteError } = await deleteLandingItem(itemId);
          if (deleteError) {
            Alert.alert('오류', getUserMessage(deleteError));
          } else {
            setItems(prev => prev.filter(i => i.id !== itemId));
          }
        },
      },
    ]);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 섹션 탭 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabRow}
        contentContainerStyle={styles.tabContent}
      >
        {sections.map((section) => (
          <Pressable
            key={section.id}
            style={[
              styles.tabChip,
              selectedSection?.id === section.id && styles.tabChipActive,
              !section.is_active && styles.tabChipInactive,
            ]}
            onPress={() => setSelectedSection(section)}
          >
            <Text
              style={[
                styles.tabChipText,
                selectedSection?.id === section.id && styles.tabChipTextActive,
              ]}
            >
              {section.section_key}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* 선택된 섹션 정보 */}
      {selectedSection && (
        <View style={styles.sectionInfo}>
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>{selectedSection.title || selectedSection.section_key}</Text>
              {selectedSection.subtitle && (
                <Text style={styles.sectionSubtitle}>{selectedSection.subtitle}</Text>
              )}
            </View>
            <Pressable onPress={() => handleToggleSection(selectedSection)}>
              <Ionicons
                name={selectedSection.is_active ? 'eye' : 'eye-off'}
                size={22}
                color={selectedSection.is_active ? COLORS.SUCCESS : COLORS.GRAY_400}
              />
            </Pressable>
          </View>
        </View>
      )}

      {/* 아이템 목록 */}
      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : isItemsLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.itemsList}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={COLORS.PRIMARY} />
          }
        >
          {items.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemMain}>
                {item.icon && <Text style={styles.itemIcon}>{item.icon}</Text>}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  {item.description && (
                    <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
                  )}
                </View>
                <Pressable onPress={() => handleDeleteItem(item.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.ERROR} />
                </Pressable>
              </View>
              <View style={styles.itemMeta}>
                <Text style={styles.itemMetaText}>순서: {item.sort_order}</Text>
                <Text style={[styles.itemMetaText, !item.is_active && { color: COLORS.ERROR }]}>
                  {item.is_active ? '활성' : '비활성'}
                </Text>
              </View>
            </View>
          ))}
          {items.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>아이템이 없습니다</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND_SECONDARY },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: COLORS.ERROR, fontSize: 14, fontFamily: 'Pretendard-Medium' },
  tabRow: { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER, backgroundColor: COLORS.WHITE },
  tabContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.GRAY_100,
  },
  tabChipActive: { backgroundColor: COLORS.PRIMARY },
  tabChipInactive: { opacity: 0.5 },
  tabChipText: { fontSize: 12, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_SECONDARY },
  tabChipTextActive: { color: COLORS.WHITE },
  sectionInfo: {
    backgroundColor: COLORS.WHITE,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Pretendard-Bold', color: COLORS.TEXT_PRIMARY },
  sectionSubtitle: { fontSize: 13, fontFamily: 'Pretendard-Regular', color: COLORS.TEXT_SECONDARY, marginTop: 4 },
  itemsList: { padding: 16 },
  itemCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  itemMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  itemIcon: { fontSize: 20, marginTop: 2 },
  itemTitle: { fontSize: 14, fontFamily: 'Pretendard-SemiBold', color: COLORS.TEXT_PRIMARY },
  itemDesc: { fontSize: 12, fontFamily: 'Pretendard-Regular', color: COLORS.TEXT_SECONDARY, marginTop: 2 },
  itemMeta: { flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.GRAY_100 },
  itemMetaText: { fontSize: 11, fontFamily: 'Pretendard-Regular', color: COLORS.GRAY_400 },
  emptyState: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 14, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_SECONDARY },
});
