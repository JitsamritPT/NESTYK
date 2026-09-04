import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Pressable,
  ScrollView,
} from 'react-native';
import { useLocale } from '@nestyk/i18n';
import {
  MobileButton,
  MobileBadge,
  MobileInput,
  tokens,
  getCardElevation,
} from '@nestyk/ui/native';
import { ListingEngineConfig } from '../config';

const TOTAL_STEPS = 9;

const FACILITY_OPTIONS = [
  { code: 'aircon', label: 'Aircon' },
  { code: 'washer', label: 'Washer' },
  { code: 'fridge', label: 'Fridge' },
  { code: 'wifi', label: 'Wi‑Fi' },
  { code: 'parking', label: 'Parking' },
  { code: 'pool', label: 'Pool' },
  { code: 'gym', label: 'Gym' },
  { code: 'furniture', label: 'Furnished' },
] as const;

export type CreateRoomWizardSubmitData = {
  visibility: 'private' | 'published';
  property: {
    name: string;
    address: string;
    district: string;
    province: string;
  };
  propertyOwner: {
    name: string;
    phone: string;
    email?: string;
  };
  listingTitle: string;
  roomId?: string;
  availableFromDate: string;
  waterRatePerUnit: number;
  electricRatePerUnit: number;
  prices: Array<{ contractTypeCode: string; price: number }>;
  layout: Array<{ code: string; value: string }>;
  facilities: Array<{ code: string }>;
  nearbyOther?: string;
  medias: Array<{
    mediaUrl: string;
    category: 'room';
    isCover?: boolean;
    sortOrder: number;
  }>;
  documents: Array<{ kind: 'other'; mediaUrl: string; sortOrder: number }>;
  commission?: string;
  isScoutRoom: true;
};

export interface MobileCreateListingWizardBodyProps {
  config: ListingEngineConfig;
  onSubmitListing?: (data: CreateRoomWizardSubmitData) => void;
}

function nativeElevation(level: 1 | 2 | 3) {
  const { boxShadow: _webOnly, ...rest } = getCardElevation(level);
  return rest;
}

function interpolate(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(`{${key}}`, String(value)),
    template,
  );
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export const MobileCreateListingWizardBody: React.FC<
  MobileCreateListingWizardBodyProps
> = ({ config, onSubmitListing }) => {
  const { t } = useLocale();
  const cr = t.agent.createRoom;
  const themeColor = tokens.colors.roles[config.actorRole];

  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [propertyName, setPropertyName] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [province, setProvince] = useState('Bangkok');
  const [listingTitle, setListingTitle] = useState('');
  const [roomId, setRoomId] = useState('');

  const [bedroom, setBedroom] = useState('1');
  const [bathroom, setBathroom] = useState('1');
  const [sizeSqm, setSizeSqm] = useState('');

  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [nearbyOther, setNearbyOther] = useState('');

  const [monthlyRent, setMonthlyRent] = useState('');
  const [waterRate, setWaterRate] = useState('18');
  const [electricRate, setElectricRate] = useState('7');
  const [availableFrom, setAvailableFrom] = useState(todayIsoDate());
  const [commission, setCommission] = useState('3.0');

  const [photoCount, setPhotoCount] = useState(0);
  const [documentCount, setDocumentCount] = useState(0);

  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'published'>('private');

  const stepTitle = useMemo(() => {
    const keys = [
      cr.steps.property,
      cr.steps.layout,
      cr.steps.facilities,
      cr.steps.nearby,
      cr.steps.pricing,
      cr.steps.photos,
      cr.steps.promoAi,
      cr.steps.documents,
      cr.steps.ownerVisibility,
    ] as const;
    return keys[step - 1] ?? '';
  }, [cr.steps, step]);

  const clearFieldError = (key: string) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateStep = (current: number): boolean => {
    const nextErrors: Record<string, string> = {};

    if (current === 1) {
      if (!propertyName.trim()) nextErrors.propertyName = cr.required;
      if (!address.trim()) nextErrors.address = cr.required;
      if (!district.trim()) nextErrors.district = cr.required;
      if (!province.trim()) nextErrors.province = cr.required;
      if (!listingTitle.trim()) nextErrors.listingTitle = cr.required;
    }

    if (current === 5) {
      if (!monthlyRent.trim() || Number(monthlyRent) <= 0) nextErrors.monthlyRent = cr.required;
      if (!waterRate.trim() || Number(waterRate) <= 0) nextErrors.waterRate = cr.required;
      if (!electricRate.trim() || Number(electricRate) <= 0) nextErrors.electricRate = cr.required;
      if (!availableFrom.trim()) nextErrors.availableFrom = cr.required;
    }

    if (current === 6 && photoCount < 5) {
      nextErrors.photos = cr.photosMinError;
    }

    if (current === 9) {
      if (!ownerName.trim()) nextErrors.ownerName = cr.required;
      if (!ownerPhone.trim()) nextErrors.ownerPhone = cr.required;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const skipOptional = () => {
    setErrors({});
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const toggleFacility = (code: string) => {
    setSelectedFacilities((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const buildPayload = (): CreateRoomWizardSubmitData => {
    const medias = Array.from({ length: photoCount }, (_, i) => ({
      mediaUrl: `https://cdn.nestyk.local/mock/room-${i + 1}.jpg`,
      category: 'room' as const,
      isCover: i === 0,
      sortOrder: i,
    }));

    const documents = Array.from({ length: documentCount }, (_, i) => ({
      kind: 'other' as const,
      mediaUrl: `https://cdn.nestyk.local/mock/doc-${i + 1}.pdf`,
      sortOrder: i,
    }));

    const layout = [
      { code: 'bedroom', value: bedroom || '0' },
      { code: 'bathroom', value: bathroom || '0' },
    ];
    if (sizeSqm.trim()) layout.push({ code: 'size_sqm', value: sizeSqm.trim() });

    return {
      visibility,
      property: {
        name: propertyName.trim(),
        address: address.trim(),
        district: district.trim(),
        province: province.trim(),
      },
      propertyOwner: {
        name: ownerName.trim(),
        phone: ownerPhone.trim(),
        email: ownerEmail.trim() || undefined,
      },
      listingTitle: listingTitle.trim(),
      roomId: roomId.trim() || undefined,
      availableFromDate: availableFrom.trim(),
      waterRatePerUnit: Number(waterRate),
      electricRatePerUnit: Number(electricRate),
      prices: [{ contractTypeCode: 'monthly_12', price: Number(monthlyRent) }],
      layout,
      facilities: selectedFacilities.map((code) => ({ code })),
      nearbyOther: nearbyOther.trim() || undefined,
      medias,
      documents,
      commission: config.features.enableCommission ? commission : undefined,
      isScoutRoom: true,
    };
  };

  const handleSubmit = () => {
    if (!validateStep(9)) return;
    const payload = buildPayload();
    if (onSubmitListing) {
      onSubmitListing(payload);
      return;
    }
    Alert.alert(cr.successTitle, cr.successBody);
  };

  const renderNav = (opts?: { skippable?: boolean; isLast?: boolean }) => (
    <View style={styles.btnRow}>
      {step > 1 ? (
        <View style={{ flex: 1 }}>
          <MobileButton variant="outline" onPress={goBack}>
            {cr.back}
          </MobileButton>
        </View>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {opts?.skippable ? (
        <View style={{ flex: 1 }}>
          <MobileButton variant="outline" onPress={skipOptional}>
            {cr.skip}
          </MobileButton>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        {opts?.isLast ? (
          <MobileButton onPress={handleSubmit}>{cr.submit}</MobileButton>
        ) : (
          <MobileButton onPress={goNext}>{cr.next}</MobileButton>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{cr.title}</Text>
          <Text style={styles.subtitle}>
            {config.actorRole === 'owner'
              ? t.owner.createNewListing
              : cr.subtitle}
          </Text>
        </View>
        <MobileBadge
          role={config.actorRole}
          label={interpolate(cr.stepOf, { step, total: TOTAL_STEPS })}
        />
      </View>

      <View style={[styles.progressTrack]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${(step / TOTAL_STEPS) * 100}%`,
              backgroundColor: themeColor,
            },
          ]}
        />
      </View>
      <Text style={[styles.stepLabel, { color: themeColor }]}>{stepTitle}</Text>

      <View style={[styles.card, nativeElevation(1)]}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 14, paddingBottom: 4 }}
        >
          {step === 1 && (
            <>
              <MobileInput
                label={cr.propertyName}
                placeholder={cr.propertyNamePlaceholder}
                value={propertyName}
                onChangeText={(v) => {
                  setPropertyName(v);
                  clearFieldError('propertyName');
                }}
                error={errors.propertyName}
              />
              <MobileInput
                label={cr.address}
                placeholder={cr.addressPlaceholder}
                value={address}
                onChangeText={(v) => {
                  setAddress(v);
                  clearFieldError('address');
                }}
                error={errors.address}
              />
              <MobileInput
                label={cr.district}
                placeholder="e.g. Watthana"
                value={district}
                onChangeText={(v) => {
                  setDistrict(v);
                  clearFieldError('district');
                }}
                error={errors.district}
              />
              <MobileInput
                label={cr.province}
                placeholder="Bangkok"
                value={province}
                onChangeText={(v) => {
                  setProvince(v);
                  clearFieldError('province');
                }}
                error={errors.province}
              />
              <MobileInput
                label={cr.listingTitle}
                placeholder={cr.listingTitlePlaceholder}
                value={listingTitle}
                onChangeText={(v) => {
                  setListingTitle(v);
                  clearFieldError('listingTitle');
                }}
                error={errors.listingTitle}
              />
              <MobileInput
                label={cr.roomId}
                placeholder={cr.roomIdPlaceholder}
                value={roomId}
                onChangeText={setRoomId}
              />
              {renderNav()}
            </>
          )}

          {step === 2 && (
            <>
              <MobileInput
                label={cr.bedroom}
                keyboardType="numeric"
                value={bedroom}
                onChangeText={setBedroom}
              />
              <MobileInput
                label={cr.bathroom}
                keyboardType="numeric"
                value={bathroom}
                onChangeText={setBathroom}
              />
              <MobileInput
                label={cr.sizeSqm}
                keyboardType="numeric"
                placeholder="28"
                value={sizeSqm}
                onChangeText={setSizeSqm}
              />
              {renderNav({ skippable: true })}
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.hint}>{cr.facilitiesHint}</Text>
              <View style={styles.chipWrap}>
                {FACILITY_OPTIONS.map((item) => {
                  const selected = selectedFacilities.includes(item.code);
                  return (
                    <Pressable
                      key={item.code}
                      onPress={() => toggleFacility(item.code)}
                      android_ripple={{ color: '#00000014' }}
                      style={[
                        styles.chip,
                        selected && {
                          backgroundColor: `${themeColor}18`,
                          borderColor: themeColor,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && { color: themeColor, fontWeight: '700' },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {renderNav({ skippable: true })}
            </>
          )}

          {step === 4 && (
            <>
              <MobileInput
                label={cr.nearbyOther}
                placeholder={cr.nearbyPlaceholder}
                value={nearbyOther}
                onChangeText={setNearbyOther}
                multiline
                style={{ height: 88, textAlignVertical: 'top', paddingTop: 10 }}
              />
              {renderNav({ skippable: true })}
            </>
          )}

          {step === 5 && (
            <>
              <MobileInput
                label={cr.monthlyRent}
                placeholder="12000"
                keyboardType="numeric"
                value={monthlyRent}
                onChangeText={(v) => {
                  setMonthlyRent(v);
                  clearFieldError('monthlyRent');
                }}
                error={errors.monthlyRent}
              />
              <MobileInput
                label={cr.waterRate}
                keyboardType="numeric"
                value={waterRate}
                onChangeText={(v) => {
                  setWaterRate(v);
                  clearFieldError('waterRate');
                }}
                error={errors.waterRate}
              />
              <MobileInput
                label={cr.electricRate}
                keyboardType="numeric"
                value={electricRate}
                onChangeText={(v) => {
                  setElectricRate(v);
                  clearFieldError('electricRate');
                }}
                error={errors.electricRate}
              />
              <MobileInput
                label={cr.availableFrom}
                placeholder="2026-04-01"
                value={availableFrom}
                onChangeText={(v) => {
                  setAvailableFrom(v);
                  clearFieldError('availableFrom');
                }}
                error={errors.availableFrom}
              />
              {config.features.enableCommission ? (
                <MobileInput
                  label={cr.commission}
                  keyboardType="numeric"
                  value={commission}
                  onChangeText={setCommission}
                  helperText={cr.commissionHint}
                />
              ) : null}
              {renderNav()}
            </>
          )}

          {step === 6 && (
            <>
              <Text style={styles.hint}>{cr.photosHint}</Text>
              <Text style={[styles.photoCount, { color: themeColor }]}>
                {interpolate(cr.photosCount, { count: photoCount })}
              </Text>
              {errors.photos ? (
                <Text style={styles.errorText}>{errors.photos}</Text>
              ) : null}
              <View style={styles.photoGrid}>
                {Array.from({ length: photoCount }, (_, i) => (
                  <View
                    key={`photo-${i}`}
                    style={[styles.photoSlot, { borderColor: themeColor }]}
                  >
                    <Text style={styles.photoSlotLabel}>{i + 1}</Text>
                  </View>
                ))}
              </View>
              <MobileButton
                variant="outline"
                onPress={() => {
                  setPhotoCount((c) => Math.min(12, c + 1));
                  clearFieldError('photos');
                }}
              >
                {cr.addPhoto}
              </MobileButton>
              {renderNav()}
            </>
          )}

          {step === 7 && (
            <>
              <View style={[styles.aiBox, { borderColor: themeColor }]}>
                <Text style={[styles.aiTitle, { color: themeColor }]}>
                  {cr.promoAiTitle}
                </Text>
                <Text style={styles.aiDesc}>{cr.promoAiDesc}</Text>
              </View>
              {renderNav({ skippable: true })}
            </>
          )}

          {step === 8 && (
            <>
              <Text style={styles.hint}>{cr.documentsHint}</Text>
              <Text style={styles.photoCount}>
                {documentCount > 0 ? `${documentCount} doc(s)` : '—'}
              </Text>
              <MobileButton
                variant="outline"
                onPress={() => setDocumentCount((c) => Math.min(5, c + 1))}
              >
                {cr.addDocument}
              </MobileButton>
              {renderNav({ skippable: true })}
            </>
          )}

          {step === 9 && (
            <>
              <MobileInput
                label={cr.ownerName}
                placeholder="Somchai Jaidee"
                value={ownerName}
                onChangeText={(v) => {
                  setOwnerName(v);
                  clearFieldError('ownerName');
                }}
                error={errors.ownerName}
              />
              <MobileInput
                label={cr.ownerPhone}
                placeholder="0812345678"
                keyboardType="phone-pad"
                value={ownerPhone}
                onChangeText={(v) => {
                  setOwnerPhone(v);
                  clearFieldError('ownerPhone');
                }}
                error={errors.ownerPhone}
              />
              <MobileInput
                label={cr.ownerEmail}
                placeholder="owner@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={ownerEmail}
                onChangeText={setOwnerEmail}
              />

              <Text style={styles.fieldLabel}>{cr.visibility}</Text>
              <View style={styles.visibilityRow}>
                {(
                  [
                    {
                      value: 'private' as const,
                      label: cr.visibilityPrivate,
                      hint: cr.visibilityPrivateHint,
                    },
                    {
                      value: 'published' as const,
                      label: cr.visibilityPublished,
                      hint: cr.visibilityPublishedHint,
                    },
                  ] as const
                ).map((opt) => {
                  const selected = visibility === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setVisibility(opt.value)}
                      android_ripple={{ color: '#00000014' }}
                      style={[
                        styles.visibilityCard,
                        selected && {
                          borderColor: themeColor,
                          backgroundColor: `${themeColor}12`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.visibilityLabel,
                          selected && { color: themeColor },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <Text style={styles.visibilityHint}>{opt.hint}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {renderNav({ isLast: true })}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '500',
    color: tokens.colors.textHeading,
  },
  subtitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
    fontWeight: '400',
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: tokens.colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  stepLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 18,
    maxHeight: 520,
  },
  hint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  fieldLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    color: tokens.colors.textHeading,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  chipText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    color: tokens.colors.textHeading,
  },
  photoCount: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoSlot: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.background,
  },
  photoSlotLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    color: tokens.colors.textSecondary,
  },
  aiBox: {
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  aiTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    marginBottom: 4,
  },
  aiDesc: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
    fontWeight: '400',
  },
  visibilityRow: {
    gap: 10,
  },
  visibilityCard: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  visibilityLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    color: tokens.colors.textHeading,
    marginBottom: 4,
  },
  visibilityHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  errorText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.error,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
});
