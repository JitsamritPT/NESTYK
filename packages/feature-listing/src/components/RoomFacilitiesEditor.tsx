import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { FacilityOption } from '@nestyk/types';
import { AMENITIES_CATALOG_GROUP_ORDER, useLocale } from '@nestyk/i18n';
import {
  MobileButton,
  MobileIcon,
  type AppIconName,
  tokens,
} from '@nestyk/ui/native';

function facilityKey(f: FacilityOption) {
  return `${f.groupCode ?? ''}:${f.code}`;
}

function interpolate(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
    template,
  );
}

function customLines(custom: string) {
  return custom.split('\n').map((v) => v.trim()).filter(Boolean);
}

function chunkPairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return rows;
}

const BRAND = tokens.colors.brand[500];

const GROUP_ICONS: Record<string, AppIconName> = {
  furniture: 'bed',
  appliances: 'snowflake',
  room_features: 'home',
  parking: 'car',
  project_facilities: 'swimming-pool',
  security_services: 'shield',
  other: 'note',
};

const ITEM_ICONS: Record<string, AppIconName> = {
  // furniture
  bed_mattress: 'bed',
  wardrobe: 'coat-hanger',
  sofa: 'couch',
  tv_stand: 'television',
  dining_table: 'fork-knife',
  desk: 'desk',
  vanity_mirror: 'sparkle',
  storage_cabinet: 'archive',
  curtains: 'wind',
  // appliances
  air_conditioning: 'snowflake',
  fan: 'fan',
  tv: 'television',
  smart_tv: 'television',
  refrigerator: 'wine',
  microwave: 'oven',
  washing_machine: 'washing-machine',
  dryer: 'wind',
  water_heater: 'drop',
  induction_stove: 'cooking-pot',
  gas_stove: 'flame',
  range_hood: 'wind',
  water_filter: 'drop',
  digital_door_lock: 'lock',
  smart_home: 'sparkle',
  // room_features
  open_kitchen: 'cooking-pot',
  closed_kitchen: 'cooking-pot',
  wet_dry_bathroom: 'shower',
  bathtub: 'bath',
  balcony: 'plant',
  mosquito_net: 'grid',
  drying_area: 'wind',
  storage_room: 'cube',
  private_garden: 'tree',
  private_pool: 'swimming-pool',
  // parking
  car_parking: 'car',
  motorcycle_parking: 'motorcycle',
  bicycle_parking: 'bicycle',
  fixed_parking_slot: 'garage',
  indoor_parking: 'garage',
  private_ev_charger: 'charging-station',
  // project_facilities
  shared_pool: 'swimming-pool',
  gym: 'barbell',
  sauna: 'thermometer',
  shared_garden: 'tree',
  coworking: 'desk',
  cokitchen: 'cooking-pot',
  playground: 'park',
  parcel_room: 'package',
  shared_laundry: 'washing-machine',
  shuttle: 'bus',
  shared_ev_charger: 'charging-station',
  // security_services
  security_24h: 'shield',
  keycard_access: 'key',
  cctv: 'camera',
  smoke_detector: 'warning',
  fire_extinguisher: 'fire-extinguisher',
  in_unit_internet: 'wifi',
  housekeeping: 'broom',
  pet_friendly: 'paw',
};

function amenityIcon(code: string, groupCode?: string): AppIconName {
  return ITEM_ICONS[code] ?? GROUP_ICONS[groupCode ?? ''] ?? 'grid';
}

export function RoomFacilitiesEditor({
  options,
  selected,
  onChange,
  custom,
  onCustomChange,
  loading,
  error,
  onRetry,
  color: _accentColor,
}: {
  options: FacilityOption[];
  selected: FacilityOption[];
  onChange: (value: FacilityOption[]) => void;
  custom: string;
  onCustomChange: (value: string) => void;
  loading: boolean;
  error?: string;
  onRetry: () => void;
  color: string;
}) {
  const { t } = useLocale();
  const cr = t.agent.createRoom;
  const [tab, setTab] = useState<'all' | 'selected'>('all');
  const [query, setQuery] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>('furniture');
  const [addingCustom, setAddingCustom] = useState(false);
  const [draftCustom, setDraftCustom] = useState('');

  const chosen = useMemo(() => new Set(selected.map(facilityKey)), [selected]);
  const all = useMemo(() => {
    return [
      ...options,
      ...selected.filter((f) => !options.some((o) => facilityKey(o) === facilityKey(f))),
    ];
  }, [options, selected]);

  const q = query.trim().toLowerCase();
  const labelOf = (code: string) => t.masters.facilities[code] ?? code;

  const groups = useMemo(() => {
    const order = [...AMENITIES_CATALOG_GROUP_ORDER];
    const present = new Set(all.map((f) => f.groupCode ?? 'other'));
    const ordered = order.filter((g) => present.has(g));
    for (const g of present) {
      if (!ordered.includes(g as (typeof order)[number]) && g !== 'other') {
        ordered.push(g as (typeof order)[number]);
      }
    }
    if (present.has('other')) ordered.push('other' as (typeof order)[number]);
    return ordered;
  }, [all]);

  const filteredByGroup = useMemo(() => {
    const map = new Map<string, FacilityOption[]>();
    for (const group of groups) {
      let items = all.filter((f) => (f.groupCode ?? 'other') === group);
      if (q) {
        items = items.filter((f) => labelOf(f.code).toLowerCase().includes(q));
      }
      if (items.length) map.set(group, items);
    }
    return map;
  }, [all, groups, q, t.masters.facilities]);

  // While searching, keep one matching group open (exclusive).
  useEffect(() => {
    if (!q) return;
    const first = filteredByGroup.keys().next().value as string | undefined;
    if (first) setExpandedGroup(first);
  }, [q, filteredByGroup]);

  const selectedCount = selected.length + customLines(custom).length;
  const customFiltered = customLines(custom).filter(
    (line) => !q || line.toLowerCase().includes(q),
  );
  const showOtherSection = !q || customFiltered.length > 0 || addingCustom;
  const showCatalogEmpty = filteredByGroup.size === 0 && !showOtherSection;

  const toggle = (item: FacilityOption) => {
    const k = facilityKey(item);
    if (chosen.has(k)) {
      onChange(selected.filter((f) => facilityKey(f) !== k));
    } else {
      onChange([...selected, item]);
    }
  };

  const clearAll = () => {
    Alert.alert(cr.amenitiesClearConfirmTitle, cr.amenitiesClearConfirmBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: cr.amenitiesClearSelection,
        style: 'destructive',
        onPress: () => {
          onChange([]);
          onCustomChange('');
        },
      },
    ]);
  };

  const commitCustom = () => {
    const line = draftCustom.trim();
    if (!line) return;
    const lines = customLines(custom);
    if (lines.length >= 50 || line.length > 100) return;
    if (lines.some((l) => l.toLowerCase() === line.toLowerCase())) {
      setDraftCustom('');
      setAddingCustom(false);
      return;
    }
    onCustomChange([...lines, line].join('\n'));
    setDraftCustom('');
    setAddingCustom(false);
  };

  const removeCustom = (line: string) => {
    onCustomChange(customLines(custom).filter((l) => l !== line).join('\n'));
  };

  const toggleGroup = (groupCode: string) => {
    setExpandedGroup((prev) => (prev === groupCode ? null : groupCode));
  };

  return (
    <View style={styles.body}>
      <Text style={styles.lead}>{cr.facilitiesHint}</Text>

      <View style={styles.searchRow}>
        <MobileIcon name="search" size={18} color={tokens.colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={cr.searchAmenities}
          placeholderTextColor={tokens.colors.placeholder}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      <View style={styles.tabs}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'all' }}
          onPress={() => setTab('all')}
          style={[styles.tab, tab === 'all' && styles.tabOn]}
        >
          <Text style={[styles.tabText, tab === 'all' && styles.tabTextOn]}>{cr.amenitiesTabAll}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'selected' }}
          onPress={() => setTab('selected')}
          style={[styles.tab, tab === 'selected' && styles.tabOn]}
        >
          <Text style={[styles.tabText, tab === 'selected' && styles.tabTextOn]}>
            {interpolate(cr.amenitiesTabSelected, { count: selectedCount })}
          </Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color={BRAND} /> : null}
      {!!error ? (
        <>
          <Text style={styles.error}>{error}</Text>
          <MobileButton variant="outline" onPress={onRetry}>
            {t.agent.listings.retry}
          </MobileButton>
        </>
      ) : null}

          {tab === 'all' ? (
        <View style={styles.sections}>
          {showCatalogEmpty ? (
            <Text style={styles.empty}>{cr.amenitiesEmptySearch}</Text>
          ) : null}

          {[...filteredByGroup.entries()].map(([groupCode, items]) => {
              const open = expandedGroup === groupCode;
              const groupSelectedTotal = selected.filter(
                (f) => (f.groupCode ?? 'other') === groupCode,
              ).length;
              return (
                <View key={groupCode} style={styles.section}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    onPress={() => toggleGroup(groupCode)}
                    style={styles.sectionHeader}
                  >
                    <MobileIcon
                      name={GROUP_ICONS[groupCode] ?? 'grid'}
                      size={22}
                      color={tokens.colors.primary}
                    />
                    <Text style={styles.sectionTitle} numberOfLines={1}>
                      {t.masters.facilityGroups[groupCode] ?? groupCode}
                    </Text>
                    <Text style={styles.sectionMeta} numberOfLines={1}>
                      {groupSelectedTotal > 0
                        ? interpolate(cr.amenitiesTabSelected, { count: groupSelectedTotal })
                        : cr.amenitiesGroupNoneSelected}
                    </Text>
                    <MobileIcon
                      name={open ? 'chevron-down' : 'chevron-right'}
                      size={18}
                      color={tokens.colors.textSecondary}
                    />
                  </Pressable>
                  {open ? (
                    <View style={styles.grid}>
                      {chunkPairs(items).map((pair) => (
                        <View key={facilityKey(pair[0])} style={styles.gridRow}>
                          {pair.map((item) => {
                            const isSelected = chosen.has(facilityKey(item));
                            return (
                              <Pressable
                                key={facilityKey(item)}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: isSelected }}
                                onPress={() => toggle(item)}
                                style={[styles.card, isSelected && styles.cardOn]}
                              >
                                <MobileIcon
                                  name={amenityIcon(item.code, item.groupCode)}
                                  size={22}
                                  color={
                                    isSelected
                                      ? tokens.colors.primary
                                      : tokens.colors.textSecondary
                                  }
                                />
                                <Text style={styles.cardLabel} numberOfLines={2}>
                                  {labelOf(item.code)}
                                </Text>
                                {isSelected ? (
                                  <View style={styles.checkBadge}>
                                    <MobileIcon
                                      name="check"
                                      size={11}
                                      color={tokens.colors.white}
                                      weight="bold"
                                    />
                                  </View>
                                ) : (
                                  <View style={styles.checkSpacer} />
                                )}
                              </Pressable>
                            );
                          })}
                          {pair.length === 1 ? <View style={styles.cardSpacer} /> : null}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}

          {showOtherSection && (
            <View style={styles.section}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: expandedGroup === 'other' }}
                onPress={() => toggleGroup('other')}
                style={styles.sectionHeader}
              >
                <MobileIcon name="note" size={22} color={tokens.colors.primary} />
                <Text style={styles.sectionTitle} numberOfLines={1}>
                  {t.masters.facilityGroups.other ?? cr.customFacilities}
                </Text>
                <Text style={styles.sectionMeta} numberOfLines={1}>
                  {customLines(custom).length > 0
                    ? interpolate(cr.amenitiesTabSelected, { count: customLines(custom).length })
                    : cr.amenitiesGroupNoneSelected}
                </Text>
                <MobileIcon
                  name={expandedGroup === 'other' ? 'chevron-down' : 'chevron-right'}
                  size={18}
                  color={tokens.colors.textSecondary}
                />
              </Pressable>
              {expandedGroup === 'other' ? (
                <View style={styles.otherBody}>
                  <Text style={styles.hint}>{cr.customFacilitiesExamples}</Text>
                  {customFiltered.map((line) => (
                      <View key={line} style={styles.otherRow}>
                        <MobileIcon name="note" size={20} color={tokens.colors.textSecondary} />
                        <Text style={styles.selectedLabel}>{line}</Text>
                        <Pressable onPress={() => removeCustom(line)} hitSlop={8} style={styles.removeCircle}>
                          <MobileIcon name="close" size={14} color={tokens.colors.textSecondary} />
                        </Pressable>
                      </View>
                    ))}
                  {addingCustom ? (
                    <View style={styles.customBox}>
                      <TextInput
                        value={draftCustom}
                        onChangeText={setDraftCustom}
                        placeholder={cr.customFacilitiesPlaceholder}
                        placeholderTextColor={tokens.colors.placeholder}
                        maxLength={100}
                        style={styles.customInput}
                      />
                      <View style={styles.customActions}>
                        <MobileButton
                          variant="outline"
                          style={{ flex: 1 }}
                          onPress={() => {
                            setAddingCustom(false);
                            setDraftCustom('');
                          }}
                        >
                          {t.common.cancel}
                        </MobileButton>
                        <MobileButton style={{ flex: 1 }} onPress={commitCustom}>
                          {cr.amenitiesAddOther}
                        </MobileButton>
                      </View>
                      <Text style={styles.hint}>{cr.customFacilitiesHint}</Text>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setAddingCustom(true)}
                      style={styles.addOtherBtn}
                    >
                      <MobileIcon name="plus" size={18} color={tokens.colors.primary} />
                      <Text style={styles.addOtherLabel}>{cr.amenitiesAddOther}</Text>
                    </Pressable>
                  )}
                </View>
              ) : null}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.sections}>
          {selectedCount > 0 ? (
            <View style={styles.selectedToolbar}>
              <View style={{ flex: 1 }} />
              <Pressable onPress={clearAll} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.clearLink}>{cr.amenitiesClearSelection}</Text>
              </Pressable>
            </View>
          ) : null}

          {selectedCount === 0 ? (
            <Text style={styles.empty}>{cr.amenitiesNoneSelected}</Text>
          ) : (
            <>
              {groups.map((groupCode) => {
                const items = selected.filter((f) => (f.groupCode ?? 'other') === groupCode);
                if (!items.length) return null;
                return (
                  <View key={groupCode} style={styles.selectedGroup}>
                    <View style={styles.selectedGroupHeader}>
                      <Text style={styles.selectedGroupTitle}>
                        {t.masters.facilityGroups[groupCode] ?? groupCode} ({items.length})
                      </Text>
                    </View>
                    {items.map((item, index) => (
                      <View
                        key={facilityKey(item)}
                        style={[
                          styles.selectedRow,
                          index < items.length - 1 && styles.selectedRowDivider,
                        ]}
                      >
                        <MobileIcon
                          name={amenityIcon(item.code, item.groupCode)}
                          size={22}
                          color={tokens.colors.textSecondary}
                        />
                        <Text style={styles.selectedLabel}>{labelOf(item.code)}</Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={cr.removePhoto}
                          onPress={() => toggle(item)}
                          hitSlop={8}
                          style={styles.removeCircle}
                        >
                          <MobileIcon name="close" size={14} color={tokens.colors.textSecondary} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                );
              })}
              {customLines(custom).length ? (
                <View style={styles.selectedGroup}>
                  <View style={styles.selectedGroupHeader}>
                    <Text style={styles.selectedGroupTitle}>
                      {t.masters.facilityGroups.other ?? cr.customFacilities} ({customLines(custom).length})
                    </Text>
                  </View>
                  {customLines(custom).map((line, index, arr) => (
                    <View
                      key={line}
                      style={[
                        styles.selectedRow,
                        index < arr.length - 1 && styles.selectedRowDivider,
                      ]}
                    >
                      <MobileIcon name="note" size={22} color={tokens.colors.textSecondary} />
                      <Text style={styles.selectedLabel}>{line}</Text>
                      <Pressable onPress={() => removeCustom(line)} hitSlop={8} style={styles.removeCircle}>
                        <MobileIcon name="close" size={14} color={tokens.colors.textSecondary} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </View>
      )}

      <View style={styles.sessionNote}>
        <MobileIcon name="warning" size={16} color={tokens.colors.textSecondary} />
        <Text style={styles.sessionNoteText}>
          {interpolate(cr.amenitiesSelectedCount, { count: selectedCount })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16 },
  lead: {
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: tokens.colors.white,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: tokens.colors.primary,
    paddingVertical: 10,
  },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  tabOn: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  tabText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  tabTextOn: {
    color: tokens.colors.primary,
    fontWeight: '700',
  },
  sections: { gap: 10 },
  section: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    backgroundColor: tokens.colors.white,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 52,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: tokens.colors.primary,
  },
  sectionMeta: {
    flexShrink: 0,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
    marginRight: 2,
  },
  grid: {
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.border,
    paddingTop: 10,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  otherBody: {
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.border,
    paddingTop: 10,
  },
  otherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.white,
    paddingLeft: 12,
    paddingRight: 8,
  },
  card: {
    flex: 1,
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.white,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardOn: {
    borderColor: BRAND,
    backgroundColor: tokens.colors.subtle.brandBg,
  },
  cardSpacer: { flex: 1 },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkSpacer: {
    width: 20,
    height: 20,
    flexShrink: 0,
  },
  cardLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 19,
    color: tokens.colors.primary,
    fontWeight: '500',
  },
  customBox: { gap: 10 },
  customInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: tokens.colors.primary,
    backgroundColor: tokens.colors.white,
  },
  customActions: { flexDirection: 'row', gap: 8 },
  addOtherBtn: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  addOtherLabel: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: tokens.colors.textSecondary,
  },
  selectedToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 28,
  },
  clearLink: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: tokens.colors.accent,
  },
  selectedGroup: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.white,
  },
  selectedGroupHeader: {
    backgroundColor: tokens.colors.subtle.neutralBg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectedGroupTitle: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingLeft: 14,
    paddingRight: 10,
    backgroundColor: tokens.colors.white,
  },
  selectedRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border,
  },
  selectedLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: tokens.colors.primary,
  },
  removeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  hint: { fontSize: 12, lineHeight: 18, color: tokens.colors.textSecondary },
  sessionNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 4,
  },
  sessionNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  error: { color: tokens.colors.error, fontSize: 13, lineHeight: 20 },
});
