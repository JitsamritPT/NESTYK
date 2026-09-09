import type { FacilityOption, NearbyPlace } from '@nestyk/types';
import { RoomFacilitiesEditor } from './RoomFacilitiesEditor';
import { RoomNearbyEditor, type NearbySearch } from './RoomNearbyEditor';
import { RoomEditSectionList } from './RoomEditSectionList';
import { relocateNearby, isCustomPlace } from '../nearby';
import Animated, { FadeIn } from 'react-native-reanimated';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Pressable,
  Keyboard,
  ActivityIndicator,
  ScrollView,
  Modal,
  BackHandler,
  Image,
} from 'react-native';
import { useLocale } from '@nestyk/i18n';
import {
  MobileButton,
  MobileBadge,
  MobileInput,
  MobileIcon,
  tokens,
  getCardElevation,
} from '@nestyk/ui/native';
import { ListingEngineConfig } from '../config';
import { PlaceDetails, PlaceSuggestion } from '../places';
import { PropertyPlaceMap } from './PropertyPlaceMap';

const CREATE_STEPS = [1, 2, 6, 5, 8];
const EDIT_STEPS = [1, 2, 5, 8, 6, 3, 4, 7];
const OWNER_NOTE_MAX = 200;
const DEFAULT_MAP = { latitude: 13.7563, longitude: 100.5018 };
const ADVANCE_MONTH_OPTIONS = [0, 1, 2] as const;
const DEPOSIT_MONTH_OPTIONS = [1, 2, 3] as const;
const LISTING_SOURCE_OPTIONS = [
  { code: 'co_agent' as const, role: 'agent' as const, icon: 'handshake' as const },
  { code: 'owner' as const, role: 'owner' as const, icon: 'user' as const },
];

export type ContactOption = {
  id: number;
  name: string;
  phone: string;
  note?: string | null;
  roomCount?: number;
};

/** @deprecated use ContactOption */
export type PropertyOwnerOption = ContactOption;

export type PropertyTypeOption = {
  id: number;
  code: string;
};

export type ContractTypeOption = {
  id: number;
  code: string;
  termMonths: number;
};

export type RoomTypeOption = {
  id: number;
  code: string;
  bedroomCount: number | null;
};

export type ListingSourceCode = 'co_agent' | 'owner';

export type CreateRoomWizardSubmitData = {
  visibility: 'private' | 'published';
  listingDescription?: string;
  availableFromDate?: string;
  property: {
    name: string;
    address: string;
    district: string;
    province: string;
    propertyTypeId: number;
    subdistrict?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
  };
  contactId?: number;
  contact?: {
    name: string;
    phone: string;
    note?: string;
  };
  listingTitle: string;
  listingSourceCode: ListingSourceCode;
  roomTypeId?: number;
  roomId?: string;
  waterRatePerUnit?: number;
  electricRatePerUnit?: number;
  prices: Array<{ contractTypeId: number; price: number }>;
  advanceRentMonths: number;
  depositMonths: number;
  layout: Array<{ code: string; value: string }>;
  facilities: FacilityOption[];
  customFacilities?: string[];
  nearbyPlaces?: NearbyPlace[];
  nearbyOther?: string;
  medias: Array<{
    mediaUrl: string;
    category: 'room';
    isCover?: boolean;
    sortOrder: number;
  }>;
  documents: Array<{ kind: 'id_passport' | 'bookbank' | 'ownership' | 'other'; mediaUrl: string; sortOrder: number }>;
  isScoutRoom: true;
  latitude?: number;
  longitude?: number;
};

export type RoomPhoto = { uri: string; name: string; mimeType: string; file?: Blob; mediaUrl?: string };

export interface MobileCreateListingWizardBodyProps {
  initialData?: CreateRoomWizardSubmitData;
  title?: string;
  submitLabel?: string;
  onSubmittingChange?: (busy: boolean) => void;
  pickPhotos?: (limit: number) => Promise<RoomPhoto[]>;
  uploadPhoto?: (photo: RoomPhoto) => Promise<string>;
  config: ListingEngineConfig;
  onSubmitListing?: (data: CreateRoomWizardSubmitData) => void | Promise<void>;
  searchPlaces?: (query: string) => Promise<PlaceSuggestion[]>;
  getPlaceDetails?: (placeId: string) => Promise<PlaceDetails>;
  listContacts?: () => Promise<ContactOption[]>;
  listPropertyTypes?: () => Promise<PropertyTypeOption[]>;
  listContractTypes?: () => Promise<ContractTypeOption[]>;
  listRoomTypes?: () => Promise<RoomTypeOption[]>;
  listFacilities?: () => Promise<FacilityOption[]>;
  searchNearby?: NearbySearch;
  mapsApiKey?: string;
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

function formatBaht(value: number) {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function monthChipLabel(months: number, noneLabel: string, monthsTemplate: string) {
  if (months === 0) return noneLabel;
  return interpolate(monthsTemplate, { months });
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function isFilledCount(value: string) {
  return /^\d+$/.test(value.trim());
}

export const MobileCreateListingWizardBody: React.FC<
  MobileCreateListingWizardBodyProps
> = ({
  config,
  initialData,
  title,
  submitLabel,
  onSubmittingChange,
  pickPhotos,
  uploadPhoto,
  onSubmitListing,
  searchPlaces,
  getPlaceDetails,
  listContacts,
  listPropertyTypes,
  listContractTypes,
  listRoomTypes,
  listFacilities,
  searchNearby,
  mapsApiKey,
}) => {
  const { t } = useLocale();
  const cr = t.agent.createRoom;
  const themeColor = tokens.colors.roles[config.actorRole];

  const [step, setStep] = useState(1);
  const visibleSteps = initialData ? EDIT_STEPS : CREATE_STEPS;
  const stepIndex = visibleSteps.indexOf(step);
  const [description, setDescription] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [nearbyOther, setNearbyOther] = useState('');
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [customFacilities, setCustomFacilities] = useState('');
  const [facilities, setFacilities] = useState<CreateRoomWizardSubmitData['facilities']>([]);
  const [facilityOptions, setFacilityOptions] = useState<FacilityOption[]>([]);
  const [facilityError, setFacilityError] = useState('');
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [documents, setDocuments] = useState<CreateRoomWizardSubmitData['documents']>([]);
  const loadFacilities = async () => {
    if (!listFacilities) return;
    setFacilitiesLoading(true); setFacilityError('');
    try { setFacilityOptions(await listFacilities()); }
    catch { setFacilityError(cr.detailsLoadError); }
    finally { setFacilitiesLoading(false); }
  };
  useEffect(() => { if (initialData) void loadFacilities(); }, [listFacilities, !!initialData]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [propertyName, setPropertyName] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [province, setProvince] = useState('Bangkok');
  const [subdistrict, setSubdistrict] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [propertyTypeId, setPropertyTypeId] = useState<number | null>(null);
  const [propertyTypes, setPropertyTypes] = useState<PropertyTypeOption[]>([]);
  const [propertyTypesLoading, setPropertyTypesLoading] = useState(false);
  const [propertyTypesError, setPropertyTypesError] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState('');
  const [hasSearchedPlaces, setHasSearchedPlaces] = useState(false);
  const skipPlacesSearch = useRef(false);
  const placesSeq = useRef(0);
  const searchPlacesRef = useRef(searchPlaces);
  const getPlaceDetailsRef = useRef(getPlaceDetails);
  const listContactsRef = useRef(listContacts);
  const listPropertyTypesRef = useRef(listPropertyTypes);
  const listContractTypesRef = useRef(listContractTypes);
  const listRoomTypesRef = useRef(listRoomTypes);
  const formScrollRef = useRef<ScrollView>(null);
  searchPlacesRef.current = searchPlaces;
  getPlaceDetailsRef.current = getPlaceDetails;
  listContactsRef.current = listContacts;
  listPropertyTypesRef.current = listPropertyTypes;
  listContractTypesRef.current = listContractTypes;
  listRoomTypesRef.current = listRoomTypes;
  const [listingTitle, setListingTitle] = useState('');
  const [listingSourceCode, setListingSourceCode] = useState<ListingSourceCode | null>(null);
  const [roomId, setRoomId] = useState('');
  const [floor, setFloor] = useState('');
  const [building, setBuilding] = useState('');
  const [roomTypeId, setRoomTypeId] = useState<number | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [roomTypesLoading, setRoomTypesLoading] = useState(false);
  const [roomTypesError, setRoomTypesError] = useState('');

  const [bedroom, setBedroom] = useState('');
  const [bathroom, setBathroom] = useState('1');
  const [sizeSqm, setSizeSqm] = useState('');

  const [rentsByTypeId, setRentsByTypeId] = useState<Record<string, string>>({});
  const [selectedContractTypeIds, setSelectedContractTypeIds] = useState<number[]>([]);
  const [contractTypes, setContractTypes] = useState<ContractTypeOption[]>([]);
  const [contractTypesLoading, setContractTypesLoading] = useState(false);
  const [contractTypesError, setContractTypesError] = useState('');
  const [advanceRentMonths, setAdvanceRentMonths] = useState(1);
  const [depositMonths, setDepositMonths] = useState(2);
  const [waterRate, setWaterRate] = useState('');
  const [electricRate, setElectricRate] = useState('');

  const [photos, setPhotos] = useState<RoomPhoto[]>([]);
  const photoCount = photos.length;
  const [pickingPhotos, setPickingPhotos] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const submitLock = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerOther, setOwnerOther] = useState('');
  const [ownerMode, setOwnerMode] = useState<'pick' | 'create'>(
    listContacts ? 'pick' : 'create',
  );
  const [ownerQuery, setOwnerQuery] = useState('');
  const [owners, setOwners] = useState<PropertyOwnerOption[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [ownersError, setOwnersError] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null);
  const [requiredPrompt, setRequiredPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (!initialData) return;
    setDescription(initialData.listingDescription ?? '');
    setAvailableFrom(initialData.availableFromDate ?? '');
    setNearbyOther(initialData.nearbyOther ?? '');
    setNearbyPlaces(initialData.nearbyPlaces ?? []);
    setCustomFacilities((initialData.customFacilities ?? []).join('\n'));
    setFacilities(initialData.facilities);
    setDocuments(initialData.documents);
    const p = initialData.property;
    setPropertyName(p.name); setAddress(p.address); setDistrict(p.district); setProvince(p.province);
    setSubdistrict(p.subdistrict ?? ''); setPostalCode(p.postalCode ?? ''); setPropertyTypeId(p.propertyTypeId);
    setLatitude(initialData.latitude ?? p.latitude ?? null); setLongitude(initialData.longitude ?? p.longitude ?? null);
    setListingTitle(initialData.listingTitle); setListingSourceCode(initialData.listingSourceCode);
    setRoomId(initialData.roomId ?? ''); setRoomTypeId(initialData.roomTypeId ?? null);
    const values = Object.fromEntries(initialData.layout.map((item) => [item.code, item.value]));
    setBedroom(values.bedroom ?? ''); setBathroom(values.bathroom ?? ''); setSizeSqm(values.room_size ?? '');
    setFloor(values.floor ?? ''); setBuilding(values.building ?? '');
    setRentsByTypeId(Object.fromEntries(initialData.prices.map((price) => [String(price.contractTypeId), String(price.price)])));
    setSelectedContractTypeIds(initialData.prices.map((price) => price.contractTypeId));
    setAdvanceRentMonths(initialData.advanceRentMonths); setDepositMonths(initialData.depositMonths);
    setWaterRate(initialData.waterRatePerUnit == null ? '' : String(initialData.waterRatePerUnit));
    setElectricRate(initialData.electricRatePerUnit == null ? '' : String(initialData.electricRatePerUnit));
    setPhotos(initialData.medias.map((media) => ({ uri: media.mediaUrl, mediaUrl: media.mediaUrl, name: 'room.jpg', mimeType: 'image/jpeg' })));
    setSelectedOwnerId(initialData.contactId ?? null);
    setOwnerMode(initialData.contactId ? 'pick' : 'create');
    setOwnerName(initialData.contact?.name ?? ''); setOwnerPhone(initialData.contact?.phone ?? '');
    setOwnerOther(initialData.contact?.note ?? '');
    skipPlacesSearch.current = true;
  }, [initialData]);

  useEffect(() => {
    if (latitude == null || longitude == null) return;
    setNearbyPlaces((current) => relocateNearby(current, latitude, longitude));
  }, [latitude, longitude]);

  const stepTitle = useMemo(() => {
    const keys = [
      cr.steps.property,
      cr.steps.layout,
      cr.steps.facilities,
      cr.steps.nearby,
      cr.steps.pricing,
      cr.steps.photos,
      cr.detailsTitle,
      cr.steps.ownerVisibility,
    ] as const;
    return keys[step - 1] ?? '';
  }, [cr.steps, step]);

  const fieldLabel = (key: string) => {
    const labels: Record<string, string> = {
      propertyName: cr.propertyName,
      address: cr.address,
      district: cr.district,
      province: cr.province,
      propertyType: cr.propertyType,
      listingTitle: cr.listingTitle,
      roomType: cr.roomType,
      bedroom: cr.bedroom,
      bathroom: cr.bathroom,
      monthlyRent: cr.monthlyRent,
      contractTerm: cr.contractTerm,
      sizeSqm: cr.sizeSqm,
      ownerName: cr.ownerName,
      ownerPhone: cr.ownerPhone,
      photos: cr.steps.photos,
      ownerPick: cr.ownerPickRequired,
    };
    if (key.startsWith('rent_')) {
      const id = Number(key.slice(5));
      const opt = contractTypes.find((item) => item.id === id);
      if (opt) return interpolate(cr.monthlyRentForTerm, { months: opt.termMonths });
    }
    return labels[key] ?? key;
  };

  const requiredMessage = (key: string) => {
    if (key === 'nearbyPlaces') return cr.invalidNearby;
    if (key === 'availableFrom') return cr.invalidDate;
    if (key === 'documents') return cr.invalidDocumentUrl;
    if (key === 'customFacilities') return cr.customFacilitiesHint;
    if (key === 'photos') return cr.photosMinError;
    if (key === 'ownerPick') return cr.ownerPickRequired;
    if (key === 'contractTerm') return cr.contractTermRequired;
    if (key === 'propertyType') return cr.propertyTypeRequired;
    if (key === 'roomType') return cr.roomTypeRequired;
    return interpolate(cr.requiredFillField, { field: fieldLabel(key) });
  };

  const scrollToTop = () => {
    formScrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  useEffect(() => {
    if (!requiredPrompt) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setRequiredPrompt(null);
      return true;
    });
    return () => sub.remove();
  }, [requiredPrompt]);

  useEffect(() => {
    scrollToTop();
  }, [step, listingSourceCode]);

  const clearFieldError = (key: string) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toggleContract = (id: number) => {
    setSelectedContractTypeIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      return contractTypes.map((opt) => opt.id).filter((item) => next.includes(item));
    });
    clearFieldError('contractTerm');
    clearFieldError(`rent_${id}`);
  };

  const renderMonthChips = (
    options: readonly number[],
    value: number,
    onChange: (months: number) => void,
  ) => (
    <View style={styles.termRow}>
      {options.map((months) => {
        const selected = value === months;
        return (
          <Pressable
            key={months}
            onPress={() => onChange(months)}
            android_ripple={{ color: '#00000022' }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.termChip,
              selected ? { backgroundColor: themeColor, borderColor: themeColor } : null,
              pressed ? { opacity: 0.88 } : null,
            ]}
          >
            <Text
              style={[styles.termChipText, selected ? styles.termChipTextSelected : null]}
            >
              {monthChipLabel(months, cr.monthsNone, cr.contractMonths)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  useEffect(() => {
    if (!searchPlacesRef.current) return;
    if (skipPlacesSearch.current) {
      skipPlacesSearch.current = false;
      return;
    }

    const query = propertyName.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setPlacesLoading(false);
      setPlacesError('');
      setHasSearchedPlaces(false);
      return;
    }

    let cancelled = false;
    const seq = ++placesSeq.current;
    setPlacesLoading(true);
    const timer = setTimeout(() => {
      const search = searchPlacesRef.current;
      if (!search) return;
      search(query)
        .then((rows) => {
          if (cancelled || seq !== placesSeq.current) return;
          setSuggestions(rows);
          setPlacesError('');
          setHasSearchedPlaces(true);
        })
        .catch((err) => {
          if (cancelled || seq !== placesSeq.current) return;
          setSuggestions([]);
          setPlacesError(err instanceof Error && err.message ? err.message : cr.placesError);
          setHasSearchedPlaces(true);
        })
        .finally(() => {
          if (!cancelled && seq === placesSeq.current) setPlacesLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [propertyName, cr.placesError]);

  useEffect(() => {
    if (step !== 8) return;
    const loadOwners = listContactsRef.current;
    if (!loadOwners) return;
    let cancelled = false;
    setOwnersLoading(true);
    loadOwners()
      .then((rows) => {
        if (cancelled) return;
        setOwners(rows);
        setOwnersError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setOwners([]);
        setOwnersError(err instanceof Error && err.message ? err.message : cr.ownerLoadError);
      })
      .finally(() => {
        if (!cancelled) setOwnersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, cr.ownerLoadError]);

  useEffect(() => {
    const loadTypes = listPropertyTypesRef.current;
    if (!loadTypes) return;
    let cancelled = false;
    setPropertyTypesLoading(true);
    loadTypes()
      .then((rows) => {
        if (cancelled) return;
        setPropertyTypes(rows);
        setPropertyTypesError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setPropertyTypes([]);
        setPropertyTypesError(
          err instanceof Error && err.message ? err.message : cr.propertyTypeLoadError,
        );
      })
      .finally(() => {
        if (!cancelled) setPropertyTypesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cr.propertyTypeLoadError]);

  useEffect(() => {
    const loadTypes = listContractTypesRef.current;
    if (!loadTypes) return;
    let cancelled = false;
    setContractTypesLoading(true);
    loadTypes()
      .then((rows) => {
        if (cancelled) return;
        setContractTypes(rows);
        setContractTypesError('');
        setSelectedContractTypeIds((prev) => {
          const valid = prev.filter((id) => rows.some((item) => item.id === id));
          if (valid.length) return valid;
          const twelve = rows.find((item) => item.termMonths === 12) ?? rows[0];
          return twelve ? [twelve.id] : [];
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setContractTypes([]);
        setContractTypesError(
          err instanceof Error && err.message ? err.message : cr.contractTermRequired,
        );
      })
      .finally(() => {
        if (!cancelled) setContractTypesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cr.contractTermRequired]);

  useEffect(() => {
    const loadTypes = listRoomTypesRef.current;
    if (!loadTypes) return;
    let cancelled = false;
    setRoomTypesLoading(true);
    loadTypes()
      .then((rows) => {
        if (cancelled) return;
        setRoomTypes(rows);
        setRoomTypesError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setRoomTypes([]);
        setRoomTypesError(
          err instanceof Error && err.message ? err.message : cr.roomTypeLoadError,
        );
      })
      .finally(() => {
        if (!cancelled) setRoomTypesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cr.roomTypeLoadError]);

  const selectedOwner = useMemo(
    () => owners.find((item) => item.id === selectedOwnerId) ?? null,
    [owners, selectedOwnerId],
  );

  const filteredOwners = useMemo(() => {
    const q = ownerQuery.trim().toLowerCase();
    const qDigits = digitsOnly(ownerQuery);
    if (!q) return owners;
    return owners.filter((item) => {
      const nameHit = item.name.toLowerCase().includes(q);
      const phoneHit =
        item.phone.includes(ownerQuery.trim()) ||
        (qDigits.length > 0 && digitsOnly(item.phone).includes(qDigits));
      return nameHit || phoneHit;
    });
  }, [owners, ownerQuery]);

  const matchedOwnerByPhone = useMemo(() => {
    const phone = digitsOnly(ownerPhone);
    if (ownerMode !== 'create' || phone.length < 8) return null;
    return owners.find((item) => digitsOnly(item.phone) === phone) ?? null;
  }, [owners, ownerPhone, ownerMode]);

  const handleSelectOwner = (item: PropertyOwnerOption) => {
    Keyboard.dismiss();
    setSelectedOwnerId(item.id);
    setOwnerName(item.name);
    setOwnerPhone(item.phone);
    setOwnerOther(item.note || '');
    setOwnerMode('pick');
    setOwnerQuery('');
    clearFieldError('ownerPick');
    clearFieldError('ownerName');
    clearFieldError('ownerPhone');
  };

  const handleSelectPlace = async (item: PlaceSuggestion) => {
    const loadDetails = getPlaceDetailsRef.current;
    if (!loadDetails) return;
    Keyboard.dismiss();
    skipPlacesSearch.current = true;
    placesSeq.current += 1;
    setSuggestions([]);
    setHasSearchedPlaces(false);
    setPlacesLoading(true);
    try {
      const details = await loadDetails(item.placeId);
      skipPlacesSearch.current = true;
      setPropertyName(details.name || item.name);
      setAddress(details.address);
      setDistrict(details.district);
      setProvince(details.province);
      setSubdistrict(details.subdistrict || '');
      setPostalCode(details.postalCode || '');
      setLatitude(details.latitude);
      setLongitude(details.longitude);
      clearFieldError('propertyName');
      clearFieldError('address');
      if (details.district) clearFieldError('district');
      if (details.province) clearFieldError('province');
      setPlacesError('');
    } catch (err) {
      setPlacesError(err instanceof Error && err.message ? err.message : cr.placesError);
    } finally {
      setPlacesLoading(false);
    }
  };

  const collectStepErrors = (current: number): Record<string, string> => {
    const nextErrors: Record<string, string> = {};

    if (current === 1) {
      if (listPropertyTypesRef.current && !propertyTypeId) {
        nextErrors.propertyType = cr.propertyTypeRequired;
      }
      if (!propertyName.trim()) nextErrors.propertyName = cr.required;
      if (!address.trim()) nextErrors.address = cr.required;
      if (!district.trim()) nextErrors.district = cr.required;
      if (!province.trim()) nextErrors.province = cr.required;
    }

    if (current === 2) {
      if (!listingTitle.trim()) nextErrors.listingTitle = cr.required;
      if (listRoomTypesRef.current && !roomTypeId) {
        nextErrors.roomType = cr.roomTypeRequired;
      }
      if (!isFilledCount(bedroom)) nextErrors.bedroom = cr.required;
      if (!isFilledCount(bathroom)) nextErrors.bathroom = cr.required;
      if (sizeSqm.trim() && (!Number.isFinite(Number(sizeSqm)) || Number(sizeSqm) <= 0)) nextErrors.sizeSqm = cr.required;
    }

    if (current === 5) {
      if (selectedContractTypeIds.length === 0) nextErrors.contractTerm = cr.contractTermRequired;
      for (const opt of contractTypes) {
        if (!selectedContractTypeIds.includes(opt.id)) continue;
        const value = rentsByTypeId[String(opt.id)] ?? '';
        if (!value.trim() || Number(value) <= 0) {
          nextErrors[`rent_${opt.id}`] = cr.required;
        }
      }
    }

    if (current === 6 && initialData?.visibility === 'published' && photoCount < 5) {
      nextErrors.photos = cr.photosMinError;
    }

    if (current === 8) {
      if (selectedOwnerId) {
        // existing owner is enough
      } else if (ownerMode === 'pick' && listContactsRef.current) {
        nextErrors.ownerPick = cr.ownerPickRequired;
      } else {
        if (!ownerName.trim()) nextErrors.ownerName = cr.required;
        if (!ownerPhone.trim()) nextErrors.ownerPhone = cr.required;
      }
    }

    if (current === 7) {
      if (availableFrom && (!/^\d{4}-\d{2}-\d{2}$/.test(availableFrom) || !Number.isFinite(Date.parse(availableFrom)) || new Date(availableFrom).toISOString().slice(0, 10) !== availableFrom)) nextErrors.availableFrom = cr.invalidDate;
      if (documents.some((d) => { try { const url = new URL(d.mediaUrl); return url.protocol !== 'https:' || !url.hostname || d.mediaUrl.length > 500; } catch { return true; } })) nextErrors.documents = cr.invalidDocumentUrl;

    }
    if (current === 3) {
      const custom = customFacilities.split('\n').map((v) => v.trim()).filter(Boolean);
      if (custom.length > 50 || custom.some((v) => v.length > 100)) nextErrors.customFacilities = cr.customFacilitiesHint;
    }
    if (current === 4) {
      const customCount = nearbyPlaces.filter(isCustomPlace).length;
      if (nearbyPlaces.some((p) => !p.name.trim()) || customCount > 5 || nearbyPlaces.length - customCount > 24) nextErrors.nearbyPlaces = cr.invalidNearby;
      if (nearbyPlaces.length && (latitude == null || longitude == null)) nextErrors.nearbyPlaces = cr.nearbyMissingCoords;
    }
    return nextErrors;
  };

  const validateStep = (current: number): string | null => {
    const nextErrors = collectStepErrors(current);
    setErrors(nextErrors);
    return Object.keys(nextErrors)[0] ?? null;
  };

  // Edit mode: overview of all sections with completeness, or a single section form.
  const [editView, setEditView] = useState<'overview' | 'section'>('overview');
  const showOverview = !!initialData && editView === 'overview';
  const openSection = (target: number) => {
    setErrors({});
    setStep(target);
    if (initialData) setEditView('section');
  };
  const backToOverview = () => {
    setErrors({});
    setEditView('overview');
  };

  const sectionHasData = (current: number): boolean => {
    if (current === 3) return facilities.length > 0 || customFacilities.trim().length > 0;
    if (current === 4) return nearbyPlaces.length > 0 || nearbyOther.trim().length > 0;
    if (current === 6) return photoCount > 0;
    if (current === 7) return description.trim().length > 0;
    return true;
  };

  // Error keys that describe an invalid value rather than a missing field.
  const NON_FIELD_KEYS = ['nearbyPlaces', 'availableFrom', 'documents', 'customFacilities', 'ownerPick'];

  const editSections = (() => {
    if (!initialData) return [];
    const ov = cr.editOverview;
    const defs: Array<{ step: number; icon: 'buildings' | 'bed' | 'camera' | 'coins' | 'sparkle' | 'map-pin' | 'note' | 'user'; label: string; hint: string }> = [
      { step: 1, icon: 'buildings', label: cr.steps.property, hint: ov.sectionHints.property },
      { step: 2, icon: 'bed', label: cr.steps.layout, hint: ov.sectionHints.layout },
      { step: 6, icon: 'camera', label: cr.steps.photos, hint: ov.sectionHints.photos },
      { step: 5, icon: 'coins', label: cr.steps.pricing, hint: ov.sectionHints.pricing },
      { step: 3, icon: 'sparkle', label: cr.steps.facilities, hint: ov.sectionHints.facilities },
      { step: 4, icon: 'map-pin', label: cr.steps.nearby, hint: ov.sectionHints.nearby },
      { step: 7, icon: 'note', label: cr.detailsTitle, hint: ov.sectionHints.details },
      { step: 8, icon: 'user', label: cr.steps.ownerVisibility, hint: ov.sectionHints.contact },
    ];
    return defs.map((def) => {
      const missing = Object.keys(collectStepErrors(def.step));
      if (missing.length > 0) {
        const fieldKeys = missing.filter((key) => !NON_FIELD_KEYS.includes(key));
        const allFields = fieldKeys.length === missing.length;
        return {
          ...def,
          status: 'incomplete' as const,
          statusLabel: allFields ? interpolate(ov.missingFields, { count: missing.length }) : requiredMessage(missing[0]),
          detail: allFields ? interpolate(ov.missingList, { fields: fieldKeys.map(fieldLabel).join(', ') }) : requiredMessage(missing[0]),
        };
      }
      if (!sectionHasData(def.step)) {
        return { ...def, status: 'empty' as const, statusLabel: ov.notAdded, detail: ov.notAdded };
      }
      return { ...def, status: 'complete' as const, statusLabel: ov.complete, detail: ov.complete };
    });
  })();
  const incompleteSectionCount = editSections.filter((s) => s.status === 'incomplete').length;
  const currentSection = editSections.find((s) => s.step === step);

  useEffect(() => {
    if (!initialData || editView !== 'section') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (submitLock.current) return true;
      setErrors({});
      setEditView('overview');
      return true;
    });
    return () => sub.remove();
  }, [initialData, editView]);

  const goNext = () => {
    const invalid = validateStep(step);
    if (invalid) {
      setRequiredPrompt(requiredMessage(invalid));
      return;
    }
    setStep(visibleSteps[Math.min(visibleSteps.length - 1, stepIndex + 1)]);
  };

  const goBack = () => {
    if (step === 1) {
      setListingSourceCode(null);
      return;
    }
    setStep(visibleSteps[Math.max(0, stepIndex - 1)]);
  };

  const buildPayload = (uploadedPhotos: RoomPhoto[]): CreateRoomWizardSubmitData => {
    const medias = uploadedPhotos.map((photo, i) => ({
      mediaUrl: photo.mediaUrl!,
      category: 'room' as const,
      isCover: i === 0,
      sortOrder: i,
    }));

    const layout = [
      { code: 'bedroom', value: bedroom.trim() },
      { code: 'bathroom', value: bathroom.trim() },
    ];
    if (sizeSqm.trim()) layout.push({ code: 'room_size', value: sizeSqm.trim() });
    if (floor.trim()) layout.push({ code: 'floor', value: floor.trim() });
    if (building.trim()) layout.push({ code: 'building', value: building.trim() });

    const contactPayload = selectedOwnerId
      ? { contactId: selectedOwnerId, contact: undefined }
      : {
          contactId: undefined,
          contact: {
            name: ownerName.trim(),
            phone: ownerPhone.trim(),
            note: ownerOther.trim() || undefined,
          },
        };

    return {
      ...initialData,
      visibility: initialData?.visibility ?? 'private' as const,
      property: {
        name: propertyName.trim(),
        address: address.trim(),
        district: district.trim(),
        province: province.trim(),
        propertyTypeId: propertyTypeId as number,
        subdistrict: subdistrict.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
      },
      ...contactPayload,
      listingTitle: listingTitle.trim(),
      listingSourceCode: listingSourceCode as ListingSourceCode,
      roomTypeId: roomTypeId ?? undefined,
      roomId: roomId.trim() || undefined,
      waterRatePerUnit: waterRate.trim() && Number(waterRate) > 0 ? Number(waterRate) : undefined,
      electricRatePerUnit:
        electricRate.trim() && Number(electricRate) > 0 ? Number(electricRate) : undefined,
      prices: selectedContractTypeIds.map((id) => ({
        contractTypeId: id,
        price: Number(rentsByTypeId[String(id)]),
      })),
      advanceRentMonths,
      depositMonths,
      layout,
      listingDescription: description.trim(),
      availableFromDate: availableFrom || undefined,
      nearbyOther: nearbyOther.trim(),
      nearbyPlaces: latitude != null && longitude != null ? relocateNearby(nearbyPlaces, latitude, longitude) : nearbyPlaces,
      customFacilities: [...new Set(customFacilities.split('\n').map((v) => v.trim()).filter(Boolean))],
      facilities,
      medias,
      documents: documents.map((d, index) => ({ ...d, mediaUrl: d.mediaUrl.trim(), sortOrder: index })),
      isScoutRoom: true,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
    };
  };

  const handleSubmit = async () => {
    if (!listingSourceCode) return;
    let invalid: string | null = null;
    for (const current of visibleSteps) {
      invalid = validateStep(current);
      if (invalid) { setStep(current); if (initialData) setEditView('section'); break; }
    }
    if (invalid || submitLock.current) {
      if (invalid) setRequiredPrompt(requiredMessage(invalid));
      return;
    }
    if (onSubmitListing && (uploadPhoto || photos.every((photo) => photo.mediaUrl))) {
      submitLock.current = true;
      setSubmitting(true);
      onSubmittingChange?.(true);
      setUploadProgress(0);
      try {
        const uploadedPhotos: RoomPhoto[] = [];
        for (const photo of photos) {
          const mediaUrl = photo.mediaUrl ?? await uploadPhoto!(photo);
          uploadedPhotos.push({ ...photo, mediaUrl });
          setPhotos((current) => current.map((item) => item.uri === photo.uri ? { ...item, mediaUrl } : item));
          setUploadProgress(uploadedPhotos.length);
        }
        await onSubmitListing(buildPayload(uploadedPhotos));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        Alert.alert(cr.saveError, message);
      } finally {
        submitLock.current = false;
        setSubmitting(false);
        onSubmittingChange?.(false);
      }
      return;
    }
    Alert.alert(cr.saveError, cr.photoUnavailable);
  };

  const renderNav = (opts?: { isLast?: boolean }) => (
    <View style={styles.btnRow}>
      {initialData ? (
        <View style={{ flex: 1 }}>
          <MobileButton variant="outline" onPress={backToOverview} disabled={submitting}>
            {cr.editOverview.backToSections}
          </MobileButton>
        </View>
      ) : step > 1 || listingSourceCode ? (
        <View style={{ flex: 1 }}>
          <MobileButton variant="outline" onPress={goBack} disabled={submitting}>
            {cr.back}
          </MobileButton>
        </View>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <View style={{ flex: 1 }}>
        {opts?.isLast ? (
          <MobileButton onPress={handleSubmit} isLoading={submitting} disabled={submitting}>
            {submitLabel ?? cr.submit}
          </MobileButton>
        ) : (
          <MobileButton onPress={goNext} disabled={pickingPhotos}>{cr.next}</MobileButton>
        )}
      </View>
    </View>
  );

  const navOpts = initialData || stepIndex === visibleSteps.length - 1 ? { isLast: true as const } : undefined;
  const pickingSource = !listingSourceCode;
  const sourceLabels: Record<ListingSourceCode, string> = {
    co_agent: cr.sourceCoAgent,
    owner: cr.sourceOwner,
  };
  const sourceHints: Record<ListingSourceCode, string> = {
    co_agent: cr.sourceCoAgentHint,
    owner: cr.sourceOwnerHint,
  };

  return (
    <View style={styles.container}>
      <View style={styles.chrome}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title ?? cr.title}</Text>
          </View>
          {pickingSource || showOverview ? null : (
            <MobileBadge
              role={config.actorRole}
              label={initialData ? cr.editSections : interpolate(cr.stepOf, { step: stepIndex + 1, total: visibleSteps.length })}
            />
          )}
        </View>

        {pickingSource ? (
          <Text style={styles.subtitle}>{cr.sourcePrompt}</Text>
        ) : showOverview ? (
          <Text style={styles.subtitle}>{cr.editSections}</Text>
        ) : (
          <>
            {!initialData && <View style={[styles.progressTrack]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${((stepIndex + 1) / visibleSteps.length) * 100}%`,
                    backgroundColor: themeColor,
                  },
                ]}
              />
            </View>
            }
            <Text style={[styles.stepLabel, { color: themeColor }]}>{stepTitle}</Text>
            {!initialData && <Text style={styles.hint}>{cr.quickCreateHint}</Text>}
            {initialData && currentSection && (
              <View style={styles.sectionStatusRow}>
                <MobileIcon
                  name={currentSection.status === 'incomplete' ? 'warning' : 'check'}
                  size={16}
                  weight="fill"
                  color={currentSection.status === 'incomplete' ? tokens.colors.warning : currentSection.status === 'complete' ? tokens.colors.success : tokens.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.sectionStatusText,
                    { color: currentSection.status === 'incomplete' ? tokens.colors.warning : currentSection.status === 'complete' ? tokens.colors.success : tokens.colors.textSecondary },
                  ]}
                >
                  {currentSection.detail}
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {showOverview ? (
        <Animated.View key="overview" entering={FadeIn.duration(150)} style={styles.formScroll}>
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <RoomEditSectionList
              sections={editSections}
              themeColor={themeColor}
              disabled={submitting}
              summaryTone={incompleteSectionCount > 0 ? 'warning' : 'success'}
              summaryLabel={incompleteSectionCount > 0
                ? interpolate(cr.editOverview.needsAttention, { count: incompleteSectionCount })
                : cr.editOverview.allComplete}
              onSelect={openSection}
            />
          </ScrollView>
        </Animated.View>
      ) : pickingSource ? (
        <View style={styles.sourceScreen}>
          <View style={styles.sourceRow}>
            {LISTING_SOURCE_OPTIONS.map((opt) => {
              const color = tokens.colors.roles[opt.role];
              return (
                <Pressable
                  key={opt.code}
                  onPress={() => {
                    setListingSourceCode(opt.code);
                    setStep(1);
                  }}
                  android_ripple={{ color: '#00000022' }}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.sourceCard,
                    nativeElevation(1),
                    { borderColor: color },
                    pressed ? { opacity: 0.88 } : null,
                  ]}
                >
                  <View style={[styles.sourceIconWrap, { backgroundColor: color }]}>
                    <MobileIcon name={opt.icon} size={28} color="#FFFFFF" />
                  </View>
                  <Text style={styles.sourceTitle}>{sourceLabels[opt.code]}</Text>
                  <Text style={styles.sourceHint}>{sourceHints[opt.code]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <Animated.View
          key={initialData ? `section-${step}` : 'form'}
          entering={initialData ? FadeIn.duration(150) : undefined}
          style={styles.formPane}
        >
      <ScrollView
        ref={formScrollRef}
        style={styles.formScroll}
        contentContainerStyle={styles.formScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, nativeElevation(1)]}>
          <View style={styles.cardBody}>
          {step === 1 && (
            <>
              <View>
                <Text style={styles.fieldLabel}>
                  {cr.propertyType}
                  <Text style={styles.requiredMark}> *</Text>
                </Text>
              </View>
              {propertyTypesLoading ? (
                <View style={styles.suggestStatus}>
                  <ActivityIndicator size="small" color={themeColor} />
                  <Text style={styles.suggestStatusText}>{t.common.loading}</Text>
                </View>
              ) : null}
              {propertyTypesError ? (
                <Text style={styles.errorText}>{propertyTypesError}</Text>
              ) : null}
              <View style={styles.propertyTypeRow}>
                {propertyTypes.map((opt) => {
                  const selected = propertyTypeId === opt.id;
                  const labels = t.masters.propertyTypes as Record<string, string>;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => {
                        setPropertyTypeId(opt.id);
                        clearFieldError('propertyType');
                      }}
                      android_ripple={{ color: '#00000022' }}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={({ pressed }) => [
                        styles.propertyTypeChip,
                        selected
                          ? { backgroundColor: themeColor, borderColor: themeColor }
                          : errors.propertyType
                            ? { borderColor: tokens.colors.error }
                            : null,
                        pressed ? { opacity: 0.88 } : null,
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.propertyTypeChipText,
                          selected ? styles.typeChipTextSelected : null,
                        ]}
                      >
                        {labels[opt.code] ?? opt.code}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {errors.propertyType ? (
                <Text style={styles.errorText}>{errors.propertyType}</Text>
              ) : null}
              <MobileInput
                label={cr.propertyName}
                placeholder={cr.propertyNamePlaceholder}
                value={propertyName}
                autoCorrect={false}
                autoCapitalize="words"
                required
                onChangeText={(v) => {
                  setPropertyName(v);
                  clearFieldError('propertyName');
                }}
                error={errors.propertyName}
                helperText={searchPlaces ? cr.placesHint : undefined}
              />
              {searchPlaces &&
              (placesLoading ||
                placesError ||
                suggestions.length > 0 ||
                hasSearchedPlaces) ? (
                <View style={styles.suggestBox}>
                  {placesLoading ? (
                    <View style={styles.suggestStatus}>
                      <ActivityIndicator size="small" color={themeColor} />
                      <Text style={styles.suggestStatusText}>{cr.placesSearching}</Text>
                    </View>
                  ) : null}
                  {placesError ? (
                    <Text style={[styles.errorText, styles.suggestPad]}>{placesError}</Text>
                  ) : null}
                  {!placesLoading &&
                  hasSearchedPlaces &&
                  suggestions.length === 0 &&
                  !placesError ? (
                    <Text style={[styles.suggestStatusText, styles.suggestPad]}>
                      {cr.placesEmpty}
                    </Text>
                  ) : null}
                  {suggestions.map((item, index) => (
                    <Pressable
                      key={item.placeId}
                      onPress={() => handleSelectPlace(item)}
                      android_ripple={{ color: '#00000014' }}
                      style={[
                        styles.suggestRow,
                        index === 0 && !placesLoading && !placesError
                          ? { borderTopWidth: 0 }
                          : null,
                      ]}
                    >
                      <Text style={styles.suggestName}>{item.name}</Text>
                      {item.address ? (
                        <Text style={styles.suggestAddress}>{item.address}</Text>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <Text style={styles.fieldLabel}>{cr.mapLabel}</Text>
              <PropertyPlaceMap
                key={`${latitude ?? DEFAULT_MAP.latitude},${longitude ?? DEFAULT_MAP.longitude}`}
                latitude={latitude ?? DEFAULT_MAP.latitude}
                longitude={longitude ?? DEFAULT_MAP.longitude}
              />
              <MobileInput
                label={cr.address}
                placeholder={cr.addressPlaceholder}
                value={address}
                required
                onChangeText={(v) => {
                  setAddress(v);
                  clearFieldError('address');
                }}
                error={errors.address}
              />
              <MobileInput
                label={cr.subdistrict}
                value={subdistrict}
                editable={false}
              />
              <MobileInput
                label={cr.district}
                value={district}
                editable={false}
                required
                error={errors.district}
              />
              <MobileInput
                label={cr.province}
                value={province}
                editable={false}
                required
                error={errors.province}
              />
            </>
          )}

          {step === 2 && (
            <>
              <MobileInput
                label={cr.listingTitle}
                placeholder={cr.listingTitlePlaceholder}
                value={listingTitle}
                required
                onChangeText={(v) => {
                  setListingTitle(v);
                  clearFieldError('listingTitle');
                }}
                error={errors.listingTitle}
              />
              {listRoomTypes ? (
                <>
              <View>
                <Text style={styles.fieldLabel}>
                  {cr.roomType}
                  <Text style={styles.requiredMark}> *</Text>
                </Text>
              </View>
              {roomTypesLoading ? (
                <View style={styles.suggestStatus}>
                  <ActivityIndicator size="small" color={themeColor} />
                  <Text style={styles.suggestStatusText}>{t.common.loading}</Text>
                </View>
              ) : null}
              {roomTypesError ? (
                <Text style={styles.errorText}>{roomTypesError}</Text>
              ) : null}
              <View style={styles.roomTypeRow}>
                {roomTypes.map((opt) => {
                  const selected = roomTypeId === opt.id;
                  const labels = t.masters.roomTypes as Record<string, string>;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => {
                        setRoomTypeId(opt.id);
                        clearFieldError('roomType');
                        if (opt.bedroomCount != null) {
                          setBedroom(String(opt.bedroomCount));
                          clearFieldError('bedroom');
                        }
                      }}
                      android_ripple={{ color: '#00000022' }}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={({ pressed }) => [
                        styles.roomTypeChip,
                        selected
                          ? { backgroundColor: themeColor, borderColor: themeColor }
                          : errors.roomType
                            ? { borderColor: tokens.colors.error }
                            : null,
                        pressed ? { opacity: 0.88 } : null,
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.roomTypeChipText,
                          selected ? styles.typeChipTextSelected : null,
                        ]}
                      >
                        {labels[opt.code] ?? opt.code}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {errors.roomType ? (
                <Text style={styles.errorText}>{errors.roomType}</Text>
              ) : null}
                </>
              ) : null}
              <View style={styles.fieldGrid}>
                <View style={styles.fieldGridItem}>
                  <MobileInput
                    label={cr.bedroom}
                    keyboardType="numeric"
                    value={bedroom}
                    required
                    onChangeText={(v) => {
                      setBedroom(digitsOnly(v));
                      clearFieldError('bedroom');
                    }}
                    error={errors.bedroom}
                  />
                </View>
                <View style={styles.fieldGridItem}>
                  <MobileInput
                    label={cr.bathroom}
                    keyboardType="numeric"
                    value={bathroom}
                    required
                    onChangeText={(v) => {
                      setBathroom(digitsOnly(v));
                      clearFieldError('bathroom');
                    }}
                    error={errors.bathroom}
                  />
                </View>
              </View>
              {initialData && <>
              <View style={styles.fieldGrid}>
                <View style={styles.fieldGridItem}>
                  <MobileInput
                    label={cr.waterRate}
                    keyboardType="numeric"
                    value={waterRate}
                    onChangeText={setWaterRate}
                  />
                </View>
                <View style={styles.fieldGridItem}>
                  <MobileInput
                    label={cr.electricRate}
                    keyboardType="numeric"
                    value={electricRate}
                    onChangeText={setElectricRate}
                  />
                </View>
              </View>
              <View style={styles.fieldGrid}>
                <View style={styles.fieldGridItem}>
                  <MobileInput
                    label={cr.roomId}
                    placeholder={cr.roomIdPlaceholder}
                    value={roomId}
                    onChangeText={setRoomId}
                  />
                </View>
                <View style={styles.fieldGridItem}>
                  <MobileInput
                    label={cr.floor}
                    placeholder={cr.floorPlaceholder}
                    keyboardType="numeric"
                    value={floor}
                    onChangeText={setFloor}
                  />
                </View>
              </View>
              <View style={styles.fieldGrid}>
                <View style={styles.fieldGridItem}>
                  <MobileInput
                    label={cr.building}
                    placeholder={cr.buildingPlaceholder}
                    autoCapitalize="characters"
                    value={building}
                    onChangeText={setBuilding}
                  />
                </View>
                <View style={styles.fieldGridItem}>
                  <MobileInput
                    label={cr.sizeSqm}
                    keyboardType="numeric"
                    placeholder="28"
                    value={sizeSqm}
                    onChangeText={(v) => {
                      setSizeSqm(v);
                      clearFieldError('sizeSqm');
                    }}
                    error={errors.sizeSqm}
                  />
                </View>
              </View>
              </>}
            </>
          )}

          {step === 5 && (
            <>
              <View>
                <Text style={styles.fieldLabel}>
                  {cr.contractTerm}
                  <Text style={styles.requiredMark}> *</Text>
                </Text>
                <Text style={styles.hint}>{cr.contractTermHint}</Text>
              </View>
              {contractTypesLoading ? (
                <View style={styles.suggestStatus}>
                  <ActivityIndicator size="small" color={themeColor} />
                  <Text style={styles.suggestStatusText}>{t.common.loading}</Text>
                </View>
              ) : null}
              {contractTypesError ? (
                <Text style={styles.errorText}>{contractTypesError}</Text>
              ) : null}
              <View style={styles.termRow}>
                {contractTypes.map((opt) => {
                  const selected = selectedContractTypeIds.includes(opt.id);
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => toggleContract(opt.id)}
                      android_ripple={{ color: '#00000022' }}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={({ pressed }) => [
                        styles.termChip,
                        selected
                          ? { backgroundColor: themeColor, borderColor: themeColor }
                          : null,
                        pressed ? { opacity: 0.88 } : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.termChipText,
                          selected ? styles.termChipTextSelected : null,
                        ]}
                      >
                        {interpolate(cr.contractMonths, { months: opt.termMonths })}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {errors.contractTerm ? (
                <Text style={styles.errorText}>{errors.contractTerm}</Text>
              ) : null}
              {contractTypes
                .filter((opt) => selectedContractTypeIds.includes(opt.id))
                .map((opt) => (
                  <MobileInput
                    key={opt.id}
                    label={interpolate(cr.monthlyRentForTerm, { months: opt.termMonths })}
                    placeholder="12000"
                    keyboardType="numeric"
                    value={rentsByTypeId[String(opt.id)] ?? ''}
                    required
                    onChangeText={(v) => {
                      setRentsByTypeId((prev) => ({ ...prev, [String(opt.id)]: v }));
                      clearFieldError(`rent_${opt.id}`);
                    }}
                    error={errors[`rent_${opt.id}`]}
                  />
                ))}
              <View>
                <Text style={styles.fieldLabel}>
                  {cr.advanceRent}
                  <Text style={styles.requiredMark}> *</Text>
                </Text>
                <Text style={styles.hint}>{cr.advanceRentHint}</Text>
              </View>
              {renderMonthChips(ADVANCE_MONTH_OPTIONS, advanceRentMonths, setAdvanceRentMonths)}
              <View>
                <Text style={styles.fieldLabel}>
                  {cr.deposit}
                  <Text style={styles.requiredMark}> *</Text>
                </Text>
                <Text style={styles.hint}>{cr.depositHint}</Text>
              </View>
              {renderMonthChips(DEPOSIT_MONTH_OPTIONS, depositMonths, setDepositMonths)}
              {contractTypes.some(
                (opt) =>
                  selectedContractTypeIds.includes(opt.id) &&
                  Number(rentsByTypeId[String(opt.id)]) > 0,
              ) ? (
                <View style={styles.moveInBox}>
                  <Text style={styles.moveInLabel}>{cr.moveInSummaryLabel}</Text>
                  {contractTypes
                    .filter(
                      (opt) =>
                        selectedContractTypeIds.includes(opt.id) &&
                        Number(rentsByTypeId[String(opt.id)]) > 0,
                    )
                    .map((opt) => (
                      <Text
                        key={opt.id}
                        style={[styles.moveInValue, { color: themeColor }]}
                      >
                        {interpolate(cr.moveInTermLine, {
                          term: opt.termMonths,
                          amount: formatBaht(
                            Number(rentsByTypeId[String(opt.id)]) *
                              (advanceRentMonths + depositMonths),
                          ),
                        })}
                      </Text>
                    ))}
                </View>
              ) : null}
            </>
          )}

          {step === 6 && (
            <>
              <Text style={styles.fieldLabel}>
                {cr.steps.photos}
                {initialData?.visibility === 'published' && <Text style={styles.requiredMark}> *</Text>}
              </Text>
              <Text style={styles.hint}>{initialData?.visibility === 'published' ? cr.photosHint : cr.optionalPhotosHint}</Text>
              <Text style={[styles.photoCount, { color: themeColor }]}>
                {interpolate(cr.photosCount, { count: photoCount })}
              </Text>
              {errors.photos ? (
                <Text style={styles.errorText}>{errors.photos}</Text>
              ) : null}
              <View style={styles.photoGrid}>
                {photos.map((photo, i) => (
                  <View key={photo.uri} style={{ width: 100, gap: 4 }}>
                    <Pressable disabled={submitting} accessibilityLabel={cr.setCover} onPress={() => setPhotos((current) => [photo, ...current.filter((item) => item.uri !== photo.uri)])}>
                      <Image source={{ uri: photo.uri, cache: 'reload' }} style={{ width: 100, height: 100, borderRadius: 8 }} />
                      <Text style={styles.hint}>{i === 0 ? cr.coverPhoto : cr.setCover}</Text>
                    </Pressable>
                    <MobileButton variant="outline" disabled={submitting} onPress={() => setPhotos((current) => current.filter((item) => item.uri !== photo.uri))}>{cr.removePhoto}</MobileButton>
                  </View>
                ))}
              </View>
              <MobileButton
                variant="outline"
                disabled={submitting || pickingPhotos || photoCount >= 12 || !pickPhotos}
                isLoading={pickingPhotos}
                onPress={async () => {
                  if (!pickPhotos || pickingPhotos) return;
                  setPickingPhotos(true);
                  try {
                    const selected = await pickPhotos(12 - photoCount);
                    setPhotos((current) => [...current, ...selected.filter((photo, index) => !current.some((item) => item.uri === photo.uri) && selected.findIndex((item) => item.uri === photo.uri) === index)].slice(0, 12));
                    clearFieldError('photos');
                  } catch (err) {
                    Alert.alert(cr.saveError, err instanceof Error ? err.message : String(err));
                  } finally {
                    setPickingPhotos(false);
                  }
                }}
              >
                {cr.addPhoto}
              </MobileButton>
            </>
          )}

          {submitting && <Text accessibilityLiveRegion="polite" style={styles.hint}>{interpolate(cr.uploadProgress, { count: uploadProgress, total: photoCount })}</Text>}

          {step === 3 && <>
            <RoomFacilitiesEditor options={facilityOptions} selected={facilities} onChange={setFacilities} custom={customFacilities} onCustomChange={setCustomFacilities} loading={facilitiesLoading} error={facilityError} onRetry={loadFacilities} color={themeColor} />
            {!!errors.customFacilities && <Text style={styles.errorText}>{errors.customFacilities}</Text>}
          </>}
          {step === 4 && <>
            <RoomNearbyEditor latitude={latitude} longitude={longitude} value={nearbyPlaces} onChange={(value) => { setNearbyPlaces(value); clearFieldError('nearbyPlaces'); }} search={searchNearby} apiKey={mapsApiKey} color={themeColor} error={errors.nearbyPlaces} />
            <MobileInput label={cr.nearbyNotes} placeholder={cr.nearbyPlaceholder} value={nearbyOther} onChangeText={setNearbyOther} multiline maxLength={500} style={{ height: 100, textAlignVertical: 'top' }} />
          </>}
          {step === 7 && <>
            <Text style={styles.hint}>{cr.detailsHint}</Text>
            <MobileInput label={cr.listingDescription} value={description} onChangeText={setDescription} multiline maxLength={10000} style={{ height: 150, textAlignVertical: 'top' }} />
            <MobileInput label={cr.availableFrom} placeholder="YYYY-MM-DD" value={availableFrom} onChangeText={setAvailableFrom} maxLength={10} error={errors.availableFrom} />
            <Text style={styles.fieldLabel}>{cr.steps.documents}</Text>
            <Text style={styles.hint}>{cr.documentLinksHint}</Text>
            {documents.map((document, index) => <View key={index} style={styles.ownerCard}>
              <View style={styles.typeRow}>{(['id_passport', 'bookbank', 'ownership', 'other'] as const).map((kind) => <Pressable key={kind} accessibilityRole="radio" accessibilityState={{ checked: document.kind === kind }} onPress={() => setDocuments((current) => current.map((d, i) => i === index ? { ...d, kind } : d))} style={[styles.typeChip, document.kind === kind && { backgroundColor: themeColor, borderColor: themeColor }]}><Text style={[styles.typeChipText, document.kind === kind && styles.typeChipTextSelected]}>{cr.documentKinds[kind]}</Text></Pressable>)}</View>
              <MobileInput label={cr.documentUrl} placeholder="https://" autoCapitalize="none" value={document.mediaUrl} maxLength={500} onChangeText={(mediaUrl) => setDocuments((current) => current.map((d, i) => i === index ? { ...d, mediaUrl } : d))} />
              <MobileButton variant="outline" onPress={() => setDocuments((current) => current.filter((_, i) => i !== index))}>{cr.removeDocument}</MobileButton>
            </View>)}
            {!!errors.documents && <Text style={styles.errorText}>{errors.documents}</Text>}
            <MobileButton variant="outline" disabled={documents.length >= 20} onPress={() => setDocuments((current) => [...current, { kind: 'other', mediaUrl: '', sortOrder: current.length }])}>{cr.addDocumentLink}</MobileButton>
          </>}
          {step === 8 && (
            <>
              {ownerMode === 'pick' && listContacts ? (
                <>
                  {selectedOwner ? (
                    <View style={[styles.ownerCard, nativeElevation(1)]}>
                      <Text style={styles.ownerCardName}>{selectedOwner.name}</Text>
                      <Text style={styles.ownerCardPhone}>{selectedOwner.phone}</Text>
                      <Text style={styles.ownerCardMeta}>
                        {interpolate(cr.ownerRoomsCount, {
                          count: selectedOwner.roomCount ?? 0,
                        })}
                      </Text>
                      {selectedOwner.note ? (
                        <Text style={styles.ownerCardNote}>{selectedOwner.note}</Text>
                      ) : null}
                      <View style={styles.btnRow}>
                        <View style={{ flex: 1 }}>
                          <MobileButton
                            variant="outline"
                            onPress={() => {
                              setSelectedOwnerId(null);
                              setOwnerQuery('');
                            }}
                          >
                            {cr.ownerChange}
                          </MobileButton>
                        </View>
                        <View style={{ flex: 1 }}>
                          <MobileButton
                            variant="outline"
                            onPress={() => {
                              setSelectedOwnerId(null);
                              setOwnerName('');
                              setOwnerPhone('');
                              setOwnerOther('');
                              setOwnerMode('create');
                            }}
                          >
                            {cr.ownerAddNew}
                          </MobileButton>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <>
                      <MobileInput
                        label={cr.ownerSearch}
                        placeholder={cr.ownerSearchPlaceholder}
                        value={ownerQuery}
                        required
                        onChangeText={(v) => {
                          setOwnerQuery(v);
                          clearFieldError('ownerPick');
                        }}
                        error={errors.ownerPick}
                      />
                      {ownersLoading ? (
                        <View style={styles.suggestStatus}>
                          <ActivityIndicator size="small" color={themeColor} />
                          <Text style={styles.suggestStatusText}>{t.common.loading}</Text>
                        </View>
                      ) : null}
                      {ownersError ? (
                        <Text style={styles.errorText}>{ownersError}</Text>
                      ) : null}
                      {!ownersLoading && !ownersError && filteredOwners.length === 0 ? (
                        <Text style={styles.hint}>{cr.ownerEmpty}</Text>
                      ) : null}
                      {filteredOwners.length > 0 ? (
                        <View style={styles.suggestBox}>
                          {filteredOwners.map((item, index) => (
                            <Pressable
                              key={item.id}
                              onPress={() => handleSelectOwner(item)}
                              android_ripple={{ color: '#00000014' }}
                              style={[
                                styles.suggestRow,
                                index === 0 ? { borderTopWidth: 0 } : null,
                              ]}
                            >
                              <Text style={styles.suggestName}>{item.name}</Text>
                              <Text style={styles.suggestAddress}>{item.phone}</Text>
                              <Text style={styles.suggestAddress}>
                                {interpolate(cr.ownerRoomsCount, {
                                  count: item.roomCount ?? 0,
                                })}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                      <MobileButton
                        variant="outline"
                        onPress={() => {
                          setSelectedOwnerId(null);
                          setOwnerName('');
                          setOwnerPhone('');
                          setOwnerOther('');
                          setOwnerMode('create');
                        }}
                      >
                        {cr.ownerAddNew}
                      </MobileButton>
                    </>
                  )}
                </>
              ) : (
                <>
                  {listContacts ? (
                    <MobileButton
                      variant="outline"
                      onPress={() => {
                        setOwnerMode('pick');
                        setSelectedOwnerId(null);
                      }}
                    >
                      {cr.ownerPickExisting}
                    </MobileButton>
                  ) : null}
                  <MobileInput
                    label={cr.ownerName}
                    placeholder="Somchai Jaidee"
                    value={ownerName}
                    required
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
                    required
                    onChangeText={(v) => {
                      setOwnerPhone(v);
                      clearFieldError('ownerPhone');
                    }}
                    error={errors.ownerPhone}
                  />
                  {matchedOwnerByPhone ? (
                    <View style={styles.ownerMatchBox}>
                      <Text style={styles.ownerCardName}>{cr.ownerFoundExisting}</Text>
                      <Text style={styles.ownerCardPhone}>
                        {matchedOwnerByPhone.name} · {matchedOwnerByPhone.phone}
                      </Text>
                      <MobileButton
                        variant="outline"
                        onPress={() => handleSelectOwner(matchedOwnerByPhone)}
                      >
                        {cr.ownerUseThis}
                      </MobileButton>
                    </View>
                  ) : null}
                  {initialData && (
                  <MobileInput
                    label={cr.ownerOther}
                    placeholder={cr.ownerOtherPlaceholder}
                    value={ownerOther}
                    multiline
                    maxLength={OWNER_NOTE_MAX}
                    onChangeText={(v) => setOwnerOther(v.slice(0, OWNER_NOTE_MAX))}
                    helperText={interpolate(cr.ownerOtherCount, { count: ownerOther.length })}
                    style={{ height: 96, textAlignVertical: 'top', paddingTop: 10 }}
                  />
                  )}
                </>
              )}
            </>
          )}
          </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>{renderNav(navOpts)}</View>
        </Animated.View>
      )}

      <Modal
        visible={!!requiredPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setRequiredPrompt(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setRequiredPrompt(null)}
          />
          <View style={[styles.modalCard, nativeElevation(2)]}>
            <Text style={styles.modalTitle}>{cr.required}</Text>
            <Text style={styles.modalBody}>{requiredPrompt}</Text>
            <MobileButton onPress={() => setRequiredPrompt(null)}>
              {cr.requiredOk}
            </MobileButton>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    gap: 12,
  },
  chrome: {
    gap: 12,
  },
  formPane: {
    flex: 1,
    minHeight: 0,
    gap: 12,
  },
  formScroll: {
    flex: 1,
    minHeight: 0,
  },
  formScrollContent: {
    paddingBottom: 8,
  },
  sectionStatusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  sectionStatusText: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  footer: {
    paddingTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '500',
    color: tokens.colors.textHeading,
  },
  modalBody: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.textSecondary,
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
  },
  cardBody: {
    gap: 14,
  },
  sourceScreen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingBottom: 24,
  },
  sourceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sourceCard: {
    flex: 1,
    minHeight: 180,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    paddingHorizontal: 12,
    gap: 10,
  },
  sourceIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '500',
    color: tokens.colors.textHeading,
    textAlign: 'center',
  },
  sourceHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
  },
  fieldGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldGridItem: {
    flex: 1,
    minWidth: 0,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  typeChip: {
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  typeChipText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  typeChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  roomTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roomTypeChip: {
    flexGrow: 1,
    flexBasis: '46%',
    flexShrink: 0,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  roomTypeChipText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  propertyTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  propertyTypeChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  propertyTypeChipText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  termRow: {
    flexDirection: 'row',
    gap: 10,
  },
  termChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  termChipText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  termChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  moveInBox: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    backgroundColor: tokens.colors.background,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  moveInLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  moveInValue: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
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
  requiredMark: {
    color: tokens.colors.error,
    fontWeight: '700',
  },
  suggestBox: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  suggestStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestStatusText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  suggestPad: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.border,
  },
  suggestName: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  suggestAddress: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
    marginTop: 2,
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
  ownerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 14,
    gap: 8,
  },
  ownerCardName: {
    fontFamily: tokens.typography.native.body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: tokens.colors.textHeading,
  },
  ownerCardPhone: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.primary,
  },
  ownerCardMeta: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  ownerCardNote: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  ownerMatchBox: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    padding: 12,
    gap: 8,
    backgroundColor: tokens.colors.background,
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
  },
});
