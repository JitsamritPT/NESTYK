import { LeadLocationsField } from './LeadLocationsField';
import { LeadSelectField } from './LeadSelectField';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { AgentLead, CreateLeadInput, LeadPinInput } from '@nestyk/types';
import { useLocale } from '@nestyk/i18n';
import { MoveInDateField } from '@nestyk/feature-listing';
import {
  MobileButton,
  MobileIcon,
  MobileInput,
  tokens,
  useMobileTheme,
  type AppIconName,
} from '@nestyk/ui/native';
import { fetchAgentContractTypes, fetchAgentRoomTypes } from '../lib/agent-listings-api';
import { createAgentLead, updateAgentLead, fetchAgentVisaTypes } from '../lib/agent-leads-api';
import {
  LEAD_NATIONALITY_OPTIONS,
  LEAD_OCCUPATION_OPTIONS,
  LEAD_OTHER_OPTION,
  presetCodeFor,
} from '../lib/lead-profile-options';

type TextKey =
  | 'name'
  | 'phone'
  | 'nationality'
  | 'budgetMin'
  | 'budgetMax'
  | 'preferredLocation'
  | 'moveInPlan'
  | 'occupation'
  | 'occupantCount'
  | 'notes';

export type LeadFormTab = 'profile' | 'matching';
type FormTab = LeadFormTab;

const empty: Record<TextKey, string> = {
  name: '',
  phone: '',
  nationality: '',
  budgetMin: '',
  budgetMax: '',
  preferredLocation: '',
  moveInPlan: '',
  occupation: '',
  occupantCount: '',
  notes: '',
};

const PROFILE_KEYS = new Set(['name', 'phone', 'nationality', 'occupation', 'occupantCount', 'notes']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NOTES_MAX = 500;

export function CreateLeadForm({
  initialLead,
  initialTab = 'profile',
  onSaved,
  onBusy,
}: {
  initialLead?: AgentLead;
  initialTab?: FormTab;
  onSaved: (lead: AgentLead) => void;
  onBusy: (busy: boolean) => void;
}) {
  const { t, locale } = useLocale();
  const c = t.agent.leads;
  const { theme } = useMobileTheme();
  const agent = tokens.colors.roles.agent;
  const [tab, setTab] = useState<FormTab>(initialTab);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [pins, setPins] = useState<LeadPinInput[]>(
    () => initialLead?.pins.map(({ rank: _rank, ...pin }) => pin) ?? [],
  );
  const [radiusKm, setRadiusKm] = useState(initialLead?.radiusKm ?? 3);
  /** Leads saved before pins keep their province/areas until the agent pins a location. */
  const legacyLabel =
    initialLead && !initialLead.pins.length && initialLead.province
      ? [initialLead.province, initialLead.locations.join(', ')].filter(Boolean).join(' · ')
      : null;
  const [form, setForm] = useState<Record<TextKey, string>>(
    () =>
      Object.fromEntries(
        Object.keys(empty).map((key) => [
          key,
          initialLead?.[key as TextKey] == null ? '' : String(initialLead[key as TextKey]),
        ]),
      ) as Record<TextKey, string>,
  );
  /** Pre-date-picker leads stored free text (e.g. "Next month"); keep it unless a date is picked. */
  const legacyMoveIn =
    initialLead?.moveInPlan && !ISO_DATE.test(initialLead.moveInPlan) ? initialLead.moveInPlan : '';
  const [otherOpen, setOtherOpen] = useState(() => ({
    nationality:
      !!initialLead?.nationality && !presetCodeFor(LEAD_NATIONALITY_OPTIONS, initialLead.nationality),
    occupation:
      !!initialLead?.occupation && !presetCodeFor(LEAD_OCCUPATION_OPTIONS, initialLead.occupation),
  }));
  const [saveError, setSaveError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<{
    hasPets: boolean | null;
    usesCar: boolean | null;
    isSmoker: boolean | null;
  }>({
    hasPets: initialLead?.hasPets ?? null,
    usesCar: initialLead?.usesCar ?? null,
    isSmoker: initialLead?.isSmoker ?? null,
  });
  const [roomType, setRoomType] = useState<number | null>(initialLead?.desiredRoomTypeId ?? null);
  const [visaType, setVisaType] = useState<number | null>(initialLead?.visaTypeId ?? null);
  const [leaseMonths, setLeaseMonths] = useState<number | null>(
    initialLead?.leaseDurationMonths ?? null,
  );
  const [types, setTypes] = useState<Array<{ id: number; code: string }>>([]);
  const [visas, setVisas] = useState<Array<{ id: number; code: string }>>([]);
  const [contracts, setContracts] = useState<Array<{ id: number; termMonths: number }>>([]);
  const [typesError, setTypesError] = useState(false);
  const [typeRetry, setTypeRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    let cancelled = false;
    setTypesError(false);
    Promise.all([fetchAgentRoomTypes(), fetchAgentVisaTypes(), fetchAgentContractTypes()])
      .then(([rooms, visaRows, contractRows]) => {
        if (cancelled) return;
        setTypes(rooms);
        setVisas(visaRows);
        const seen = new Set<number>();
        setContracts(
          contractRows
            .filter((row) => {
              if (seen.has(row.termMonths)) return false;
              seen.add(row.termMonths);
              return true;
            })
            .sort((a, b) => a.termMonths - b.termMonths),
        );
      })
      .catch(() => {
        if (!cancelled) setTypesError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [typeRetry]);

  const visaLabel = (code: string) =>
    t.masters.visaTypes[code as keyof typeof t.masters.visaTypes] || code;
  const roomLabel = (code: string) =>
    t.masters.roomTypes[code as keyof typeof t.masters.roomTypes] || code;
  const months = (n: number) =>
    t.agent.createRoom.contractMonths.replace('{months}', String(n));
  const matchingBudget = Number(form.budgetMax);
  const matchingReady =
    form.budgetMax.trim() !== '' &&
    Number.isFinite(matchingBudget) &&
    matchingBudget > 0 &&
    pins.length > 0;

  const setField = (key: TextKey, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const switchTab = (next: FormTab) => {
    if (next === tab) return;
    setTab(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const field = (
    key: TextKey,
    opts: {
      label: string;
      maxLength: number;
      placeholder?: string;
      icon?: AppIconName;
      numeric?: boolean;
      required?: boolean;
      multiline?: boolean;
      counter?: boolean;
      style?: object;
    },
  ) => (
    <View key={key} style={[styles.group, opts.style]}>
      <MobileInput
        label={opts.label}
        value={form[key]}
        placeholder={opts.placeholder}
        required={opts.required}
        editable={!busy}
        maxLength={opts.maxLength}
        leadingIcon={opts.icon}
        keyboardType={key === 'phone' ? 'phone-pad' : opts.numeric ? 'decimal-pad' : 'default'}
        error={errors[key]}
        multiline={opts.multiline}
        onChangeText={(value) => setField(key, value)}
      />
      {opts.counter ? (
        <Text style={[styles.counter, { color: theme.textSecondary }]}>
          {form[key].length}/{opts.maxLength}
        </Text>
      ) : null}
    </View>
  );

  /** Preset dropdown + "Other" free-text for nationality / occupation (stored as text). */
  const presetSelect = (
    key: 'nationality' | 'occupation',
    presets: ReadonlyArray<{ code: string; stored: string }>,
    labels: Record<string, string>,
    opts: { label: string; placeholder: string; otherPlaceholder: string; icon: AppIconName },
  ) => {
    const code = presetCodeFor(presets, form[key]);
    const value = code ?? (otherOpen[key] ? LEAD_OTHER_OPTION : null);
    return (
      <View style={[styles.group, styles.rowHalf]}>
        <LeadSelectField<string>
          label={opts.label}
          placeholder={opts.placeholder}
          icon={opts.icon}
          value={value}
          disabled={busy}
          clearLabel={c.unknown}
          options={[
            ...presets.map((preset) => ({ value: preset.code, label: labels[preset.code] ?? preset.stored })),
            { value: LEAD_OTHER_OPTION, label: c.otherOption },
          ]}
          onChange={(next) => {
            if (next === LEAD_OTHER_OPTION) {
              setOtherOpen((current) => ({ ...current, [key]: true }));
              if (code) setField(key, '');
              return;
            }
            setOtherOpen((current) => ({ ...current, [key]: false }));
            setField(key, next ? presets.find((preset) => preset.code === next)?.stored ?? '' : '');
          }}
        />
        {value === LEAD_OTHER_OPTION ? (
          <MobileInput
            value={form[key]}
            placeholder={opts.otherPlaceholder}
            editable={!busy}
            maxLength={key === 'nationality' ? 120 : 255}
            onChangeText={(text) => setField(key, text)}
          />
        ) : null}
      </View>
    );
  };

  const careChoice = (
    key: keyof typeof choices,
    label: string,
    icon: AppIconName,
    yesText: string,
    noText: string,
  ) => (
    <View style={styles.careCell}>
      <View style={styles.careLabelRow}>
        <MobileIcon name={icon} size={15} color={theme.textHeading} />
        <Text style={[styles.careLabel, { color: theme.textHeading }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.segmentRow}>
        {(
          [
            { value: true, text: yesText },
            { value: false, text: noText },
            { value: null, text: c.unsure },
          ] as const
        ).map((item) => {
          const on = choices[key] === item.value;
          return (
            <Pressable
              key={String(item.value)}
              disabled={busy}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${label}: ${item.text}`}
              onPress={() => setChoices((current) => ({ ...current, [key]: item.value }))}
              style={[styles.segment, on && styles.segmentOn]}
            >
              <Text
                style={[styles.segmentText, { color: on ? tokens.colors.primary : theme.textHeading }]}
                numberOfLines={1}
              >
                {item.text}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const occupantChoice = () => {
    const count = Number(form.occupantCount);
    const selected = form.occupantCount.trim() && Number.isFinite(count) ? Math.min(count, 3) : null;
    return (
      <View style={styles.careCell}>
        <View style={styles.careLabelRow}>
          <MobileIcon name="users" size={15} color={theme.textHeading} />
          <Text style={[styles.careLabel, { color: theme.textHeading }]} numberOfLines={1}>
            {c.occupantsLabel}
          </Text>
        </View>
        <View style={styles.segmentRow}>
          {[1, 2, 3].map((n) => {
            const on = selected === n;
            const text = n === 3 ? c.occupantsMany : c.occupantsOption.replace('{count}', String(n));
            return (
              <Pressable
                key={n}
                disabled={busy}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${c.occupantsLabel}: ${text}`}
                onPress={() =>
                  setField('occupantCount', on ? '' : n === 3 && count > 3 ? form.occupantCount : String(n))
                }
                style={[styles.segment, on && styles.segmentOn]}
              >
                <Text
                  style={[styles.segmentText, { color: on ? tokens.colors.primary : theme.textHeading }]}
                  numberOfLines={1}
                >
                  {text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const submit = async () => {
    if (lock.current) return;
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = c.required;
    if (!form.phone.trim()) next.phone = c.required;
    const body: CreateLeadInput = {
      pins,
      radiusKm: pins.length ? radiusKm : null,
      province: initialLead?.province ?? null,
      locations: initialLead?.locations ?? [],
      name: form.name.trim(),
      phone: form.phone.trim(),
      ...choices,
      desiredRoomTypeId: roomType,
      visaTypeId: visaType,
      leaseDurationMonths: leaseMonths,
    };
    for (const key of ['nationality', 'preferredLocation', 'moveInPlan', 'occupation', 'notes'] as const) {
      body[key] = form[key].trim() || null;
    }
    for (const key of ['budgetMin', 'budgetMax', 'occupantCount'] as const) {
      const value = form[key].trim();
      const n = Number(value);
      if (!value) {
        body[key] = null;
        continue;
      }
      const integer = key === 'occupantCount';
      if (
        !Number.isFinite(n) ||
        n < 0 ||
        (key !== 'budgetMin' && n === 0) ||
        (integer && (!Number.isInteger(n) || n > 32767)) ||
        (!integer &&
          (n > 9999999999.99 || Math.abs(n * 100 - Math.round(n * 100)) > 0.001))
      ) {
        next[key] = c.invalidNumber;
      }
      body[key] = n;
    }
    if (body.budgetMin != null && body.budgetMax != null && body.budgetMin > body.budgetMax) {
      next.budgetMax = c.budgetError;
    }
    setErrors(next);
    const errorKeys = Object.keys(next);
    if (errorKeys.length) {
      const target: FormTab = errorKeys.some((key) => PROFILE_KEYS.has(key)) ? 'profile' : 'matching';
      setTab(target);
      scroll.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setSaveError('');
    lock.current = true;
    setBusy(true);
    onBusy(true);
    try {
      const lead = initialLead
        ? await updateAgentLead(initialLead.id, body)
        : await createAgentLead(body);
      onSaved(lead);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
    }
  };

  const profileHasError = ['name', 'phone', 'occupantCount'].some((key) => errors[key]);
  const matchingHasError = ['budgetMin', 'budgetMax'].some((key) => errors[key]);

  const tabButton = (value: FormTab, label: string, hasError: boolean) => {
    const on = tab === value;
    return (
      <Pressable
        key={value}
        onPress={() => switchTab(value)}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        style={[styles.tab, on && styles.tabOn]}
      >
        <Text
          style={[styles.tabText, { color: on ? tokens.colors.primary : theme.textSecondary }, on && styles.tabTextOn]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {hasError ? <View style={styles.tabErrorDot} /> : null}
      </Pressable>
    );
  };

  const profileTab = (
    <Animated.View key="profile" entering={FadeIn.duration(150)} style={styles.tabBody}>
      <View style={styles.sectionHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.heading, { color: theme.textHeading }]}>{c.profileTitle}</Text>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>{c.profileSubtitle}</Text>
        </View>
        <Text style={[styles.requiredLegend, { color: agent }]}>{c.requiredLegend}</Text>
      </View>

      {field('name', {
        label: c.fullName,
        maxLength: 255,
        placeholder: c.namePlaceholder,
        icon: 'user',
        required: true,
      })}
      {field('phone', {
        label: c.phone,
        maxLength: 50,
        placeholder: c.phonePlaceholder,
        icon: 'phone',
        required: true,
      })}
      <View style={styles.row2}>
        {presetSelect('nationality', LEAD_NATIONALITY_OPTIONS, c.nationalityOptions, {
          label: c.nationality,
          placeholder: c.selectNationality,
          otherPlaceholder: c.otherNationalityPlaceholder,
          icon: 'globe',
        })}
        {presetSelect('occupation', LEAD_OCCUPATION_OPTIONS, c.occupationOptions, {
          label: c.occupation,
          placeholder: c.selectOccupation,
          otherPlaceholder: c.otherOccupationPlaceholder,
          icon: 'buildings',
        })}
      </View>
      <LeadSelectField<number>
        label={c.visaType}
        placeholder={c.selectVisaType}
        icon="clipboard"
        value={visaType}
        disabled={busy}
        clearLabel={c.unknown}
        options={visas.map((item) => ({ value: item.id, label: visaLabel(item.code) }))}
        onChange={setVisaType}
      />

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <View style={[styles.careBox, { borderColor: theme.border }]}>
        <View style={{ gap: 2 }}>
          <Text style={[styles.heading, { color: theme.textHeading }]}>{c.careNotes}</Text>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>{c.careNotesHint}</Text>
        </View>
        <View style={styles.row2}>
          {occupantChoice()}
          {careChoice('hasPets', c.hasPets, 'paw', c.petsYes, c.petsNo)}
        </View>
        <View style={styles.row2}>
          {careChoice('usesCar', c.usesCar, 'car', c.carYes, c.carNo)}
          {careChoice('isSmoker', c.isSmoker, 'flame', c.smokeYes, c.smokeNo)}
        </View>
        {field('notes', {
          label: c.notes,
          maxLength: NOTES_MAX,
          placeholder: c.notesPlaceholder,
          icon: 'note',
          multiline: true,
          counter: true,
        })}
      </View>
    </Animated.View>
  );

  const matchingTab = (
    <Animated.View key="matching" entering={FadeIn.duration(150)} style={styles.tabBody}>
      {!bannerDismissed ? (
        <View style={[styles.banner, matchingReady ? styles.bannerReady : styles.bannerPending]}>
          <View style={[styles.bannerIcon, matchingReady ? styles.bannerIconReady : null]}>
            <MobileIcon
              name={matchingReady ? 'check' : 'home'}
              size={18}
              color={matchingReady ? tokens.colors.subtle.successFg : tokens.colors.brand[700]}
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.bannerTitle, { color: theme.textHeading }]}>
              {matchingReady ? c.matchingReady : c.matchingBannerTitle}
            </Text>
            <Text style={[styles.bannerBody, { color: theme.textSecondary }]}>
              {matchingReady ? c.matchingReadyHint : c.matchingBannerBody}
            </Text>
          </View>
          <Pressable
            onPress={() => setBannerDismissed(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={c.dismissBanner}
          >
            <MobileIcon name="close" size={16} color={theme.textSecondary} />
          </Pressable>
        </View>
      ) : null}

      {field('budgetMax', {
        label: c.budgetMax,
        maxLength: 13,
        placeholder: c.budgetMaxPlaceholder,
        icon: 'coins',
        numeric: true,
      })}
      {field('budgetMin', {
        label: c.budgetMin,
        maxLength: 13,
        placeholder: c.budgetMinPlaceholder,
        icon: 'coins',
        numeric: true,
      })}
      <LeadLocationsField
        pins={pins}
        radiusKm={radiusKm}
        legacyLabel={legacyLabel}
        disabled={busy}
        onChange={setPins}
        onRadiusChange={setRadiusKm}
      />
      <View style={styles.row2}>
        <LeadSelectField<number>
          style={styles.rowHalf}
          label={c.roomType}
          placeholder={c.selectRoomType}
          icon="home"
          value={roomType}
          disabled={busy}
          clearLabel={c.unknown}
          options={types.map((item) => ({ value: item.id, label: roomLabel(item.code) }))}
          onChange={setRoomType}
        />
        <LeadSelectField<number>
          style={styles.rowHalf}
          label={c.leaseDurationMonths}
          placeholder={c.selectLeaseDuration}
          icon="calendar"
          value={leaseMonths}
          disabled={busy}
          clearLabel={c.unknown}
          options={contracts.map((item) => ({ value: item.termMonths, label: months(item.termMonths) }))}
          onChange={setLeaseMonths}
        />
      </View>
      <View style={styles.group}>
        <MoveInDateField
          label={c.moveInPlan}
          value={ISO_DATE.test(form.moveInPlan) ? form.moveInPlan : ''}
          onChange={(iso) => setField('moveInPlan', iso)}
          accentColor={tokens.colors.brand[500]}
          locale={locale}
          placeholder={c.selectMoveInDate}
          closeLabel={t.common.cancel}
        />
        {legacyMoveIn && form.moveInPlan === legacyMoveIn ? (
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            {c.moveInLegacy.replace('{value}', legacyMoveIn)}
          </Text>
        ) : null}
      </View>
      {field('preferredLocation', {
        label: c.locationNotesOptional,
        maxLength: 500,
        placeholder: c.locationNotesPlaceholder,
        icon: 'list-rows',
        multiline: true,
        counter: true,
      })}
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.tabsWrap}>
        <View style={[styles.tabs, { borderColor: theme.border }]} accessibilityRole="tablist">
          {tabButton('profile', c.tabProfile, profileHasError)}
          {tabButton('matching', c.tabMatching, matchingHasError)}
        </View>
      </View>

      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.form}
      >
        {tab === 'profile' ? profileTab : matchingTab}

        {typesError ? (
          <View style={styles.group}>
            <Text style={{ color: theme.textSecondary }}>{c.loadError}</Text>
            <MobileButton variant="outline" onPress={() => setTypeRetry((n) => n + 1)}>
              {c.retry}
            </MobileButton>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        {!!saveError && (
          <Text
            accessibilityRole="alert"
            style={[styles.footerError, { color: tokens.colors.danger }]}
          >
            {c.saveError}: {saveError}
          </Text>
        )}
        <MobileButton
          onPress={submit}
          isLoading={busy}
          disabled={busy}
          style={styles.saveButton}
        >
          <View style={styles.saveInner}>
            <MobileIcon name="check" size={18} color={tokens.colors.primary} />
            <Text style={styles.saveText}>
              {initialLead ? t.agent.listings.saveChanges : c.save}
            </Text>
          </View>
        </MobileButton>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  tabsWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  tabs: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    backgroundColor: '#F1F5F9',
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
  },
  tabOn: { backgroundColor: tokens.colors.brand[500] },
  tabText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 15,
    lineHeight: 22,
  },
  tabTextOn: { fontWeight: '600' },
  tabErrorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: tokens.colors.error,
  },
  form: { padding: 16, paddingTop: 12, gap: 14, paddingBottom: 24 },
  tabBody: { gap: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heading: { fontFamily: tokens.typography.native.headingTh, fontSize: 18, lineHeight: 27 },
  hint: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  requiredLegend: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    paddingTop: 4,
  },
  fieldLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  group: { gap: 6 },
  row2: { flexDirection: 'row', gap: 10 },
  rowHalf: { flex: 1, minWidth: 0 },
  counter: {
    fontFamily: tokens.typography.native.body,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'right',
  },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  careBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 14,
    backgroundColor: '#F8FAFC',
  },
  careCell: { flex: 1, minWidth: 0, gap: 8 },
  careLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  careLabel: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  segmentRow: { flexDirection: 'row', gap: 4 },
  segment: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  segmentOn: {
    borderColor: tokens.colors.brand[500],
    backgroundColor: tokens.colors.brand[50],
  },
  segmentText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  bannerPending: {
    backgroundColor: tokens.colors.brand[50],
    borderColor: tokens.colors.brand[100],
  },
  bannerReady: {
    backgroundColor: tokens.colors.subtle.successBg,
    borderColor: tokens.colors.subtle.successBg,
  },
  bannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.brand[100],
  },
  bannerIconReady: { backgroundColor: '#FFFFFF' },
  bannerTitle: {
    fontFamily: tokens.typography.native.bodyBold,
    fontSize: 14,
    lineHeight: 21,
  },
  bannerBody: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 8,
  },
  footerError: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  saveButton: { minHeight: 50, borderRadius: 12 },
  saveInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    color: tokens.colors.primary,
  },
});
