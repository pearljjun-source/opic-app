import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable,
  Alert, RefreshControl, Modal, TextInput, Switch, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import { getUserMessage } from '@/lib/errors';
import {
  getAllLandingSections,
  getAllLandingItems,
  updateLandingSection,
  deleteLandingItem,
  upsertLandingItem,
  reorderLandingItems,
  uploadLandingAsset,
} from '@/services/landing';
import type { LandingSection, LandingItem } from '@/lib/types';

// ============================================================================
// Item Form 초기값
// ============================================================================

const EMPTY_ITEM_FORM = {
  title: '',
  description: '',
  icon: '',
  image_url: '',
  video_url: '',
  sort_order: '0',
  is_active: true,
  // Stats metadata
  meta_value: '',
  meta_suffix: '',
  // Pricing metadata
  meta_price: '',
  meta_period: '',
  meta_features: '',
  meta_cta: '',
  meta_highlighted: false,
  // Roadmap metadata
  meta_phase: '',
  meta_status: 'planned',
  meta_items: '',
  // Steps metadata
  meta_num: '',
};

export default function AdminLandingScreen() {
  const [sections, setSections] = useState<LandingSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<LandingSection | null>(null);
  const [items, setItems] = useState<LandingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isItemsLoading, setIsItemsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 섹션 편집
  const [isEditingSection, setIsEditingSection] = useState(false);
  const [sectionForm, setSectionForm] = useState({ title: '', subtitle: '', videoUrl: '' });
  const [isSavingSection, setIsSavingSection] = useState(false);

  // 아이템 생성/편집 모달
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<LandingItem | null>(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [isItemSaving, setIsItemSaving] = useState(false);

  // 순서 변경
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // 파일 업로드
  const [isUploading, setIsUploading] = useState<'image' | 'video' | null>(null);

  // ============================================================================
  // Data Fetching
  // ============================================================================

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
      setIsReorderMode(false);
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

  // ============================================================================
  // Section Actions
  // ============================================================================

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
      if (selectedSection?.id === section.id) {
        setSelectedSection(prev => prev ? { ...prev, is_active: !prev.is_active } : null);
      }
    }
  }, [selectedSection]);

  const handleStartEditSection = useCallback(() => {
    if (!selectedSection) return;
    setSectionForm({
      title: selectedSection.title || '',
      subtitle: selectedSection.subtitle || '',
      videoUrl: (selectedSection.content as any)?.video_url || '',
    });
    setIsEditingSection(true);
  }, [selectedSection]);

  const handleSaveSection = useCallback(async () => {
    if (!selectedSection) return;
    setIsSavingSection(true);

    const updates: Record<string, unknown> = {
      title: sectionForm.title || undefined,
      subtitle: sectionForm.subtitle || undefined,
    };

    // video 섹션: content에 video_url 저장
    if (selectedSection.section_key === 'video' && sectionForm.videoUrl.trim()) {
      updates.content = {
        ...(selectedSection.content || {}),
        video_url: sectionForm.videoUrl.trim(),
      };
    }

    const { error: updateError } = await updateLandingSection(selectedSection.section_key, updates);

    if (updateError) {
      Alert.alert('오류', getUserMessage(updateError));
    } else {
      const updated = {
        ...selectedSection,
        title: sectionForm.title,
        subtitle: sectionForm.subtitle,
        content: updates.content
          ? (updates.content as Record<string, unknown>)
          : selectedSection.content,
      };
      setSections(prev => prev.map(s => s.id === selectedSection.id ? updated : s));
      setSelectedSection(updated);
      setIsEditingSection(false);
    }
    setIsSavingSection(false);
  }, [selectedSection, sectionForm]);

  // ============================================================================
  // Item CRUD
  // ============================================================================

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

  const handleOpenCreateItem = useCallback(() => {
    setEditingItem(null);
    setItemForm(EMPTY_ITEM_FORM);
    setItemModalVisible(true);
  }, []);

  const handleOpenEditItem = useCallback((item: LandingItem) => {
    if (isReorderMode) return;
    setEditingItem(item);
    const meta = (item.metadata as Record<string, any>) || {};
    setItemForm({
      title: item.title,
      description: item.description || '',
      icon: item.icon || '',
      image_url: item.image_url || '',
      video_url: item.video_url || '',
      sort_order: String(item.sort_order),
      is_active: item.is_active,
      // Stats
      meta_value: String(meta.value ?? ''),
      meta_suffix: meta.suffix || '',
      // Pricing
      meta_price: meta.price || '',
      meta_period: meta.period || '',
      meta_features: (meta.features || []).join('\n'),
      meta_cta: meta.cta || '',
      meta_highlighted: meta.highlighted === true,
      // Roadmap
      meta_phase: meta.phase || '',
      meta_status: meta.status || 'planned',
      meta_items: (meta.items || []).join('\n'),
      // Steps
      meta_num: meta.num || '',
    });
    setItemModalVisible(true);
  }, [isReorderMode]);

  const handleSaveItem = useCallback(async () => {
    if (!selectedSection) return;
    const trimmedTitle = itemForm.title.trim();
    if (!trimmedTitle) {
      Alert.alert('오류', '제목을 입력해주세요.');
      return;
    }

    setIsItemSaving(true);

    // 섹션별 메타데이터 조합
    let metadata: Record<string, unknown> | undefined;
    const sKey = selectedSection.section_key;

    if (sKey === 'stats') {
      metadata = {
        value: parseInt(itemForm.meta_value, 10) || 0,
        suffix: itemForm.meta_suffix,
      };
    } else if (sKey === 'pricing') {
      metadata = {
        price: itemForm.meta_price,
        period: itemForm.meta_period,
        features: itemForm.meta_features.split('\n').filter(Boolean),
        cta: itemForm.meta_cta,
        highlighted: itemForm.meta_highlighted,
      };
    } else if (sKey === 'roadmap') {
      metadata = {
        phase: itemForm.meta_phase,
        status: itemForm.meta_status,
        items: itemForm.meta_items.split('\n').filter(Boolean),
      };
    } else if (sKey === 'steps') {
      metadata = { num: itemForm.meta_num };
    }

    const payload: Record<string, unknown> = {
      section_id: selectedSection.id,
      title: trimmedTitle,
      description: itemForm.description.trim() || undefined,
      icon: itemForm.icon.trim() || undefined,
      image_url: itemForm.image_url.trim() || undefined,
      video_url: itemForm.video_url.trim() || undefined,
      sort_order: parseInt(itemForm.sort_order, 10) || 0,
      is_active: itemForm.is_active,
      metadata: metadata || undefined,
    };
    if (editingItem) payload.id = editingItem.id;

    const { error: saveError } = await upsertLandingItem(payload);
    if (saveError) {
      Alert.alert('오류', getUserMessage(saveError));
    } else {
      setItemModalVisible(false);
      await fetchItems(selectedSection.id);
    }
    setIsItemSaving(false);
  }, [selectedSection, editingItem, itemForm, fetchItems]);

  // ============================================================================
  // Reorder
  // ============================================================================

  const handleMoveItem = useCallback((index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    setItems(prev => {
      const newItems = [...prev];
      [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
      return newItems.map((item, i) => ({ ...item, sort_order: i }));
    });
  }, [items.length]);

  const handleSaveOrder = useCallback(async () => {
    setIsSavingOrder(true);
    const payload = items.map((item, i) => ({ id: item.id, sort_order: i }));
    const { error: reorderError } = await reorderLandingItems(payload);

    if (reorderError) {
      Alert.alert('오류', getUserMessage(reorderError));
    } else {
      setIsReorderMode(false);
    }
    setIsSavingOrder(false);
  }, [items]);

  // ============================================================================
  // File Upload (Web)
  // ============================================================================

  const handleFileUpload = useCallback((type: 'image' | 'video') => {
    if (Platform.OS !== 'web' || !selectedSection) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'image'
      ? 'image/jpeg,image/png,image/webp,image/gif'
      : 'video/mp4,video/webm,video/quicktime';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setIsUploading(type);
      const { data, error: uploadError } = await uploadLandingAsset(
        file,
        selectedSection.section_key,
        file.name,
        { size: file.size, mimeType: file.type },
        type
      );

      if (uploadError) {
        Alert.alert('업로드 실패', getUserMessage(uploadError));
      } else if (data) {
        const field = type === 'image' ? 'image_url' : 'video_url';
        setItemForm(prev => ({ ...prev, [field]: data.url }));
      }
      setIsUploading(null);
    };

    input.click();
  }, [selectedSection]);

  // ============================================================================
  // Render
  // ============================================================================

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
          {isEditingSection ? (
            <View>
              <TextInput
                style={styles.sectionInput}
                value={sectionForm.title}
                onChangeText={(v) => setSectionForm(prev => ({ ...prev, title: v }))}
                placeholder="섹션 제목"
                placeholderTextColor={COLORS.GRAY_400}
                maxLength={200}
              />
              <TextInput
                style={[styles.sectionInput, { marginTop: 8 }]}
                value={sectionForm.subtitle}
                onChangeText={(v) => setSectionForm(prev => ({ ...prev, subtitle: v }))}
                placeholder="섹션 부제목"
                placeholderTextColor={COLORS.GRAY_400}
                maxLength={500}
                multiline
              />
              {selectedSection?.section_key === 'video' && (
                <TextInput
                  style={[styles.sectionInput, { marginTop: 8 }]}
                  value={sectionForm.videoUrl}
                  onChangeText={(v) => setSectionForm(prev => ({ ...prev, videoUrl: v }))}
                  placeholder="동영상 URL (YouTube embed 등)"
                  placeholderTextColor={COLORS.GRAY_400}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              )}
              <View style={styles.sectionEditActions}>
                <Pressable
                  style={styles.sectionEditBtn}
                  onPress={() => setIsEditingSection(false)}
                >
                  <Text style={styles.sectionEditBtnText}>취소</Text>
                </Pressable>
                <Pressable
                  style={[styles.sectionEditBtn, styles.sectionEditBtnPrimary]}
                  onPress={handleSaveSection}
                  disabled={isSavingSection}
                >
                  {isSavingSection ? (
                    <ActivityIndicator size="small" color={COLORS.WHITE} />
                  ) : (
                    <Text style={[styles.sectionEditBtnText, { color: COLORS.WHITE }]}>저장</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>
                  {selectedSection.title || selectedSection.section_key}
                </Text>
                {selectedSection.subtitle && (
                  <Text style={styles.sectionSubtitle}>{selectedSection.subtitle}</Text>
                )}
              </View>
              <View style={styles.sectionActions}>
                <Pressable onPress={handleStartEditSection} hitSlop={8}>
                  <Ionicons name="create-outline" size={20} color={COLORS.PRIMARY} />
                </Pressable>
                <Pressable onPress={() => handleToggleSection(selectedSection)} hitSlop={8}>
                  <Ionicons
                    name={selectedSection.is_active ? 'eye' : 'eye-off'}
                    size={20}
                    color={selectedSection.is_active ? COLORS.SUCCESS : COLORS.GRAY_400}
                  />
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}

      {/* 아이템 툴바 */}
      {selectedSection && !isEditingSection && (
        <View style={styles.toolbar}>
          <Pressable style={styles.toolbarBtn} onPress={handleOpenCreateItem}>
            <Ionicons name="add-circle-outline" size={18} color={COLORS.PRIMARY} />
            <Text style={styles.toolbarBtnText}>추가</Text>
          </Pressable>
          {items.length > 1 && (
            isReorderMode ? (
              <View style={styles.toolbarRow}>
                <Pressable
                  style={styles.toolbarBtn}
                  onPress={() => { setIsReorderMode(false); if (selectedSection) fetchItems(selectedSection.id); }}
                >
                  <Text style={styles.toolbarBtnText}>취소</Text>
                </Pressable>
                <Pressable
                  style={[styles.toolbarBtn, styles.toolbarBtnPrimary]}
                  onPress={handleSaveOrder}
                  disabled={isSavingOrder}
                >
                  {isSavingOrder ? (
                    <ActivityIndicator size="small" color={COLORS.WHITE} />
                  ) : (
                    <Text style={[styles.toolbarBtnText, { color: COLORS.WHITE }]}>순서 저장</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.toolbarBtn} onPress={() => setIsReorderMode(true)}>
                <Ionicons name="swap-vertical-outline" size={18} color={COLORS.PRIMARY} />
                <Text style={styles.toolbarBtnText}>순서 변경</Text>
              </Pressable>
            )
          )}
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
          {items.map((item, index) => (
            <Pressable
              key={item.id}
              style={styles.itemCard}
              onPress={() => handleOpenEditItem(item)}
              disabled={isReorderMode}
            >
              <View style={styles.itemMain}>
                {isReorderMode ? (
                  <View style={styles.reorderButtons}>
                    <Pressable
                      onPress={() => handleMoveItem(index, 'up')}
                      disabled={index === 0}
                      hitSlop={6}
                    >
                      <Ionicons
                        name="chevron-up"
                        size={20}
                        color={index === 0 ? COLORS.GRAY_200 : COLORS.PRIMARY}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => handleMoveItem(index, 'down')}
                      disabled={index === items.length - 1}
                      hitSlop={6}
                    >
                      <Ionicons
                        name="chevron-down"
                        size={20}
                        color={index === items.length - 1 ? COLORS.GRAY_200 : COLORS.PRIMARY}
                      />
                    </Pressable>
                  </View>
                ) : (
                  item.icon ? <Text style={styles.itemIcon}>{item.icon}</Text> : null
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  {item.description && (
                    <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
                  )}
                </View>
                {!isReorderMode && (
                  <Pressable onPress={() => handleDeleteItem(item.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.ERROR} />
                  </Pressable>
                )}
              </View>
              <View style={styles.itemMeta}>
                <Text style={styles.itemMetaText}>순서: {item.sort_order}</Text>
                <Text style={[styles.itemMetaText, !item.is_active && { color: COLORS.ERROR }]}>
                  {item.is_active ? '활성' : '비활성'}
                </Text>
              </View>
            </Pressable>
          ))}
          {items.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>아이템이 없습니다</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* 아이템 생성/편집 모달 */}
      <Modal
        visible={itemModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setItemModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingItem ? '아이템 수정' : '아이템 추가'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {selectedSection?.section_key} 섹션의 아이템을 {editingItem ? '수정' : '추가'}합니다.
              </Text>

              <Text style={styles.inputLabel}>제목 *</Text>
              <TextInput
                style={styles.input}
                value={itemForm.title}
                onChangeText={(v) => setItemForm(prev => ({ ...prev, title: v }))}
                placeholder="아이템 제목"
                placeholderTextColor={COLORS.GRAY_400}
                maxLength={200}
              />

              <Text style={styles.inputLabel}>설명</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={itemForm.description}
                onChangeText={(v) => setItemForm(prev => ({ ...prev, description: v }))}
                placeholder="아이템 설명"
                placeholderTextColor={COLORS.GRAY_400}
                maxLength={2000}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>아이콘 (이름 또는 이모지)</Text>
              <TextInput
                style={styles.input}
                value={itemForm.icon}
                onChangeText={(v) => setItemForm(prev => ({ ...prev, icon: v }))}
                placeholder="예: Clock, PencilLine, 🎯"
                placeholderTextColor={COLORS.GRAY_400}
                maxLength={50}
              />

              <Text style={styles.inputLabel}>이미지 URL</Text>
              <View style={styles.uploadRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={itemForm.image_url}
                  onChangeText={(v) => setItemForm(prev => ({ ...prev, image_url: v }))}
                  placeholder="https://example.com/image.png"
                  placeholderTextColor={COLORS.GRAY_400}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                {Platform.OS === 'web' && (
                  <Pressable
                    style={[styles.uploadBtn, isUploading === 'image' && styles.uploadBtnDisabled]}
                    onPress={() => handleFileUpload('image')}
                    disabled={isUploading !== null}
                  >
                    {isUploading === 'image' ? (
                      <ActivityIndicator size="small" color={COLORS.WHITE} />
                    ) : (
                      <Ionicons name="cloud-upload-outline" size={18} color={COLORS.WHITE} />
                    )}
                  </Pressable>
                )}
              </View>

              <Text style={styles.inputLabel}>동영상 URL</Text>
              <View style={styles.uploadRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={itemForm.video_url}
                  onChangeText={(v) => setItemForm(prev => ({ ...prev, video_url: v }))}
                  placeholder="https://www.youtube.com/embed/..."
                  placeholderTextColor={COLORS.GRAY_400}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                {Platform.OS === 'web' && (
                  <Pressable
                    style={[styles.uploadBtn, isUploading === 'video' && styles.uploadBtnDisabled]}
                    onPress={() => handleFileUpload('video')}
                    disabled={isUploading !== null}
                  >
                    {isUploading === 'video' ? (
                      <ActivityIndicator size="small" color={COLORS.WHITE} />
                    ) : (
                      <Ionicons name="cloud-upload-outline" size={18} color={COLORS.WHITE} />
                    )}
                  </Pressable>
                )}
              </View>

              {/* 섹션별 메타데이터 필드 */}
              {selectedSection?.section_key === 'stats' && (
                <>
                  <Text style={styles.metaSectionLabel}>통계 메타데이터</Text>
                  <Text style={styles.inputLabel}>숫자 값</Text>
                  <TextInput
                    style={styles.input}
                    value={itemForm.meta_value}
                    onChangeText={(v) => setItemForm(prev => ({ ...prev, meta_value: v }))}
                    placeholder="예: 336"
                    placeholderTextColor={COLORS.GRAY_400}
                    keyboardType="number-pad"
                  />
                  <Text style={styles.inputLabel}>접미사</Text>
                  <TextInput
                    style={styles.input}
                    value={itemForm.meta_suffix}
                    onChangeText={(v) => setItemForm(prev => ({ ...prev, meta_suffix: v }))}
                    placeholder="예: +, 개, 종, 분"
                    placeholderTextColor={COLORS.GRAY_400}
                  />
                </>
              )}

              {selectedSection?.section_key === 'pricing' && (
                <>
                  <Text style={styles.metaSectionLabel}>요금제 메타데이터</Text>
                  <Text style={styles.inputLabel}>가격</Text>
                  <TextInput
                    style={styles.input}
                    value={itemForm.meta_price}
                    onChangeText={(v) => setItemForm(prev => ({ ...prev, meta_price: v }))}
                    placeholder="예: ₩29,900"
                    placeholderTextColor={COLORS.GRAY_400}
                  />
                  <Text style={styles.inputLabel}>기간</Text>
                  <TextInput
                    style={styles.input}
                    value={itemForm.meta_period}
                    onChangeText={(v) => setItemForm(prev => ({ ...prev, meta_period: v }))}
                    placeholder="예: /월"
                    placeholderTextColor={COLORS.GRAY_400}
                  />
                  <Text style={styles.inputLabel}>기능 목록 (줄바꿈 구분)</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    value={itemForm.meta_features}
                    onChangeText={(v) => setItemForm(prev => ({ ...prev, meta_features: v }))}
                    placeholder="학생 5명 연결&#10;스크립트 작성·관리"
                    placeholderTextColor={COLORS.GRAY_400}
                    multiline
                    numberOfLines={4}
                  />
                  <Text style={styles.inputLabel}>CTA 버튼 텍스트</Text>
                  <TextInput
                    style={styles.input}
                    value={itemForm.meta_cta}
                    onChangeText={(v) => setItemForm(prev => ({ ...prev, meta_cta: v }))}
                    placeholder="예: 무료로 시작"
                    placeholderTextColor={COLORS.GRAY_400}
                  />
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>추천 플랜</Text>
                    <Switch
                      value={itemForm.meta_highlighted}
                      onValueChange={(v) => setItemForm(prev => ({ ...prev, meta_highlighted: v }))}
                      trackColor={{ false: COLORS.GRAY_200, true: COLORS.PRIMARY }}
                    />
                  </View>
                </>
              )}

              {selectedSection?.section_key === 'roadmap' && (
                <>
                  <Text style={styles.metaSectionLabel}>로드맵 메타데이터</Text>
                  <Text style={styles.inputLabel}>Phase</Text>
                  <TextInput
                    style={styles.input}
                    value={itemForm.meta_phase}
                    onChangeText={(v) => setItemForm(prev => ({ ...prev, meta_phase: v }))}
                    placeholder="예: Phase 1"
                    placeholderTextColor={COLORS.GRAY_400}
                  />
                  <Text style={styles.inputLabel}>상태</Text>
                  <View style={styles.statusRow}>
                    {(['live', 'next', 'planned'] as const).map((status) => (
                      <Pressable
                        key={status}
                        style={[
                          styles.statusChip,
                          itemForm.meta_status === status && styles.statusChipActive,
                        ]}
                        onPress={() => setItemForm(prev => ({ ...prev, meta_status: status }))}
                      >
                        <Text style={[
                          styles.statusChipText,
                          itemForm.meta_status === status && styles.statusChipTextActive,
                        ]}>
                          {status === 'live' ? '사용 가능' : status === 'next' ? '개발 중' : '예정'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.inputLabel}>항목 목록 (줄바꿈 구분)</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    value={itemForm.meta_items}
                    onChangeText={(v) => setItemForm(prev => ({ ...prev, meta_items: v }))}
                    placeholder="강사-학생 연결 시스템&#10;맞춤 스크립트 작성"
                    placeholderTextColor={COLORS.GRAY_400}
                    multiline
                    numberOfLines={4}
                  />
                </>
              )}

              {selectedSection?.section_key === 'steps' && (
                <>
                  <Text style={styles.metaSectionLabel}>단계 메타데이터</Text>
                  <Text style={styles.inputLabel}>단계 번호</Text>
                  <TextInput
                    style={styles.input}
                    value={itemForm.meta_num}
                    onChangeText={(v) => setItemForm(prev => ({ ...prev, meta_num: v }))}
                    placeholder="예: 01"
                    placeholderTextColor={COLORS.GRAY_400}
                  />
                </>
              )}

              <Text style={styles.inputLabel}>정렬 순서</Text>
              <TextInput
                style={styles.input}
                value={itemForm.sort_order}
                onChangeText={(v) => setItemForm(prev => ({ ...prev, sort_order: v }))}
                placeholder="0"
                placeholderTextColor={COLORS.GRAY_400}
                keyboardType="number-pad"
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>활성</Text>
                <Switch
                  value={itemForm.is_active}
                  onValueChange={(v) => setItemForm(prev => ({ ...prev, is_active: v }))}
                  trackColor={{ false: COLORS.GRAY_200, true: COLORS.PRIMARY }}
                />
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalCancel}
                  onPress={() => setItemModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>취소</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalSubmit, (isItemSaving || !itemForm.title.trim()) && styles.modalSubmitDisabled]}
                  onPress={handleSaveItem}
                  disabled={isItemSaving || !itemForm.title.trim()}
                >
                  {isItemSaving ? (
                    <ActivityIndicator size="small" color={COLORS.WHITE} />
                  ) : (
                    <Text style={styles.modalSubmitText}>저장</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND_SECONDARY },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: COLORS.ERROR, fontSize: 14, fontFamily: 'Pretendard-Medium' },

  // 섹션 탭
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

  // 섹션 정보
  sectionInfo: {
    backgroundColor: COLORS.WHITE,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Pretendard-Bold', color: COLORS.TEXT_PRIMARY },
  sectionSubtitle: { fontSize: 13, fontFamily: 'Pretendard-Regular', color: COLORS.TEXT_SECONDARY, marginTop: 4 },
  sectionActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  sectionInput: {
    backgroundColor: COLORS.GRAY_50,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.TEXT_PRIMARY,
  },
  sectionEditActions: { flexDirection: 'row', gap: 8, marginTop: 12, justifyContent: 'flex-end' },
  sectionEditBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.GRAY_100,
  },
  sectionEditBtnPrimary: { backgroundColor: COLORS.PRIMARY },
  sectionEditBtnText: { fontSize: 13, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_SECONDARY },

  // 툴바
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  toolbarRow: { flexDirection: 'row', gap: 8 },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.GRAY_50,
  },
  toolbarBtnPrimary: { backgroundColor: COLORS.PRIMARY },
  toolbarBtnText: { fontSize: 13, fontFamily: 'Pretendard-Medium', color: COLORS.PRIMARY },

  // 아이템
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

  // 순서 변경
  reorderButtons: { gap: 2, alignItems: 'center', justifyContent: 'center' },

  // 모달
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  modalContent: { backgroundColor: COLORS.WHITE, borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 18, fontFamily: 'Pretendard-Bold', color: COLORS.TEXT_PRIMARY, marginBottom: 4 },
  modalSubtitle: { fontSize: 14, fontFamily: 'Pretendard-Regular', color: COLORS.TEXT_SECONDARY, marginBottom: 16 },
  inputLabel: { fontSize: 13, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_PRIMARY, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: COLORS.GRAY_50,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.TEXT_PRIMARY,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 4,
  },
  switchLabel: { fontSize: 14, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_PRIMARY },
  metaSectionLabel: {
    fontSize: 14,
    fontFamily: 'Pretendard-Bold',
    color: COLORS.PRIMARY,
    marginTop: 20,
    marginBottom: 4,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.GRAY_100,
  },
  statusRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 4 },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.GRAY_100,
  },
  statusChipActive: { backgroundColor: COLORS.PRIMARY },
  statusChipText: { fontSize: 13, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_SECONDARY },
  statusChipTextActive: { color: COLORS.WHITE },
  uploadRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  uploadBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadBtnDisabled: { opacity: 0.5 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.GRAY_100 },
  modalCancelText: { fontSize: 15, fontFamily: 'Pretendard-Medium', color: COLORS.TEXT_SECONDARY },
  modalSubmit: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.PRIMARY },
  modalSubmitDisabled: { opacity: 0.5 },
  modalSubmitText: { fontSize: 15, fontFamily: 'Pretendard-SemiBold', color: COLORS.WHITE },
});
