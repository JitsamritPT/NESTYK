import type { FacilityOption, NearbyPlace } from '@nestyk/types';
import { RoomFacilitiesEditor } from './RoomFacilitiesEditor';
import { RoomNearbyEditor, type NearbySearch } from './RoomNearbyEditor';
import { RoomEditSectionList } from './RoomEditSectionList';
import { RoomPhotoCompareModal } from './RoomPhotoCompareModal';
import { WizardSheetChrome } from './WizardSheetChrome';
import { WizardSheetFooter } from './WizardSheetFooter';
import { ContactListRow } from './ContactListRow';
import { SelectedContactCard } from './SelectedContactCard';
import { relocateNearby, isCustomPlace } from '../nearby';
import Animated, { FadeIn } from 'react-native-reanimated';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  TextInput,
  type LayoutChangeEvent,
} from 'react-native';
import { useLocale } from '@nestyk/i18n';
import {
  MobileButton,
  MobileInput,
  MobileIcon,
  MobileBottomSheet,
  MobileActionSheetBody,
  MobilePhotoViewer,
  SelectionChip,
  SelectionCheck,
  tokens,
  getCardElevation,
} from '@nestyk/ui/native';
import { ListingEngineConfig } from '../config';
import { PlaceDetails, PlaceSuggestion } from '../places';
import { PropertyPlaceMap } from './PropertyPlaceMap';

const CREATE_STEPS = [1, 2, 5, 8, 6];
const EDIT_STEPS = [1, 2, 5, 8, 6, 3, 4, 7];
/** Required before save on create hub (photos optional). */
const CREATE_REQUIRED_STEPS = [1, 2, 5, 8];
const OWNER_NOTE_MAX = 200;
const DEFAULT_MAP = { latitude: 13.7563, longitude: 100.5018 };
const ADVANCE_MONTH_OPTIONS = [0, 1, 2] as const;
const DEPOSIT_MONTH_OPTIONS = [1, 2, 3] as const;
const PHOTO_GRID_GAP = 10;
/** Suggested only when opening Add lease the first time — not pre-committed on create. */
const SUGGESTED_ADVANCE_MONTHS = 1;
const SUGGESTED_DEPOSIT_MONTHS = 2;
const MAX_ROOM_CONTACTS = 2;

type RoomContactSelection = {
  key: string;
  id?: number;
  name: string;
  phone: string;
  roomCount?: number;
};

function roomContactKey(id?: number, phone?: string) {
  if (id != null) return `id:${id}`;
  return `new:${String(phone ?? '').replace(/\D/g, '')}`;
}
const LISTING_SOURCE_OPTIONS = [
  {
    code: 'owner' as const,
    icon: 'user' as const,
    iconColor: '#926515',
    iconBg: '#FFF3D6',
  },
  {
    code: 'co_agent' as const,
    icon: 'handshake' as const,
    iconColor: '#52647A',
    iconBg: '#EEF2F6',
  },
];
const SOURCE_SELECT_BORDER = tokens.colors.brand[500];
const SOURCE_IDLE_BORDER = tokens.colors.border;

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
  /** Up to 2 existing contact ids (first = primary). */
  contactIds?: number[];
  contact?: {
    name: string;
    phone: string;
    note?: string;
  };
  /** New contacts without id (created on save). Combined with contactIds ≤ 2. */
  contacts?: Array<{
    name: string;
    phone: string;
    note?: string;
  }>;
  /** Prefill for edit UI (id optional for unsaved drafts). */
  selectedContacts?: Array<{
    id?: number;
    name: string;
    phone: string;
    roomCount?: number;
  }>;
  listingTitle: string;
  listingSourceCode: ListingSourceCode;
  roomTypeId?: number;
  roomId?: string;
  waterRatePerUnit?: number;
  electricRatePerUnit?: number;
  prices: Array<{ contractTypeId: number; price: number; advanceRentMonths?: number; depositMonths?: number }>;
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

export type RoomPhoto = {
  uri: string;
  name: string;
  mimeType: string;
  file?: Blob;
  mediaUrl?: string;
  /** Local or remote URI before AI enhance (for before/after). */
  originalUri?: string;
};

export interface MobileCreateListingWizardBodyProps {
  initialData?: CreateRoomWizardSubmitData;
  title?: string;
  submitLabel?: string;
  onSubmittingChange?: (busy: boolean) => void;
  /**
   * Parent (shell back / Android back) should call this first.
   * Returns true when the wizard consumed the back (section → hub → source).
   */
  backHandlerRef?: React.MutableRefObject<(() => boolean) | null>;
  /**
   * Sync shell header title: section names on drill-in, "Add room" on hub/source.
   */
  onHeaderTitleChange?: (title: string) => void;
  pickPhotos?: (limit: number) => Promise<RoomPhoto[]>;
  uploadPhoto?: (photo: RoomPhoto) => Promise<string>;
  enhancePhoto?: (photo: RoomPhoto) => Promise<RoomPhoto>;
  config: ListingEngineConfig;
  onSubmitListing?: (data: CreateRoomWizardSubmitData) => void | Promise<void>;
  searchPlaces?: (query: string) => Promise<PlaceSuggestion[]>;
  getPlaceDetails?: (placeId: string) => Promise<PlaceDetails>;
  reverseGeocode?: (latitude: number, longitude: number) => Promise<PlaceDetails>;
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
  if (months === 1 && monthsTemplate === '{months} months') return '1 month';
  return interpolate(monthsTemplate, { months });
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function isFilledCount(value: string) {
  return /^\d+$/.test(value.trim());
}

/** Dev mock — replace with API quota when backend is ready. */
const MOCK_AI_ENHANCE_LIMIT = 10;

export const MobileCreateListingWizardBody: React.FC<
  MobileCreateListingWizardBodyProps
> = ({
  config,
  initialData,
  title,
  submitLabel,
  onSubmittingChange,
  backHandlerRef,
  onHeaderTitleChange,
  pickPhotos,
  uploadPhoto,
  enhancePhoto,
  onSubmitListing,
  searchPlaces,
  getPlaceDetails,
  reverseGeocode,
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
  const accent = tokens.colors.brand[500];
  const accentInk = tokens.colors.primary;

  const [step, setStep] = useState(1);
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
  const [province, setProvince] = useState('');
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
  const [pinResolving, setPinResolving] = useState(false);
  const [placeEntryMode, setPlaceEntryMode] = useState<'search' | 'manual'>('search');
  const [addressFromPlace, setAddressFromPlace] = useState(false);
  const skipPlacesSearch = useRef(false);
  const placesSeq = useRef(0);
  const searchPlacesRef = useRef(searchPlaces);
  const getPlaceDetailsRef = useRef(getPlaceDetails);
  const reverseGeocodeRef = useRef(reverseGeocode);
  const pinResolveSeq = useRef(0);
  const listContactsRef = useRef(listContacts);
  const listPropertyTypesRef = useRef(listPropertyTypes);
  const listContractTypesRef = useRef(listContractTypes);
  const listRoomTypesRef = useRef(listRoomTypes);
  const formScrollRef = useRef<ScrollView>(null);
  searchPlacesRef.current = searchPlaces;
  getPlaceDetailsRef.current = getPlaceDetails;
  reverseGeocodeRef.current = reverseGeocode;
  listContactsRef.current = listContacts;
  listPropertyTypesRef.current = listPropertyTypes;
  listContractTypesRef.current = listContractTypes;
  listRoomTypesRef.current = listRoomTypes;
  const [listingTitle, setListingTitle] = useState('');
  const [listingSourceCode, setListingSourceCode] = useState<ListingSourceCode | null>(
    initialData?.listingSourceCode ?? null,
  );
  const [sourceDraft, setSourceDraft] = useState<ListingSourceCode | null>(
    initialData?.listingSourceCode ?? null,
  );
  const [roomId, setRoomId] = useState('');
  const [floor, setFloor] = useState('');
  const [building, setBuilding] = useState('');
  const [roomTypeId, setRoomTypeId] = useState<number | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [roomTypesLoading, setRoomTypesLoading] = useState(false);
  const [roomTypesError, setRoomTypesError] = useState('');
  const [layoutSheet, setLayoutSheet] = useState<'roomType' | 'bedroom' | 'bathroom' | null>(
    null,
  );

  const [bedroom, setBedroom] = useState('');
  const [bathroom, setBathroom] = useState('1');
  const [sizeSqm, setSizeSqm] = useState('');

  const [rentsByTypeId, setRentsByTypeId] = useState<Record<string, string>>({});
  const [selectedContractTypeIds, setSelectedContractTypeIds] = useState<number[]>([]);
  const [contractTypes, setContractTypes] = useState<ContractTypeOption[]>([]);
  const [contractTypesLoading, setContractTypesLoading] = useState(false);
  const [contractTypesError, setContractTypesError] = useState('');
  const [advanceRentMonths, setAdvanceRentMonths] = useState<number | null>(null);
  const [depositMonths, setDepositMonths] = useState<number | null>(null);
  const [termsByTypeId, setTermsByTypeId] = useState<Record<string, { advanceRentMonths: number; depositMonths: number }>>({});
  const leaseTerms = (id: number) => termsByTypeId[String(id)] ?? {
    advanceRentMonths: advanceRentMonths ?? SUGGESTED_ADVANCE_MONTHS,
    depositMonths: depositMonths ?? SUGGESTED_DEPOSIT_MONTHS,
  };
  const [leaseSheet, setLeaseSheet] = useState<
    null | { mode: 'add' } | { mode: 'edit'; contractTypeId: number }
  >(null);
  const [draftTermId, setDraftTermId] = useState<number | null>(null);
  const [draftRent, setDraftRent] = useState('');
  const [draftAdvance, setDraftAdvance] = useState(SUGGESTED_ADVANCE_MONTHS);
  const [draftDeposit, setDraftDeposit] = useState(SUGGESTED_DEPOSIT_MONTHS);
  const [leaseSheetError, setLeaseSheetError] = useState('');
  /** Room contact: pick list or create form as bottom sheets. */
  const [contactSheet, setContactSheet] = useState<null | 'pick' | 'create'>(null);
  const [draftContactId, setDraftContactId] = useState<number | null>(null);
  const [contactSheetError, setContactSheetError] = useState('');
  /** Draft fields for New contact sheet only — committed on Use this contact. */
  const [draftOwnerName, setDraftOwnerName] = useState('');
  const [draftOwnerPhone, setDraftOwnerPhone] = useState('');
  const [waterRate, setWaterRate] = useState('');
  const [electricRate, setElectricRate] = useState('');

  const [photos, setPhotos] = useState<RoomPhoto[]>([]);
  const photoCount = photos.length;
  const [photoCellSize, setPhotoCellSize] = useState(0);
  const [pickingPhotos, setPickingPhotos] = useState(false);
  const [enhancingUri, setEnhancingUri] = useState<string | null>(null);
  const [enhanceRemaining, setEnhanceRemaining] = useState(MOCK_AI_ENHANCE_LIMIT);
  const [galleryPreviewIndex, setGalleryPreviewIndex] = useState<number | null>(null);
  const [comparePreviewSide, setComparePreviewSide] = useState<'before' | 'after' | null>(null);
  const [compare, setCompare] = useState<{ sourceUri: string; beforeUri: string; after: RoomPhoto } | null>(null);
  const [photoMenuUri, setPhotoMenuUri] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  /** Hub preview card — only updated when user taps Done on a section (not live drafts / auto defaults). */
  const [hubSnapshot, setHubSnapshot] = useState<{
    listingTitle: string;
    propertyName: string;
    bedroom: string;
    sizeSqm: string;
    coverUri: string | null;
  }>({
    listingTitle: '',
    propertyName: '',
    bedroom: '',
    sizeSqm: '',
    coverUri: null,
  });
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
  const [roomContacts, setRoomContacts] = useState<RoomContactSelection[]>([]);
  const [requiredPrompt, setRequiredPrompt] = useState<string | null>(null);
  /** Required section steps highlighted on hub after a failed Save room. */
  const [hubSaveHighlight, setHubSaveHighlight] = useState<number[]>([]);

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
    setTermsByTypeId(Object.fromEntries(initialData.prices.map((price) => [String(price.contractTypeId), {
      advanceRentMonths: price.advanceRentMonths ?? initialData.advanceRentMonths ?? SUGGESTED_ADVANCE_MONTHS,
      depositMonths: price.depositMonths ?? initialData.depositMonths ?? SUGGESTED_DEPOSIT_MONTHS,
    }])));
    setWaterRate(initialData.waterRatePerUnit == null ? '' : String(initialData.waterRatePerUnit));
    setElectricRate(initialData.electricRatePerUnit == null ? '' : String(initialData.electricRatePerUnit));
    setPhotos(initialData.medias.map((media) => ({ uri: media.mediaUrl, mediaUrl: media.mediaUrl, name: 'room.jpg', mimeType: 'image/jpeg' })));
    setHubSnapshot({
      listingTitle: (initialData.listingTitle ?? '').trim(),
      propertyName: (p.name ?? '').trim(),
      bedroom: (values.bedroom ?? '').trim(),
      sizeSqm: (values.room_size ?? '').trim(),
      coverUri: initialData.medias[0]?.mediaUrl ?? null,
    });
    const seeded: { id?: number; name: string; phone: string; roomCount?: number }[] =
      initialData.selectedContacts?.length
        ? initialData.selectedContacts
        : initialData.contactId || initialData.contact
          ? [
              {
                id: initialData.contactId,
                name:
                  initialData.contact?.name ??
                  initialData.selectedContacts?.[0]?.name ??
                  '',
                phone:
                  initialData.contact?.phone ??
                  initialData.selectedContacts?.[0]?.phone ??
                  '',
              },
            ].filter((c) => c.name || c.phone || c.id)
          : [];
    setRoomContacts(
      seeded.slice(0, MAX_ROOM_CONTACTS).map((c) => ({
        key: roomContactKey(c.id, c.phone),
        id: c.id,
        name: c.name,
        phone: c.phone,
        roomCount: c.roomCount,
      })),
    );
    setOwnerMode(seeded.length ? 'pick' : listContacts ? 'pick' : 'create');
    setOwnerName(initialData.contact?.name ?? '');
    setOwnerPhone(initialData.contact?.phone ?? '');
    setOwnerOther(initialData.contact?.note ?? '');
    skipPlacesSearch.current = true;
  }, [initialData, listContacts]);

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

  const sectionHint = useMemo(() => {
    if (step === 1) return cr.propertySectionHint;
    if (step === 2) return cr.layoutSectionHint;
    if (step === 5) return cr.pricingSectionHint;
    if (step === 8) return cr.roomContactSectionHint;
    return null;
  }, [
    step,
    cr.propertySectionHint,
    cr.layoutSectionHint,
    cr.pricingSectionHint,
    cr.roomContactSectionHint,
  ]);

  const roomsLinkedLabel = useCallback(
    (count: number | null | undefined) => {
      const n = count ?? 0;
      if (n <= 0) return cr.ownerRoomsNone;
      if (n === 1) return cr.ownerRoomsOne;
      return interpolate(cr.ownerRoomsCount, { count: n });
    },
    [cr.ownerRoomsNone, cr.ownerRoomsOne, cr.ownerRoomsCount],
  );

  const selectedPropertyTypeCode = useMemo(
    () => propertyTypes.find((opt) => opt.id === propertyTypeId)?.code ?? null,
    [propertyTypes, propertyTypeId],
  );
  const isHouseType = selectedPropertyTypeCode === 'house';
  const nameFieldLabel = isHouseType
    ? cr.propertyNameOrLocationLabel
    : cr.projectOrBuildingLabel;
  const nameFieldPlaceholder = isHouseType
    ? cr.propertyNameOrLocationPlaceholder
    : cr.projectOrBuildingPlaceholder;
  const hasMapPin = latitude != null && longitude != null;
  const areaFieldsEditable =
    placeEntryMode === 'manual' ||
    !searchPlaces ||
    !district.trim() ||
    !province.trim();

  const selectedRoomType = useMemo(
    () => roomTypes.find((item) => item.id === roomTypeId) ?? null,
    [roomTypes, roomTypeId],
  );
  const selectedRoomTypeLabel = useMemo(() => {
    if (!selectedRoomType) return null;
    const labels = t.masters.roomTypes as Record<string, string>;
    return labels[selectedRoomType.code] ?? selectedRoomType.code;
  }, [selectedRoomType, t.masters.roomTypes]);
  /** Fixed by room type (studio / N-bed). Duplex & penthouse stay editable. */
  const bedroomLocked = selectedRoomType?.bedroomCount != null;

  const BEDROOM_OPTIONS = [1, 2, 3, 4, 5] as const;
  const BATHROOM_OPTIONS = [1, 2, 3, 4, 5] as const;

  const fieldLabel = (key: string) => {
    const labels: Record<string, string> = {
      propertyName: nameFieldLabel,
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

  const closeLeaseSheet = () => {
    setLeaseSheet(null);
    setLeaseSheetError('');
  };

  const closeContactSheet = () => {
    setContactSheet(null);
    setContactSheetError('');
    setDraftOwnerName('');
    setDraftOwnerPhone('');
  };

  /** Create → pick; pick → close. Avoids stacking two Modals. */
  const dismissContactSheetStep = () => {
    if (contactSheet === 'create') {
      setDraftOwnerName('');
      setDraftOwnerPhone('');
      setContactSheetError('');
      setContactSheet('pick');
      return;
    }
    closeContactSheet();
  };

  const openPickContactSheet = () => {
    setDraftContactId(null);
    setOwnerQuery('');
    setContactSheetError('');
    setContactSheet('pick');
  };

  const openCreateContactSheet = () => {
    if (roomContacts.length >= MAX_ROOM_CONTACTS) {
      setContactSheetError(cr.roomContactsFull);
      setContactSheet('pick');
      return;
    }
    // Same sheet — swap content only (no second Modal).
    setDraftOwnerName('');
    setDraftOwnerPhone('');
    setContactSheetError('');
    setContactSheet('create');
  };

  const openAddLease = () => {
    const isFirstLease = selectedContractTypeIds.length === 0;
    setDraftTermId(null);
    setDraftRent('');
    setDraftAdvance(
      isFirstLease || advanceRentMonths == null
        ? SUGGESTED_ADVANCE_MONTHS
        : advanceRentMonths,
    );
    setDraftDeposit(
      isFirstLease || depositMonths == null
        ? SUGGESTED_DEPOSIT_MONTHS
        : depositMonths,
    );
    setLeaseSheetError('');
    setLeaseSheet({ mode: 'add' });
  };

  const openEditLease = (contractTypeId: number) => {
    setDraftTermId(contractTypeId);
    setDraftRent(rentsByTypeId[String(contractTypeId)] ?? '');
    setDraftAdvance(leaseTerms(contractTypeId).advanceRentMonths);
    setDraftDeposit(leaseTerms(contractTypeId).depositMonths);
    setLeaseSheetError('');
    setLeaseSheet({ mode: 'edit', contractTypeId });
  };

  const commitLeaseSheet = () => {
    if (draftTermId == null) {
      setLeaseSheetError(cr.leaseLengthRequired);
      return;
    }
    const rent = draftRent.trim();
    if (!rent || !(Number(rent) > 0)) {
      setLeaseSheetError(cr.rentAmountRequired);
      return;
    }
    if (leaseSheet?.mode === 'add' && !selectedContractTypeIds.includes(draftTermId)) {
      setSelectedContractTypeIds((prev) =>
        contractTypes.map((opt) => opt.id).filter((id) => prev.includes(id) || id === draftTermId),
      );
    }
    setRentsByTypeId((prev) => ({ ...prev, [String(draftTermId)]: rent }));
    setTermsByTypeId((prev) => ({ ...prev, [String(draftTermId)]: {
      advanceRentMonths: draftAdvance, depositMonths: draftDeposit,
    } }));
    clearFieldError('contractTerm');
    clearFieldError(`rent_${draftTermId}`);
    closeLeaseSheet();
  };

  const removeLeaseFromSheet = () => {
    if (leaseSheet?.mode !== 'edit') return;
    const id = leaseSheet.contractTypeId;
    const remaining = selectedContractTypeIds.filter((item) => item !== id);
    setSelectedContractTypeIds(remaining);
    setTermsByTypeId((prev) => {
      const next = { ...prev };
      delete next[String(id)];
      return next;
    });
    setRentsByTypeId((prev) => {
      const next = { ...prev };
      delete next[String(id)];
      return next;
    });
    if (remaining.length === 0) {
      setAdvanceRentMonths(null);
      setDepositMonths(null);
    }
    clearFieldError('contractTerm');
    clearFieldError(`rent_${id}`);
    closeLeaseSheet();
  };

  const renderMonthChips = (
    options: readonly number[],
    value: number,
    onChange: (months: number) => void,
    monthlyRent?: number,
  ) => (
    <View style={styles.termRow}>
      {options.map((months) => {
        const selected = value === months;
        const amount =
          monthlyRent && monthlyRent > 0 && months > 0 ? monthlyRent * months : null;
        return (
          <SelectionChip
            key={months}
            label={monthChipLabel(months, cr.monthsNone, cr.contractMonths)}
            subtitle={
              amount != null
                ? interpolate(cr.thbAmount, { amount: formatBaht(amount) })
                : undefined
            }
            selected={selected}
            onPress={() => onChange(months)}
            accentColor={accent}
            inkColor={tokens.colors.primary}
            style={styles.termChipGrow}
          />
        );
      })}
    </View>
  );

  useEffect(() => {
    if (!searchPlacesRef.current) return;
    if (placeEntryMode === 'manual') {
      setSuggestions([]);
      setPlacesLoading(false);
      setPlacesError('');
      setHasSearchedPlaces(false);
      return;
    }
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
  }, [propertyName, cr.placesError, placeEntryMode]);

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
        setSelectedContractTypeIds((prev) =>
          prev.filter((id) => rows.some((item) => item.id === id)),
        );
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
        // Do not auto-select room type / bedroom — wait until user picks and taps Done.
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
  }, [cr.roomTypeLoadError, initialData]);

  const selectedOwnerIds = useMemo(
    () =>
      new Set(
        roomContacts
          .map((c) => c.id)
          .filter((id): id is number => id != null),
      ),
    [roomContacts],
  );

  const filteredOwners = useMemo(() => {
    const q = ownerQuery.trim().toLowerCase();
    const qDigits = digitsOnly(ownerQuery);
    return owners.filter((item) => {
      if (selectedOwnerIds.has(item.id)) return false;
      if (!q) return true;
      const nameHit = item.name.toLowerCase().includes(q);
      const phoneHit =
        item.phone.includes(ownerQuery.trim()) ||
        (qDigits.length > 0 && digitsOnly(item.phone).includes(qDigits));
      return nameHit || phoneHit;
    });
  }, [owners, ownerQuery, selectedOwnerIds]);

  const matchedOwnerByPhone = useMemo(() => {
    const phone = digitsOnly(
      contactSheet === 'create' ? draftOwnerPhone : ownerPhone,
    );
    if (contactSheet !== 'create' && ownerMode !== 'create') return null;
    if (phone.length < 8) return null;
    return owners.find((item) => digitsOnly(item.phone) === phone) ?? null;
  }, [
    owners,
    ownerPhone,
    draftOwnerPhone,
    ownerMode,
    contactSheet,
  ]);

  const addRoomContact = (entry: RoomContactSelection) => {
    setRoomContacts((current) => {
      if (current.some((c) => c.key === entry.key)) return current;
      if (current.length >= MAX_ROOM_CONTACTS) return current;
      return [...current, entry].slice(0, MAX_ROOM_CONTACTS);
    });
    clearFieldError('ownerPick');
    clearFieldError('ownerName');
    clearFieldError('ownerPhone');
  };

  const removeRoomContact = (key: string) => {
    setRoomContacts((current) => current.filter((c) => c.key !== key));
  };

  const handleSelectOwner = (item: PropertyOwnerOption) => {
    Keyboard.dismiss();
    if (roomContacts.length >= MAX_ROOM_CONTACTS) {
      setContactSheetError(cr.roomContactsFull);
      return;
    }
    addRoomContact({
      key: roomContactKey(item.id, item.phone),
      id: item.id,
      name: item.name,
      phone: item.phone,
      roomCount: item.roomCount,
    });
    setOwnerMode('pick');
    setOwnerQuery('');
    setDraftOwnerName('');
    setDraftOwnerPhone('');
    setContactSheet(null);
    setContactSheetError('');
  };

  const commitPickContact = () => {
    if (draftContactId == null) {
      setContactSheetError(cr.ownerPickRequired);
      return;
    }
    const item = owners.find((row) => row.id === draftContactId);
    if (!item) {
      setContactSheetError(cr.ownerPickRequired);
      return;
    }
    handleSelectOwner(item);
  };

  const commitCreateContact = () => {
    const name = draftOwnerName.trim();
    const phone = draftOwnerPhone.trim();
    if (!name || !phone) {
      setContactSheetError(cr.required);
      return;
    }
    if (roomContacts.length >= MAX_ROOM_CONTACTS) {
      setContactSheetError(cr.roomContactsFull);
      return;
    }
    if (matchedOwnerByPhone) {
      handleSelectOwner(matchedOwnerByPhone);
      return;
    }
    const key = roomContactKey(undefined, phone);
    if (roomContacts.some((c) => c.key === key || digitsOnly(c.phone) === digitsOnly(phone))) {
      setContactSheetError(cr.ownerFoundExisting);
      return;
    }
    addRoomContact({ key, name, phone, roomCount: 0 });
    setOwnerMode('pick');
    setDraftOwnerName('');
    setDraftOwnerPhone('');
    setContactSheet(null);
    setContactSheetError('');
  };

  const applyPlaceDetails = (details: PlaceDetails, fallbackName?: string) => {
    setPropertyName(details.name || fallbackName || propertyName);
    setAddress(details.address);
    setDistrict(details.district);
    setProvince(details.province);
    setSubdistrict(details.subdistrict || '');
    setPostalCode(details.postalCode || '');
    setLatitude(details.latitude);
    setLongitude(details.longitude);
    setAddressFromPlace(true);
    clearFieldError('propertyName');
    clearFieldError('address');
    if (details.district) clearFieldError('district');
    if (details.province) clearFieldError('province');
    setPlacesError('');
  };

  const handlePinCoordinateChange = async (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    const loadReverse = reverseGeocodeRef.current;
    if (!loadReverse) return;
    const seq = ++pinResolveSeq.current;
    setPinResolving(true);
    try {
      const details = await loadReverse(lat, lng);
      if (seq !== pinResolveSeq.current) return;
      setPropertyName((current) => current.trim() || details.name || current);
      setAddress(details.address);
      setDistrict(details.district);
      setProvince(details.province);
      setSubdistrict(details.subdistrict || '');
      setPostalCode(details.postalCode || '');
      setLatitude(details.latitude);
      setLongitude(details.longitude);
      setAddressFromPlace(true);
      clearFieldError('propertyName');
      clearFieldError('address');
      if (details.district) clearFieldError('district');
      if (details.province) clearFieldError('province');
      setPlacesError('');
    } catch (err) {
      if (seq === pinResolveSeq.current) {
        setPlacesError(err instanceof Error && err.message ? err.message : cr.placesError);
      }
    } finally {
      if (seq === pinResolveSeq.current) setPinResolving(false);
    }
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
      applyPlaceDetails(details, item.name);
      setPlaceEntryMode('search');
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
      if (roomContacts.length > 0) {
        // at least one selected contact
      } else if (listContactsRef.current) {
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

  // Hub overview (create + edit) or a single section form.
  const [editView, setEditView] = useState<'overview' | 'section'>('overview');
  const pickingSource = !listingSourceCode;
  const showOverview = !!listingSourceCode && editView === 'overview';
  const showSection = !!listingSourceCode && editView === 'section';

  const openSection = (target: number) => {
    setErrors({});
    setStep(target);
    setEditView('section');
  };
  const backToOverview = () => {
    setErrors({});
    setEditView('overview');
  };

  /** Stepwise back only — never exits the create tab (parent handles exit). */
  const handleWizardBack = useCallback(() => {
    if (submitLock.current) return true;
    if (requiredPrompt) {
      setRequiredPrompt(null);
      return true;
    }
    if (contactSheet != null) {
      dismissContactSheetStep();
      return true;
    }
    if (leaseSheet != null) {
      closeLeaseSheet();
      return true;
    }
    if (layoutSheet != null) {
      setLayoutSheet(null);
      return true;
    }
    if (listingSourceCode && editView === 'section') {
      setErrors({});
      setEditView('overview');
      return true;
    }
    if (listingSourceCode && editView === 'overview' && !initialData) {
      setSourceDraft(listingSourceCode);
      setListingSourceCode(null);
      setEditView('overview');
      return true;
    }
    return false;
  }, [
    requiredPrompt,
    listingSourceCode,
    editView,
    initialData,
    contactSheet,
    leaseSheet,
    layoutSheet,
  ]);

  useEffect(() => {
    if (!backHandlerRef) return;
    backHandlerRef.current = handleWizardBack;
    return () => {
      backHandlerRef.current = null;
    };
  }, [backHandlerRef, handleWizardBack]);

  useEffect(() => {
    if (!onHeaderTitleChange) return;
    // Sub-pages: section name in shell header. Hub/source: parent shows Add room.
    onHeaderTitleChange(showSection ? stepTitle : '');
  }, [onHeaderTitleChange, showSection, stepTitle]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => handleWizardBack());
    return () => sub.remove();
  }, [handleWizardBack]);

  const finishSection = () => {
    const invalid = validateStep(step);
    if (invalid) {
      setRequiredPrompt(requiredMessage(invalid));
      return;
    }
    setHubSnapshot((prev) => {
      const next = { ...prev };
      if (step === 1) {
        next.propertyName = propertyName.trim();
      }
      if (step === 2) {
        next.listingTitle = listingTitle.trim();
        next.bedroom = bedroom.trim();
        next.sizeSqm = sizeSqm.trim();
      }
      if (step === 6) {
        next.coverUri = photos[0]?.uri ?? null;
      }
      // Title/property may also change from other sections — keep cover in sync when photos change via Done only.
      return next;
    });
    setHubSaveHighlight((prev) => prev.filter((id) => id !== step));
    backToOverview();
  };

  const sectionHasData = (current: number): boolean => {
    if (current === 1) return propertyName.trim().length > 0;
    if (current === 2) return listingTitle.trim().length > 0 || isFilledCount(bedroom);
    if (current === 3) return facilities.length > 0 || customFacilities.trim().length > 0;
    if (current === 4) return nearbyPlaces.length > 0 || nearbyOther.trim().length > 0;
    if (current === 5) return selectedContractTypeIds.length > 0;
    if (current === 6) return photoCount > 0;
    if (current === 7) return description.trim().length > 0;
    if (current === 8) {
      if (roomContacts.length > 0) return true;
      return ownerName.trim().length > 0 && ownerPhone.trim().length > 0;
    }
    return true;
  };

  const sectionSummary = (current: number): string => {
    const ov = cr.editOverview;
    if (current === 1) {
      const bits = [propertyName.trim(), district.trim() || province.trim()].filter(Boolean);
      return bits.length ? bits.join(' · ') : ov.sectionHints.property;
    }
    if (current === 2) {
      const bits = [
        bedroom.trim() ? interpolate(t.agent.listings.specBed, { count: bedroom.trim() }) : '',
        sizeSqm.trim() ? `${sizeSqm.trim()} sqm` : '',
      ].filter(Boolean);
      return bits.length ? bits.join(' · ') : ov.sectionHints.layout;
    }
    if (current === 5) {
      if (!selectedContractTypeIds.length) return ov.sectionHints.pricing;
      const prices = selectedContractTypeIds.map((id) => Number(rentsByTypeId[String(id)])).filter((price) => price > 0);
      return prices.length ? interpolate(cr.leaseSummary, {
        count: selectedContractTypeIds.length,
        amount: formatBaht(Math.min(...prices)),
      }) : ov.sectionHints.pricing;
    }
    if (current === 6) {
      return interpolate(cr.photosOptionalStatus, { count: photoCount });
    }
    if (current === 8) {
      if (roomContacts.length) {
        return roomContacts.map((c) => c.name).join(' · ');
      }
      if (ownerName.trim()) {
        return `${ownerName.trim()}${ownerPhone.trim() ? ` · ${ownerPhone.trim()}` : ''}`;
      }
      return ov.sectionHints.contact;
    }
    return '';
  };

  // Error keys that describe an invalid value rather than a missing field.
  const NON_FIELD_KEYS = ['nearbyPlaces', 'availableFrom', 'documents', 'customFacilities', 'ownerPick'];

  const hubSteps = initialData ? EDIT_STEPS : CREATE_STEPS;
  const requiredHubSteps = initialData ? EDIT_STEPS.filter((s) => ![3, 4, 6, 7].includes(s)) : CREATE_REQUIRED_STEPS;

  const editSections = (() => {
    if (!listingSourceCode && !initialData) return [];
    const ov = cr.editOverview;
    const defs: Array<{
      step: number;
      icon: 'buildings' | 'bed' | 'camera' | 'coins' | 'sparkle' | 'map-pin' | 'note' | 'user';
      label: string;
      optional?: boolean;
    }> = [
      { step: 1, icon: 'buildings', label: cr.steps.property },
      { step: 2, icon: 'bed', label: cr.steps.layout },
      { step: 5, icon: 'coins', label: cr.steps.pricing },
      { step: 8, icon: 'user', label: cr.steps.ownerVisibility },
      { step: 6, icon: 'camera', label: cr.steps.photos, optional: true },
      { step: 3, icon: 'sparkle', label: cr.steps.facilities },
      { step: 4, icon: 'map-pin', label: cr.steps.nearby },
      { step: 7, icon: 'note', label: cr.detailsTitle },
    ];
    return hubSteps.map((stepId) => {
      const def = defs.find((d) => d.step === stepId)!;
      const hint = sectionSummary(def.step) || ov.sectionHints[
        def.step === 1 ? 'property'
          : def.step === 2 ? 'layout'
          : def.step === 5 ? 'pricing'
          : def.step === 6 ? 'photos'
          : def.step === 8 ? 'contact'
          : def.step === 3 ? 'facilities'
          : def.step === 4 ? 'nearby'
          : 'details'
      ];
      const missing = Object.keys(collectStepErrors(def.step));
      const isSaveHighlight = hubSaveHighlight.includes(def.step) && !def.optional;
      const forceHighlight = isSaveHighlight && missing.length > 0;
      if (forceHighlight || (missing.length > 0 && sectionHasData(def.step))) {
        const fieldKeys = missing.filter((key) => !NON_FIELD_KEYS.includes(key));
        const allFields = fieldKeys.length === missing.length;
        // Hub stays short after Save; field lists appear inside the section form.
        const statusLabel = isSaveHighlight
          ? cr.setupSaveIncomplete
          : allFields
            ? interpolate(ov.missingList, { fields: fieldKeys.map(fieldLabel).join(', ') })
            : requiredMessage(missing[0]);
        return {
          ...def,
          hint,
          status: 'incomplete' as const,
          statusLabel,
          detail: statusLabel,
          highlightError: isSaveHighlight,
        };
      }
      if (!sectionHasData(def.step)) {
        return {
          ...def,
          hint,
          status: 'empty' as const,
          statusLabel: isSaveHighlight
            ? cr.setupSaveIncomplete
            : def.optional
              ? interpolate(cr.photosOptionalStatus, { count: 0 })
              : ov.notAdded,
          detail: ov.notAdded,
          highlightError: isSaveHighlight,
        };
      }
      return {
        ...def,
        hint,
        status: 'complete' as const,
        statusLabel: ov.complete,
        detail: ov.complete,
        highlightError: false,
      };
    });
  })();
  const incompleteSectionCount = editSections.filter((s) => s.status === 'incomplete').length;
  const requiredCompleteCount = requiredHubSteps.filter((stepId) => {
    const section = editSections.find((s) => s.step === stepId);
    return section?.status === 'complete';
  }).length;
  const currentSection = editSections.find((s) => s.step === step);

  const confirmSource = () => {
    if (!sourceDraft) return;
    setListingSourceCode(sourceDraft);
    setEditView('overview');
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

    const existingIds = roomContacts
      .map((c) => c.id)
      .filter((id): id is number => id != null);
    const newContacts = roomContacts
      .filter((c) => c.id == null)
      .map((c) => ({ name: c.name.trim(), phone: c.phone.trim() }));
    const contactPayload =
      roomContacts.length > 0
        ? {
            contactIds: existingIds.length ? existingIds : undefined,
            contacts: newContacts.length ? newContacts : undefined,
            contactId: existingIds[0],
            contact: newContacts[0],
            selectedContacts: roomContacts.map((c) => ({
              id: c.id,
              name: c.name,
              phone: c.phone,
              roomCount: c.roomCount,
            })),
          }
        : {
            contactId: undefined,
            contactIds: undefined,
            contacts: undefined,
            contact: {
              name: ownerName.trim(),
              phone: ownerPhone.trim(),
              note: ownerOther.trim() || undefined,
            },
            selectedContacts: undefined,
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
        ...leaseTerms(id),
      })),
      advanceRentMonths: advanceRentMonths ?? SUGGESTED_ADVANCE_MONTHS,
      depositMonths: depositMonths ?? SUGGESTED_DEPOSIT_MONTHS,
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
    const stepsToValidate = initialData ? requiredHubSteps : CREATE_REQUIRED_STEPS;
    const failedSteps: number[] = [];
    const mergedErrors: Record<string, string> = {};
    for (const current of stepsToValidate) {
      const stepErrors = collectStepErrors(current);
      const keys = Object.keys(stepErrors);
      if (keys.length > 0) {
        failedSteps.push(current);
        Object.assign(mergedErrors, stepErrors);
      }
    }
    if (failedSteps.length > 0) {
      setErrors(mergedErrors);
      setHubSaveHighlight(failedSteps);
      setEditView('overview');
      setRequiredPrompt(null);
      requestAnimationFrame(() => scrollToTop());
      return;
    }
    if (submitLock.current) return;
    setHubSaveHighlight([]);
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

  const dismissCompare = useCallback(() => {
    Alert.alert(
      cr.enhanceDiscardConfirmTitle,
      interpolate(cr.enhanceDiscardConfirmBody, {
        remaining: enhanceRemaining,
        limit: MOCK_AI_ENHANCE_LIMIT,
      }),
      [
        { text: cr.enhanceDiscardConfirmStay, style: 'cancel' },
        {
          text: cr.enhanceDiscardConfirmDiscard,
          style: 'destructive',
          onPress: () => setCompare(null),
        },
      ],
    );
  }, [
    cr.enhanceDiscardConfirmBody,
    cr.enhanceDiscardConfirmDiscard,
    cr.enhanceDiscardConfirmStay,
    cr.enhanceDiscardConfirmTitle,
    enhanceRemaining,
  ]);

  const enhanceQuotaShort = interpolate(cr.enhanceQuotaShort, {
    remaining: enhanceRemaining,
    limit: MOCK_AI_ENHANCE_LIMIT,
  });

  const renderNav = () => (
    <View style={styles.footerSolo}>
      <View style={styles.footerNote}>
        <MobileIcon name="warning" size={16} color={tokens.colors.textSecondary} />
        <Text style={styles.footerNoteText}>{cr.sessionSaveNote}</Text>
      </View>
      <MobileButton
        onPress={finishSection}
        disabled={submitting || pickingPhotos || !!enhancingUri}
        style={styles.footerCta}
        textStyle={styles.footerCtaText}
      >
        {cr.sectionDone}
      </MobileButton>
    </View>
  );

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
        {pickingSource ? (
          <>
            <Text style={styles.sourcePrompt}>{cr.sourcePrompt}</Text>
            <Text style={styles.sourceLead}>{cr.sourcePromptHint}</Text>
          </>
        ) : showOverview ? (
          <>
            {/* Shell header shows Add room on hub; section titles move to header. */}
            <Text style={styles.pageTitle}>
              {title ?? (initialData ? cr.title : cr.setupHubTitle)}
            </Text>
            <Text style={styles.sourceLead}>
              {initialData ? cr.editSections : cr.setupHubHint}
            </Text>
          </>
        ) : showSection ? (
          <>
            {sectionHint ? <Text style={styles.sourceLead}>{sectionHint}</Text> : null}
          </>
        ) : null}
      </View>

      {showOverview ? (
        <Animated.View key="overview" entering={FadeIn.duration(150)} style={styles.formPane}>
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {(hubSnapshot.listingTitle || hubSnapshot.propertyName || hubSnapshot.coverUri) ? (
              <View style={styles.hubPreview}>
                <View style={styles.hubPreviewThumb}>
                  {hubSnapshot.coverUri ? (
                    <Image
                      source={{ uri: hubSnapshot.coverUri, cache: 'reload' }}
                      style={styles.hubPreviewThumbImg}
                    />
                  ) : (
                    <MobileIcon name="buildings" size={22} color={tokens.colors.textSecondary} />
                  )}
                </View>
                <View style={styles.hubPreviewCopy}>
                  <Text style={styles.hubPreviewTitle} numberOfLines={1}>
                    {hubSnapshot.listingTitle ||
                      hubSnapshot.propertyName ||
                      cr.steps.property}
                  </Text>
                  <Text style={styles.hubPreviewMeta} numberOfLines={1}>
                    {[
                      hubSnapshot.bedroom
                        ? interpolate(t.agent.listings.specBed, {
                            count: hubSnapshot.bedroom,
                          })
                        : null,
                      hubSnapshot.sizeSqm ? `${hubSnapshot.sizeSqm} sqm` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || cr.setupHubHint}
                  </Text>
                </View>
              </View>
            ) : null}
            <RoomEditSectionList
              sections={editSections}
              disabled={submitting}
              progress={
                requiredHubSteps.length
                  ? requiredCompleteCount / requiredHubSteps.length
                  : 0
              }
              summaryTone={
                hubSaveHighlight.length > 0
                  ? 'error'
                  : requiredCompleteCount >= requiredHubSteps.length && incompleteSectionCount === 0
                    ? 'success'
                    : 'warning'
              }
              summaryLabel={interpolate(cr.setupProgress, {
                done: requiredCompleteCount,
                total: requiredHubSteps.length,
              })}
              onSelect={openSection}
            />
            <View
              style={[
                styles.hubFootnoteRow,
                hubSaveHighlight.length > 0 ? styles.hubSaveBanner : null,
              ]}
            >
              <Text
                style={[
                  styles.hubFootnoteIcon,
                  hubSaveHighlight.length > 0 ? styles.hubSaveBannerIcon : null,
                ]}
              >
                {hubSaveHighlight.length > 0 ? '!' : 'ⓘ'}
              </Text>
              <Text
                style={[
                  styles.hubFootnote,
                  hubSaveHighlight.length > 0 ? styles.hubSaveBannerText : null,
                ]}
              >
                {hubSaveHighlight.length > 0
                  ? cr.setupSaveMissingBanner
                  : cr.setupMissingHint}
              </Text>
            </View>
          </ScrollView>
          <View style={styles.footer}>
            {!initialData && <Text style={styles.footerNoteText}>{cr.visibilityPrivateHint}</Text>}
            <MobileButton
              onPress={handleSubmit}
              isLoading={submitting}
              disabled={submitting || !!enhancingUri}
              style={styles.footerCta}
              textStyle={styles.footerCtaText}
            >
              {submitLabel ?? cr.saveRoom}
            </MobileButton>
          </View>
        </Animated.View>
      ) : pickingSource ? (
        <View style={styles.sourceScreen}>
          <ScrollView contentContainerStyle={{ gap: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={styles.sourceList}>
            {LISTING_SOURCE_OPTIONS.map((opt) => {
              const selected = sourceDraft === opt.code;
              return (
                <Pressable
                  key={opt.code}
                  onPress={() => setSourceDraft(opt.code)}
                  android_ripple={{ color: '#00000014' }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.sourceCard,
                    {
                      borderColor: selected ? accent : SOURCE_IDLE_BORDER,
                      backgroundColor: tokens.colors.white,
                    },
                    pressed ? { opacity: 0.92 } : null,
                  ]}
                >
                  <View style={[styles.sourceIconWrap, { backgroundColor: opt.iconBg }]}>
                    <MobileIcon name={opt.icon} size={24} weight="regular" color={opt.iconColor} />
                  </View>
                  <View style={styles.sourceCopy}>
                    <Text style={styles.sourceTitle}>{sourceLabels[opt.code]}</Text>
                    <Text style={styles.sourceHint}>{sourceHints[opt.code]}</Text>
                  </View>
                  <SelectionCheck selected={selected} variant="row" size="md" />
                </Pressable>
              );
            })}
          </View>
          <View style={styles.sourceNoteRow}>
            <Text style={styles.sourceNote}>ⓘ  {cr.sourceNote}</Text>
          </View>
          </ScrollView>
          <View style={styles.sourceFooter}>
            <MobileButton
              onPress={confirmSource}
              disabled={!sourceDraft}
              style={[
                styles.footerCta,
                { backgroundColor: sourceDraft ? accent : '#E9EDF2', opacity: 1 },
              ]}
              textStyle={{
                fontSize: 16,
                lineHeight: 24,
                color: sourceDraft ? accentInk : '#64748B',
              }}
            >
              {cr.next}
            </MobileButton>
          </View>
        </View>
      ) : showSection ? (
        <Animated.View
          key={`section-${step}`}
          entering={FadeIn.duration(150)}
          style={styles.formPane}
        >
      <ScrollView
        ref={formScrollRef}
        style={styles.formScroll}
        contentContainerStyle={styles.formScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formBody}>
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
                  <ActivityIndicator size="small" color={accent} />
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
                    <SelectionChip
                      key={opt.id}
                      label={labels[opt.code] ?? opt.code}
                      selected={selected}
                      onPress={() => {
                        setPropertyTypeId(opt.id);
                        clearFieldError('propertyType');
                      }}
                      accentColor={tokens.colors.brand[500]}
                      inkColor={tokens.colors.primary}
                      style={[
                        styles.propertyTypeChip,
                        !selected && errors.propertyType
                          ? { borderColor: tokens.colors.error }
                          : null,
                      ]}
                      labelStyle={styles.propertyTypeChipText}
                    />
                  );
                })}
              </View>
              {errors.propertyType ? (
                <Text style={styles.errorText}>{errors.propertyType}</Text>
              ) : null}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>
                  {nameFieldLabel}
                  <Text style={styles.requiredMark}> *</Text>
                </Text>
                {placeEntryMode === 'manual' || !searchPlaces ? (
                  <MobileInput
                    placeholder={nameFieldPlaceholder}
                    value={propertyName}
                    autoCorrect={false}
                    autoCapitalize="words"
                    onChangeText={(v) => {
                      setPropertyName(v);
                      clearFieldError('propertyName');
                    }}
                    error={errors.propertyName}
                  />
                ) : (
                  <View
                    style={[
                      styles.searchInputWrap,
                      errors.propertyName ? { borderColor: tokens.colors.error } : null,
                    ]}
                  >
                    <MobileIcon name="search" size={18} color={tokens.colors.textSecondary} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder={nameFieldPlaceholder}
                      placeholderTextColor={tokens.colors.placeholder}
                      value={propertyName}
                      autoCorrect={false}
                      autoCapitalize="words"
                      onChangeText={(v) => {
                        setPropertyName(v);
                        clearFieldError('propertyName');
                      }}
                    />
                    {propertyName.trim().length > 0 ? (
                      <Pressable
                        onPress={() => {
                          setPropertyName('');
                          clearFieldError('propertyName');
                        }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Clear"
                        style={styles.searchClearBtn}
                      >
                        <MobileIcon name="close" size={16} color={tokens.colors.textSecondary} />
                      </Pressable>
                    ) : null}
                  </View>
                )}
                {placeEntryMode === 'search' && searchPlaces && errors.propertyName ? (
                  <Text style={styles.errorText}>{errors.propertyName}</Text>
                ) : null}
              </View>
              {searchPlaces && placeEntryMode === 'search' ? (
                <>
                  {(placesLoading ||
                    placesError ||
                    suggestions.length > 0 ||
                    hasSearchedPlaces) ? (
                    <View style={styles.suggestBox}>
                      {placesLoading ? (
                        <View style={styles.suggestStatus}>
                          <ActivityIndicator size="small" color={accent} />
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
                  <Pressable
                    onPress={() => {
                      placesSeq.current += 1;
                      setPlaceEntryMode('manual');
                      setSuggestions([]);
                      setHasSearchedPlaces(false);
                      setPlacesError('');
                      setPlacesLoading(false);
                    }}
                    accessibilityRole="button"
                    hitSlop={6}
                    style={styles.manualEntryRow}
                  >
                    <Text style={styles.manualEntryLink}>{cr.enterManually}</Text>
                    <MobileIcon name="chevron-right" size={16} color={tokens.colors.accent} />
                  </Pressable>
                </>
              ) : searchPlaces ? (
                <Pressable
                  onPress={() => setPlaceEntryMode('search')}
                  accessibilityRole="button"
                  hitSlop={6}
                  style={styles.manualEntryRow}
                >
                  <Text style={styles.manualEntryLink}>{cr.searchOnMap}</Text>
                  <MobileIcon name="chevron-right" size={16} color={tokens.colors.accent} />
                </Pressable>
              ) : null}
              <PropertyPlaceMap
                latitude={latitude ?? DEFAULT_MAP.latitude}
                longitude={longitude ?? DEFAULT_MAP.longitude}
                hasPin={hasMapPin}
                onCoordinateChange={handlePinCoordinateChange}
                adjustPinLabel={cr.adjustPin}
                adjustPinActiveLabel={cr.adjustPinActive}
                placePinHint={cr.mapPlacePinHint}
                resolving={pinResolving}
                mapsApiKey={mapsApiKey}
              />
              <MobileInput
                label={cr.address}
                placeholder={cr.addressPlaceholder}
                value={address}
                required
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                onChangeText={(v) => {
                  setAddress(v);
                  setAddressFromPlace(false);
                  clearFieldError('address');
                }}
                error={errors.address}
                helperText={addressFromPlace ? cr.addressFilledHint : undefined}
                style={styles.addressMultiline}
              />
              <View style={styles.twoColumnRow}>
                <MobileInput
                  label={cr.district}
                  value={district}
                  required
                  editable={areaFieldsEditable}
                  onChangeText={(v) => {
                    setDistrict(v);
                    setAddressFromPlace(false);
                    clearFieldError('district');
                  }}
                  error={errors.district}
                  containerStyle={styles.halfField}
                />
                <MobileInput
                  label={cr.province}
                  value={province}
                  required
                  editable={areaFieldsEditable}
                  onChangeText={(v) => {
                    setProvince(v);
                    setAddressFromPlace(false);
                    clearFieldError('province');
                  }}
                  error={errors.province}
                  containerStyle={styles.halfField}
                />
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <View style={styles.layoutSection}>
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
                helperText={cr.listingTitleHint}
              />
              {listRoomTypes ? (
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>
                    {cr.roomType}
                    <Text style={styles.requiredMark}> *</Text>
                  </Text>
                  {roomTypesLoading ? (
                    <View style={styles.suggestStatus}>
                      <ActivityIndicator size="small" color={accent} />
                      <Text style={styles.suggestStatusText}>{t.common.loading}</Text>
                    </View>
                  ) : null}
                  {roomTypesError ? (
                    <Text style={styles.errorText}>{roomTypesError}</Text>
                  ) : null}
                  <Pressable
                    onPress={() => !roomTypesLoading && setLayoutSheet('roomType')}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.selectRow,
                      errors.roomType ? { borderColor: tokens.colors.error } : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.selectValue,
                        !selectedRoomTypeLabel ? styles.selectPlaceholder : null,
                      ]}
                    >
                      {selectedRoomTypeLabel ?? cr.selectRoomType}
                    </Text>
                    <MobileIcon name="chevron-down" size={18} color={tokens.colors.textSecondary} />
                  </Pressable>
                  {errors.roomType ? (
                    <Text style={styles.errorText}>{errors.roomType}</Text>
                  ) : null}
                </View>
              ) : null}
              <View style={styles.fieldGrid}>
                <View style={styles.fieldGridItem}>
                  <Text style={styles.fieldLabel}>
                    {cr.bedroom}
                    <Text style={styles.requiredMark}> *</Text>
                  </Text>
                  <Pressable
                    onPress={() => {
                      if (bedroomLocked) return;
                      setLayoutSheet('bedroom');
                    }}
                    disabled={bedroomLocked}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: bedroomLocked }}
                    style={({ pressed }) => [
                      styles.selectRow,
                      bedroomLocked ? styles.selectRowLocked : null,
                      errors.bedroom ? { borderColor: tokens.colors.error } : null,
                      !bedroomLocked && pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <MobileIcon name="bed" size={18} color={tokens.colors.textSecondary} />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.selectValue,
                        !bedroom.trim() ? styles.selectPlaceholder : null,
                      ]}
                    >
                      {bedroom.trim() || cr.selectCount}
                    </Text>
                    {bedroomLocked ? null : (
                      <MobileIcon name="chevron-down" size={18} color={tokens.colors.textSecondary} />
                    )}
                  </Pressable>
                  {errors.bedroom ? (
                    <Text style={styles.errorText}>{errors.bedroom}</Text>
                  ) : null}
                </View>
                <View style={styles.fieldGridItem}>
                  <Text style={styles.fieldLabel}>
                    {cr.bathroom}
                    <Text style={styles.requiredMark}> *</Text>
                  </Text>
                  <Pressable
                    onPress={() => setLayoutSheet('bathroom')}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.selectRow,
                      errors.bathroom ? { borderColor: tokens.colors.error } : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <MobileIcon name="bath" size={18} color={tokens.colors.textSecondary} />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.selectValue,
                        !bathroom.trim() ? styles.selectPlaceholder : null,
                      ]}
                    >
                      {bathroom.trim() || cr.selectCount}
                    </Text>
                    <MobileIcon name="chevron-down" size={18} color={tokens.colors.textSecondary} />
                  </Pressable>
                  {errors.bathroom ? (
                    <Text style={styles.errorText}>{errors.bathroom}</Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.fieldGrid}>
                <View style={styles.fieldGridItem}>
                  <MobileInput
                    label={cr.floor}
                    placeholder={cr.floorPlaceholder}
                    keyboardType="numeric"
                    value={floor}
                    leadingIcon="stairs"
                    onChangeText={setFloor}
                  />
                </View>
                <View style={styles.fieldGridItem}>
                  <MobileInput
                    label={cr.sizeSqm}
                    keyboardType="numeric"
                    placeholder="35"
                    value={sizeSqm}
                    leadingIcon="room-size"
                    trailingText="sqm"
                    onChangeText={(v) => {
                      setSizeSqm(v);
                      clearFieldError('sizeSqm');
                    }}
                    error={errors.sizeSqm}
                  />
                </View>
              </View>
              <MobileInput
                label={cr.building}
                placeholder={cr.buildingPlaceholder}
                autoCapitalize="characters"
                value={building}
                leadingIcon="buildings"
                onChangeText={setBuilding}
              />
              {initialData ? (
                <>
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
                  <MobileInput
                    label={cr.roomId}
                    placeholder={cr.roomIdPlaceholder}
                    value={roomId}
                    onChangeText={setRoomId}
                  />
                </>
              ) : null}
              </View>
            </>
          )}

          {step === 5 && (
            <>
              <Pressable
                onPress={openAddLease}
                disabled={
                  contractTypesLoading ||
                  contractTypes.length === 0 ||
                  selectedContractTypeIds.length >= contractTypes.length
                }
                android_ripple={{ color: '#00000014' }}
                accessibilityRole="button"
                accessibilityLabel={cr.addLease}
                style={({ pressed }) => [
                  styles.addLeaseBtn,
                  { borderColor: accent },
                  selectedContractTypeIds.length >= contractTypes.length && contractTypes.length > 0
                    ? styles.addLeaseBtnDisabled
                    : null,
                  pressed ? { opacity: 0.88 } : null,
                ]}
              >
                <MobileIcon name="plus" size={18} color={tokens.colors.primary} weight="bold" />
                <Text style={styles.addLeaseBtnText}>{cr.addLease}</Text>
              </Pressable>

              {contractTypesLoading ? (
                <View style={styles.suggestStatus}>
                  <ActivityIndicator size="small" color={accent} />
                  <Text style={styles.suggestStatusText}>{t.common.loading}</Text>
                </View>
              ) : null}
              {contractTypesError ? (
                <Text style={styles.errorText}>{contractTypesError}</Text>
              ) : null}

              <View style={styles.leaseList}>
                {contractTypes
                  .filter((opt) => selectedContractTypeIds.includes(opt.id))
                  .map((opt) => {
                    const rent = rentsByTypeId[String(opt.id)] ?? '';
                    const rentNum = Number(rent);
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => openEditLease(opt.id)}
                        android_ripple={{ color: '#00000014' }}
                        accessibilityRole="button"
                        accessibilityLabel={interpolate(cr.leaseCardTitle, {
                          months: opt.termMonths,
                        })}
                        style={({ pressed }) => [
                          styles.leaseCard,
                          pressed ? { opacity: 0.92 } : null,
                        ]}
                      >
                        <View style={styles.leaseCardText}>
                          <Text style={styles.leaseCardTitle}>
                            {interpolate(cr.leaseCardTitle, { months: opt.termMonths })}
                          </Text>
                          {rentNum > 0 ? (
                            <Text style={styles.leaseCardPrice}>
                              {interpolate(cr.leaseCardRent, {
                                amount: formatBaht(rentNum),
                              })}
                            </Text>
                          ) : (
                            <Text style={styles.leaseCardSub}>{cr.rentAmountRequired}</Text>
                          )}
                          {(
                            <Text style={styles.leaseCardSub}>
                              {interpolate(cr.leaseCardAdvanceDeposit, {
                                advance: monthChipLabel(
                                  leaseTerms(opt.id).advanceRentMonths,
                                  cr.monthsNone,
                                  cr.contractMonths,
                                ),
                                deposit: monthChipLabel(
                                  leaseTerms(opt.id).depositMonths,
                                  cr.monthsNone,
                                  cr.contractMonths,
                                ),
                              })}
                            </Text>
                          )}
                        </View>
                        <MobileIcon
                          name="chevron-right"
                          size={20}
                          color={tokens.colors.textSecondary}
                        />
                      </Pressable>
                    );
                  })}
              </View>

              {errors.contractTerm ? (
                <Text style={styles.errorText}>{errors.contractTerm}</Text>
              ) : null}
              {Object.keys(errors)
                .filter((key) => key.startsWith('rent_'))
                .map((key) => (
                  <Text key={key} style={styles.errorText}>
                    {errors[key]}
                  </Text>
                ))}
            </>
          )}

          {step === 6 && (
            <>
              <View style={styles.photosMetaRow}>
                <Text style={[styles.sourceLead, styles.photosMetaLead]} numberOfLines={2}>
                  {initialData?.visibility === 'published'
                    ? cr.photosHint
                    : cr.photosOptionalLead}
                </Text>
                <Text style={styles.photosMetaCount}>
                  {interpolate(cr.photosOfMax, { count: photoCount })}
                </Text>
              </View>
              {errors.photos ? (
                <Text style={styles.errorText}>{errors.photos}</Text>
              ) : null}
              <View
                style={styles.photoGrid}
                onLayout={(e: LayoutChangeEvent) => {
                  const w = e.nativeEvent.layout.width;
                  if (w <= 0) return;
                  const next = Math.floor((w - PHOTO_GRID_GAP) / 2);
                  setPhotoCellSize((prev) => (prev === next ? prev : next));
                }}
              >
                {photos.map((photo, i) => {
                  const enhancing = enhancingUri === photo.uri;
                  return (
                    <View
                      key={photo.uri}
                      style={[
                        styles.photoTile,
                        photoCellSize > 0
                          ? { width: photoCellSize, height: photoCellSize }
                          : null,
                      ]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={cr.viewPhoto}
                        disabled={submitting || enhancing}
                        onPress={() => setGalleryPreviewIndex(i)}
                        style={styles.photoTileHit}
                      >
                        <Image source={{ uri: photo.uri, cache: 'reload' }} style={styles.photoTileImg} />
                        {i === 0 ? (
                          <View style={[styles.coverBadge, { backgroundColor: accent }]}>
                            <Text style={[styles.coverBadgeText, { color: accentInk }]}>
                              {cr.coverBadge}
                            </Text>
                          </View>
                        ) : null}
                        {photo.originalUri ? (
                          <View style={[styles.aiBadge, { backgroundColor: accent }]}>
                            <Text style={[styles.aiBadgeText, { color: accentInk }]}>AI</Text>
                          </View>
                        ) : null}
                      </Pressable>
                      {enhancing ? (
                        <Animated.View
                          entering={FadeIn.duration(150)}
                          style={styles.photoEnhanceOverlay}
                          accessibilityRole="progressbar"
                          accessibilityLabel={cr.enhancePhotoLoading}
                        >
                          <ActivityIndicator color={accent} size="small" />
                          <Text style={styles.photoEnhanceLabel}>{cr.enhancePhotoLoading}</Text>
                        </Animated.View>
                      ) : (
                        <Pressable
                          style={styles.photoMenuBtn}
                          hitSlop={8}
                          accessibilityRole="button"
                          onPress={() => setPhotoMenuUri(photo.uri)}
                        >
                          <MobileIcon name="dots-vertical" size={18} color={tokens.colors.white} />
                        </Pressable>
                      )}
                    </View>
                  );
                })}
                {photoCount < 12 && pickPhotos ? (
                  <Pressable
                    style={[
                      styles.photoAddTile,
                      photoCellSize > 0
                        ? { width: photoCellSize, height: photoCellSize }
                        : null,
                    ]}
                    disabled={submitting || pickingPhotos || !!enhancingUri}
                    onPress={async () => {
                      if (!pickPhotos || pickingPhotos) return;
                      setPickingPhotos(true);
                      try {
                        const selected = await pickPhotos(12 - photoCount);
                        setPhotos((current) =>
                          [
                            ...current,
                            ...selected.filter(
                              (photo, index) =>
                                !current.some((item) => item.uri === photo.uri) &&
                                selected.findIndex((item) => item.uri === photo.uri) === index,
                            ),
                          ].slice(0, 12),
                        );
                        clearFieldError('photos');
                      } catch (err) {
                        Alert.alert(cr.saveError, err instanceof Error ? err.message : String(err));
                      } finally {
                        setPickingPhotos(false);
                      }
                    }}
                  >
                    {pickingPhotos ? (
                      <ActivityIndicator color={accent} />
                    ) : (
                      <>
                        <MobileIcon name="plus" size={22} color={tokens.colors.textSecondary} />
                        <Text style={styles.photoAddLabel}>{cr.addPhoto}</Text>
                      </>
                    )}
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.hubFootnoteRow}>
                <Text style={styles.hubFootnoteIcon}>ⓘ</Text>
                <Text style={styles.hubFootnote}>
                  {photoCount < 5 ? cr.photosPublishMinHint : cr.sessionSaveNote}
                </Text>
              </View>
              <RoomPhotoCompareModal
                // Hide while photo viewer is open — RN cannot reliably stack two Modals.
                visible={compare != null && comparePreviewSide == null && galleryPreviewIndex == null}
                beforeUri={compare?.beforeUri ?? ''}
                afterUri={compare?.after.uri ?? ''}
                labels={{
                  title: cr.comparePhotoTitle,
                  before: cr.photoBefore,
                  after: cr.photoAfter,
                  useEnhanced: cr.useEnhancedPhoto,
                  keepOriginal: cr.keepOriginalPhoto,
                  viewPhoto: cr.viewPhoto,
                }}
                quotaNote={interpolate(cr.enhanceQuotaUsedNote, {
                  remaining: enhanceRemaining,
                  limit: MOCK_AI_ENHANCE_LIMIT,
                })}
                onDismiss={dismissCompare}
                onPreview={(params) =>
                  setComparePreviewSide(params.uri === compare?.beforeUri ? 'before' : 'after')
                }
                onUseEnhanced={() => {
                  if (!compare) return;
                  const { sourceUri, after } = compare;
                  setPhotos((current) => current.map((item) => (item.uri === sourceUri ? after : item)));
                  setCompare(null);
                }}
              />
              <MobilePhotoViewer
                visible={galleryPreviewIndex != null}
                mode="gallery"
                items={photos.map((photo) => ({
                  uri: photo.uri,
                  beforeUri: photo.originalUri,
                  enhanced: !!photo.originalUri,
                }))}
                index={galleryPreviewIndex ?? 0}
                onIndexChange={setGalleryPreviewIndex}
                labels={{
                  titlePreview: cr.photoViewerTitle,
                  titleCompare: cr.photoViewerCompareTitle,
                  before: cr.photoBefore,
                  after: cr.photoAfter,
                  enhancedBadge: cr.photoViewerEnhancedBadge,
                  enhancedCaption: cr.photoViewerEnhancedCaption,
                  hintZoom: cr.photoViewerHintZoom,
                  hintCompareSwitch: cr.photoViewerHintCompareSwitch,
                  hintCompareClose: cr.photoViewerHintCompareClose,
                  closeA11y: cr.closePhotoPreview,
                }}
                onClose={() => setGalleryPreviewIndex(null)}
              />
              <MobilePhotoViewer
                visible={comparePreviewSide != null && compare != null}
                mode="compare"
                beforeUri={compare?.beforeUri}
                afterUri={compare?.after.uri}
                initialSide={comparePreviewSide ?? 'after'}
                labels={{
                  titlePreview: cr.photoViewerTitle,
                  titleCompare: cr.photoViewerCompareTitle,
                  before: cr.photoBefore,
                  after: cr.photoAfter,
                  enhancedBadge: cr.photoViewerEnhancedBadge,
                  enhancedCaption: cr.photoViewerEnhancedCaption,
                  hintZoom: cr.photoViewerHintZoom,
                  hintCompareSwitch: cr.photoViewerHintCompareSwitch,
                  hintCompareClose: cr.photoViewerHintCompareClose,
                  closeA11y: cr.closePhotoPreview,
                }}
                onClose={() => setComparePreviewSide(null)}
              />
              <MobileBottomSheet visible={photoMenuUri != null} onClose={() => setPhotoMenuUri(null)}>
                <MobileActionSheetBody
                  title={cr.steps.photos}
                  cancelLabel={t.common.cancel}
                  onCancel={() => setPhotoMenuUri(null)}
                  actions={[
                    ...(photoMenuUri && photos[0]?.uri !== photoMenuUri
                      ? [
                          {
                            key: 'cover',
                            label: cr.setCover,
                            onPress: () => {
                              const uri = photoMenuUri;
                              if (!uri) return;
                              setPhotos((current) => {
                                const target = current.find((p) => p.uri === uri);
                                if (!target) return current;
                                return [target, ...current.filter((p) => p.uri !== uri)];
                              });
                              setPhotoMenuUri(null);
                            },
                          },
                        ]
                      : []),
                    ...(enhancePhoto
                      ? [
                          {
                            key: 'enhance',
                            label:
                              enhanceRemaining > 0
                                ? `${cr.enhancePhoto} · ${enhanceQuotaShort}`
                                : cr.enhanceQuotaExhausted,
                            disabled: !photoMenuUri || !!enhancingUri || enhanceRemaining <= 0,
                            loading: !!photoMenuUri && enhancingUri === photoMenuUri,
                            onPress: () => {
                              const uri = photoMenuUri;
                              if (!uri || !enhancePhoto || enhancingUri) return;
                              if (enhanceRemaining <= 0) {
                                Alert.alert(cr.enhanceQuotaExhausted, enhanceQuotaShort);
                                return;
                              }
                              const photo = photos.find((p) => p.uri === uri);
                              if (!photo) return;
                              setEnhancingUri(uri);
                              setPhotoMenuUri(null);
                              void (async () => {
                                try {
                                  const enhanced = await enhancePhoto(photo);
                                  setEnhanceRemaining((current) => Math.max(0, current - 1));
                                  setCompare({
                                    sourceUri: photo.uri,
                                    beforeUri: photo.originalUri ?? photo.uri,
                                    after: {
                                      ...enhanced,
                                      originalUri: photo.originalUri ?? photo.uri,
                                    },
                                  });
                                } catch (err) {
                                  Alert.alert(
                                    cr.enhancePhotoError,
                                    err instanceof Error ? err.message : String(err),
                                  );
                                } finally {
                                  setEnhancingUri(null);
                                }
                              })();
                            },
                          },
                        ]
                      : []),
                    {
                      key: 'remove',
                      label: cr.removePhoto,
                      danger: true,
                      disabled: !photoMenuUri,
                      onPress: () => {
                        const uri = photoMenuUri;
                        if (!uri) return;
                        setPhotos((current) => current.filter((item) => item.uri !== uri));
                        setPhotoMenuUri(null);
                      },
                    },
                  ]}
                />
              </MobileBottomSheet>
            </>
          )}

          {submitting && <Text accessibilityLiveRegion="polite" style={styles.hint}>{interpolate(cr.uploadProgress, { count: uploadProgress, total: photoCount })}</Text>}

          {step === 3 && <>
            <RoomFacilitiesEditor options={facilityOptions} selected={facilities} onChange={setFacilities} custom={customFacilities} onCustomChange={setCustomFacilities} loading={facilitiesLoading} error={facilityError} onRetry={loadFacilities} color={accent} />
            {!!errors.customFacilities && <Text style={styles.errorText}>{errors.customFacilities}</Text>}
          </>}
          {step === 4 && <>
            <RoomNearbyEditor latitude={latitude} longitude={longitude} value={nearbyPlaces} onChange={(value) => { setNearbyPlaces(value); clearFieldError('nearbyPlaces'); }} search={searchNearby} apiKey={mapsApiKey} color={accent} error={errors.nearbyPlaces} />
            <MobileInput label={cr.nearbyNotes} placeholder={cr.nearbyPlaceholder} value={nearbyOther} onChangeText={setNearbyOther} multiline maxLength={500} style={{ height: 100, textAlignVertical: 'top' }} />
          </>}
          {step === 7 && <>
            <Text style={styles.hint}>{cr.detailsHint}</Text>
            <MobileInput label={cr.listingDescription} value={description} onChangeText={setDescription} multiline maxLength={10000} style={{ height: 150, textAlignVertical: 'top' }} />
            <MobileInput label={cr.availableFrom} placeholder="YYYY-MM-DD" value={availableFrom} onChangeText={setAvailableFrom} maxLength={10} error={errors.availableFrom} />
            <Text style={styles.fieldLabel}>{cr.steps.documents}</Text>
            <Text style={styles.hint}>{cr.documentLinksHint}</Text>
            {documents.map((document, index) => <View key={index} style={styles.ownerCard}>
              <View style={styles.typeRow}>{(['id_passport', 'bookbank', 'ownership', 'other'] as const).map((kind) => <Pressable key={kind} accessibilityRole="radio" accessibilityState={{ checked: document.kind === kind }} onPress={() => setDocuments((current) => current.map((d, i) => i === index ? { ...d, kind } : d))} style={[styles.typeChip, document.kind === kind && { backgroundColor: accent, borderColor: accent }]}><Text style={[styles.typeChipText, document.kind === kind && styles.typeChipTextSelected]}>{cr.documentKinds[kind]}</Text></Pressable>)}</View>
              <MobileInput label={cr.documentUrl} placeholder="https://" autoCapitalize="none" value={document.mediaUrl} maxLength={500} onChangeText={(mediaUrl) => setDocuments((current) => current.map((d, i) => i === index ? { ...d, mediaUrl } : d))} />
              <MobileButton variant="outline" onPress={() => setDocuments((current) => current.filter((_, i) => i !== index))}>{cr.removeDocument}</MobileButton>
            </View>)}
            {!!errors.documents && <Text style={styles.errorText}>{errors.documents}</Text>}
            <MobileButton variant="outline" disabled={documents.length >= 20} onPress={() => setDocuments((current) => [...current, { kind: 'other', mediaUrl: '', sortOrder: current.length }])}>{cr.addDocumentLink}</MobileButton>
          </>}
          {step === 8 && (
            <>
              <Text style={styles.hint}>{cr.roomContactsMaxHint}</Text>
              {roomContacts.length > 0 ? (
                <View style={{ gap: 12 }}>
                  <Text style={styles.fieldLabel}>{cr.selectedContactLabel}</Text>
                  {roomContacts.map((c) => (
                    <SelectedContactCard
                      key={c.key}
                      name={c.name}
                      phone={c.phone}
                      roomsLabel={roomsLinkedLabel(c.roomCount)}
                      accentColor={accent}
                      removeLabel={cr.roomContactRemove}
                      onRemove={
                        listContacts
                          ? () => removeRoomContact(c.key)
                          : undefined
                      }
                    />
                  ))}
                </View>
              ) : null}

              {listContacts ? (
                roomContacts.length < MAX_ROOM_CONTACTS ? (
                  <Pressable
                    onPress={openPickContactSheet}
                    android_ripple={{ color: '#00000014' }}
                    accessibilityRole="button"
                    accessibilityLabel={cr.chooseContactTitle}
                    style={({ pressed }) => [
                      styles.changeContactBtn,
                      { borderColor: tokens.colors.border },
                      pressed ? { opacity: 0.88 } : null,
                    ]}
                  >
                    <Text style={styles.changeContactBtnText}>
                      {cr.chooseContactTitle}
                    </Text>
                    <MobileIcon
                      name="chevron-right"
                      size={20}
                      color={tokens.colors.textSecondary}
                    />
                  </Pressable>
                ) : (
                  <Text style={styles.hint}>{cr.roomContactsFull}</Text>
                )
              ) : (
                <>
                  {!roomContacts.length ? (
                    <Text style={styles.hint}>{cr.ownerPickRequired}</Text>
                  ) : null}
                  <MobileInput
                    label={cr.ownerName}
                    placeholder="e.g. Alex Morgan"
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
                    placeholder="e.g. 0812345678"
                    keyboardType="phone-pad"
                    value={ownerPhone}
                    required
                    onChangeText={(v) => {
                      setOwnerPhone(v);
                      clearFieldError('ownerPhone');
                    }}
                    error={errors.ownerPhone}
                  />
                </>
              )}

              {errors.ownerPick ? (
                <Text style={styles.errorText}>{errors.ownerPick}</Text>
              ) : null}
              {errors.ownerName ? (
                <Text style={styles.errorText}>{errors.ownerName}</Text>
              ) : null}
              {errors.ownerPhone ? (
                <Text style={styles.errorText}>{errors.ownerPhone}</Text>
              ) : null}
            </>
          )}
          </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>{renderNav()}</View>
        </Animated.View>
      ) : null}

      <MobileBottomSheet visible={layoutSheet != null} onClose={() => setLayoutSheet(null)}>
        <WizardSheetChrome
          title={
            layoutSheet === 'roomType'
              ? cr.roomType
              : layoutSheet === 'bedroom'
                ? cr.bedroom
                : cr.bathroom
          }
          closeLabel={cr.closePhotoPreview}
          onClose={() => setLayoutSheet(null)}
        />
        <ScrollView
          style={styles.layoutSheetScroll}
          contentContainerStyle={styles.layoutSheetBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          {layoutSheet === 'roomType'
            ? roomTypes.map((opt) => {
                const selected = roomTypeId === opt.id;
                const labels = t.masters.roomTypes as Record<string, string>;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => {
                      setRoomTypeId(opt.id);
                      clearFieldError('roomType');
                      if (opt.code === 'studio') {
                        setBedroom('0');
                        clearFieldError('bedroom');
                      } else if (opt.bedroomCount != null) {
                        setBedroom(String(opt.bedroomCount));
                        clearFieldError('bedroom');
                      }
                      setLayoutSheet(null);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.layoutSheetRow,
                      selected ? styles.layoutSheetRowSelected : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.layoutSheetRowText,
                        selected ? styles.layoutSheetRowTextSelected : null,
                      ]}
                    >
                      {labels[opt.code] ?? opt.code}
                    </Text>
                    {selected ? <SelectionCheck selected variant="chip" size="md" /> : null}
                  </Pressable>
                );
              })
            : (layoutSheet === 'bedroom' ? BEDROOM_OPTIONS : BATHROOM_OPTIONS).map((count) => {
                const selected =
                  layoutSheet === 'bedroom'
                    ? bedroom.trim() === String(count)
                    : bathroom.trim() === String(count);
                return (
                  <Pressable
                    key={`${layoutSheet}-${count}`}
                    onPress={() => {
                      if (layoutSheet === 'bedroom') {
                        setBedroom(String(count));
                        clearFieldError('bedroom');
                      } else {
                        setBathroom(String(count));
                        clearFieldError('bathroom');
                      }
                      setLayoutSheet(null);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.layoutSheetRow,
                      selected ? styles.layoutSheetRowSelected : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.layoutSheetRowText,
                        selected ? styles.layoutSheetRowTextSelected : null,
                      ]}
                    >
                      {String(count)}
                    </Text>
                    {selected ? <SelectionCheck selected variant="chip" size="md" /> : null}
                  </Pressable>
                );
              })}
        </ScrollView>
      </MobileBottomSheet>

      <MobileBottomSheet visible={leaseSheet != null} onClose={closeLeaseSheet} avoidKeyboard>
        {(() => {
          const editing = leaseSheet?.mode === 'edit';
          const editOpt =
            editing && leaseSheet
              ? contractTypes.find((opt) => opt.id === leaseSheet.contractTypeId)
              : null;
          return (
            <>
              <WizardSheetChrome
                title={
                  editing && editOpt
                    ? interpolate(cr.leaseCardTitle, { months: editOpt.termMonths })
                    : cr.addLease
                }
                subtitle={editing ? cr.editLeaseSubtitle : undefined}
                closeLabel={cr.closePhotoPreview}
                onClose={closeLeaseSheet}
              />

              <ScrollView
                style={styles.layoutSheetScroll}
                contentContainerStyle={styles.leaseSheetBody}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {!editing && <View style={styles.leaseSheetSection}>
                  <Text style={styles.fieldLabel}>
                    {cr.leaseLength}
                    <Text style={styles.requiredMark}> *</Text>
                  </Text>
                  <View style={styles.termRow}>
                    {contractTypes.map((opt) => {
                      const selected = draftTermId === opt.id;
                      const alreadyAdded =
                        !editing &&
                        selectedContractTypeIds.includes(opt.id) &&
                        draftTermId !== opt.id;
                      const disabled = alreadyAdded;
                      return (
                        <SelectionChip
                          key={opt.id}
                          label={interpolate(cr.contractMonths, { months: opt.termMonths })}
                          subtitle={alreadyAdded ? cr.leaseAdded : undefined}
                          selected={selected}
                          disabled={disabled}
                          onPress={() => {
                            if (disabled) return;
                            setDraftTermId(opt.id);
                            setLeaseSheetError('');
                          }}
                          accentColor={accent}
                          inkColor={tokens.colors.primary}
                          style={styles.termChipGrow}
                        />
                      );
                    })}
                  </View>
                  {leaseSheetError === cr.leaseLengthRequired && <Text style={styles.errorText}>{leaseSheetError}</Text>}
                </View>}

                <MobileInput
                  label={cr.monthlyRent}
                  required
                  placeholder="16000"
                  keyboardType="numeric"
                  value={draftRent}
                  error={leaseSheetError === cr.rentAmountRequired ? leaseSheetError : undefined}
                  trailingText={cr.monthlyRentSuffix}
                  onChangeText={(v) => {
                    setDraftRent(digitsOnly(v));
                    setLeaseSheetError('');
                  }}
                />

                <View style={styles.leaseSheetSection}>
                  <Text style={styles.fieldLabel}>
                    {cr.advanceRent}
                    <Text style={styles.requiredMark}> *</Text>
                  </Text>
                  <Text style={styles.hint}>{cr.advanceRentHint}</Text>
                  {renderMonthChips(
                    ADVANCE_MONTH_OPTIONS,
                    draftAdvance,
                    setDraftAdvance,
                  )}
                  {Number(draftRent) > 0 && <Text style={styles.hint}>{interpolate(cr.thbAmount, { amount: formatBaht(Number(draftRent) * draftAdvance) })}</Text>}
                </View>

                <View style={styles.leaseSheetSection}>
                  <Text style={styles.fieldLabel}>
                    {cr.deposit}
                    <Text style={styles.requiredMark}> *</Text>
                  </Text>
                  <Text style={styles.hint}>{cr.depositHint}</Text>
                  {renderMonthChips(
                    DEPOSIT_MONTH_OPTIONS,
                    draftDeposit,
                    setDraftDeposit,
                  )}
                  {Number(draftRent) > 0 && <Text style={styles.hint}>{interpolate(cr.thbAmount, { amount: formatBaht(Number(draftRent) * draftDeposit) })}</Text>}
                </View>

              </ScrollView>
              <WizardSheetFooter
                primaryLabel={editing ? cr.applyLeaseChanges : cr.addTerms}
                onPrimary={commitLeaseSheet}
                secondaryLabel={editing ? cr.removeLease : undefined}
                onSecondary={editing ? removeLeaseFromSheet : undefined}
              />
            </>
          );
        })()}
      </MobileBottomSheet>

      <MobileBottomSheet
        visible={contactSheet != null}
        onClose={dismissContactSheetStep}
        avoidKeyboard
      >
        {contactSheet === 'create' ? (
          <>
            <WizardSheetChrome
              title={cr.newContactTitle}
              closeLabel={cr.closePhotoPreview}
              onClose={dismissContactSheetStep}
            />
            <ScrollView
              style={styles.layoutSheetScroll}
              contentContainerStyle={styles.leaseSheetBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <Text style={styles.hint}>{cr.newContactHint}</Text>
              <MobileInput
                label={cr.ownerName}
                required
                placeholder="e.g. Alex Morgan"
                value={draftOwnerName}
                onChangeText={(v) => {
                  setDraftOwnerName(v);
                  setContactSheetError('');
                }}
                error={
                  contactSheetError === cr.required && !draftOwnerName.trim()
                    ? cr.required
                    : undefined
                }
              />
              <MobileInput
                label={cr.ownerPhone}
                required
                placeholder="e.g. 0812345678"
                keyboardType="phone-pad"
                value={draftOwnerPhone}
                onChangeText={(v) => {
                  setDraftOwnerPhone(v);
                  setContactSheetError('');
                }}
                error={
                  contactSheetError === cr.required && !draftOwnerPhone.trim()
                    ? cr.required
                    : undefined
                }
                helperText={cr.ownerPhoneMatchHint}
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
              <View style={styles.footerNote}>
                <MobileIcon name="warning" size={16} color={tokens.colors.textSecondary} />
                <Text style={styles.footerNoteText}>{cr.sessionSaveNote}</Text>
              </View>
            </ScrollView>
            <WizardSheetFooter
              primaryLabel={cr.ownerUseThis}
              onPrimary={commitCreateContact}
            />
          </>
        ) : (
          <>
            <WizardSheetChrome
              title={cr.chooseContactTitle}
              closeLabel={cr.closePhotoPreview}
              onClose={closeContactSheet}
            />
            <ScrollView
              style={styles.layoutSheetScroll}
              contentContainerStyle={styles.leaseSheetBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <MobileInput
                placeholder={cr.ownerSearchPlaceholder}
                value={ownerQuery}
                onChangeText={(v) => {
                  setOwnerQuery(v);
                  setContactSheetError('');
                }}
              />
              <Pressable
                onPress={() => {
                  setContactSheetError('');
                  openCreateContactSheet();
                }}
                accessibilityRole="button"
                accessibilityLabel={cr.ownerAddNew}
                style={({ pressed }) => [
                  styles.addContactLink,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <MobileIcon
                  name="user-plus"
                  size={18}
                  color={tokens.colors.accent}
                />
                <Text
                  style={[styles.addContactLinkText, { color: tokens.colors.accent }]}
                >
                  {cr.ownerAddNew}
                </Text>
              </Pressable>
              {ownersLoading ? (
                <View style={styles.suggestStatus}>
                  <ActivityIndicator size="small" color={accent} />
                  <Text style={styles.suggestStatusText}>{t.common.loading}</Text>
                </View>
              ) : null}
              {ownersError ? <Text style={styles.errorText}>{ownersError}</Text> : null}
              {!ownersLoading && !ownersError && filteredOwners.length === 0 ? (
                <Text style={styles.hint}>{cr.ownerEmpty}</Text>
              ) : null}
              <View style={styles.contactList}>
                {filteredOwners.map((item) => (
                  <ContactListRow
                    key={item.id}
                    name={item.name}
                    phone={item.phone}
                    roomsLabel={roomsLinkedLabel(item.roomCount)}
                    selected={draftContactId === item.id}
                    accentColor={accent}
                    onPress={() => {
                      setDraftContactId(item.id);
                      setContactSheetError('');
                    }}
                  />
                ))}
              </View>
              {contactSheetError ? (
                <Text style={styles.errorText}>{contactSheetError}</Text>
              ) : null}
            </ScrollView>
            <WizardSheetFooter
              primaryLabel={cr.useSelectedContact}
              onPrimary={commitPickContact}
              primaryDisabled={draftContactId == null}
            />
          </>
        )}
      </MobileBottomSheet>

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
  hubPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 4,
  },
  hubPreviewThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  hubPreviewThumbImg: {
    width: '100%',
    height: '100%',
  },
  hubPreviewCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  hubPreviewTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: tokens.colors.textHeading,
  },
  hubPreviewMeta: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  hubFootnoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  hubFootnoteIcon: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  hubFootnote: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  hubSaveBanner: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.error,
    backgroundColor: '#FEF2F2',
  },
  hubSaveBannerIcon: {
    color: tokens.colors.error,
    fontWeight: '700',
  },
  hubSaveBannerText: {
    color: tokens.colors.error,
    fontWeight: '600',
  },
  formScroll: {
    flex: 1,
    minHeight: 0,
  },
  formScrollContent: {
    paddingBottom: 8,
    gap: 12,
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
  pageTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 22,
    lineHeight: 33,
    fontWeight: '600',
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
    minHeight: 0,
    paddingHorizontal: 4,
    paddingBottom: 8,
    gap: 16,
  },
  sourcePrompt: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 22,
    lineHeight: 33,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  sourceList: {
    gap: 12,
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 76,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  sourceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sourceTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '500',
    color: tokens.colors.textHeading,
  },
  sourceHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: '#52647A',
  },
  sourceNoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
  },
  sourceNote: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  sourceFooter: {
    paddingTop: 8,
  },
  fieldGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldGridItem: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  layoutSection: {
    gap: 16,
  },
  selectRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  selectRowLocked: {
    backgroundColor: tokens.colors.background,
  },
  selectValue: {
    flex: 1,
    minWidth: 0,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.primary,
  },
  selectPlaceholder: {
    color: tokens.colors.placeholder,
  },
  layoutSheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  layoutSheetScroll: {
    flexShrink: 1,
  },
  layoutSheetHeader: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 10,
    paddingBottom: 8,
    gap: 8,
  },
  layoutSheetClose: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layoutSheetTitle: {
    flexShrink: 0,
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '500',
    color: tokens.colors.textHeading,
    marginBottom: 4,
  },
  layoutSheetRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  layoutSheetRowSelected: {
    backgroundColor: tokens.colors.brand[100],
    borderBottomColor: 'transparent',
  },
  layoutSheetRowText: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    color: tokens.colors.textHeading,
  },
  layoutSheetRowTextSelected: {
    fontWeight: '700',
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
    color: tokens.colors.primary,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
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
    minHeight: 52,
    paddingVertical: 12,
  },
  propertyTypeChipText: {
    fontSize: 15,
    lineHeight: 23,
  },
  fieldBlock: {
    gap: 6,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.primary,
    paddingVertical: 10,
  },
  searchClearBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    paddingVertical: 4,
  },
  manualEntryLink: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: tokens.colors.accent,
    textDecorationLine: 'underline',
  },
  addressMultiline: {
    minHeight: 72,
    height: 72,
    paddingVertical: 10,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfField: {
    flex: 1,
    minWidth: 0,
  },
  termRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  termChipGrow: {
    flexGrow: 1,
    flexBasis: '28%',
  },
  addLeaseBtn: {
    alignSelf: 'flex-end',
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  addLeaseBtnText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  addLeaseBtnDisabled: {
    opacity: 0.45,
  },
  leaseList: {
    gap: 10,
  },
  leaseCard: {
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  leaseCardText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  leaseCardTitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '700',
    color: tokens.colors.textHeading,
  },
  leaseCardSub: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    color: tokens.colors.textSecondary,
  },
  leaseCardPrice: {
    fontFamily: tokens.typography.native.body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  leaseSheetFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.border,
  },
  changeContactBtn: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: tokens.colors.white,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  changeContactBtnText: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  addContactLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  addContactLinkText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
  },
  leaseSheetTitleBlock: {
    flexShrink: 0,
    flex: 1,
    minWidth: 0,
    paddingTop: 4,
  },
  leaseSheetSubtitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    color: tokens.colors.textSecondary,
    marginTop: 4,
    marginBottom: 4,
  },
  leaseSheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  leaseSheetSection: {
    gap: 8,
  },
  leaseSheetPrimary: {
    marginTop: 4,
  },
  leaseSheetSecondary: {
    marginTop: 0,
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
    gap: PHOTO_GRID_GAP,
  },
  photosMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  photosMetaLead: {
    flex: 1,
    minWidth: 0,
  },
  photosMetaCount: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  photoTile: {
    width: 140,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  photoTileHit: {
    width: '100%',
    height: '100%',
  },
  photoTileImg: {
    width: '100%',
    height: '100%',
  },
  photoMenuBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  photoEnhanceOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.52)',
  },
  photoEnhanceLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: tokens.colors.white,
  },
  coverBadge: {
    position: 'absolute',
    left: 8,
    top: 8,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  coverBadgeText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  photoAddTile: {
    width: 140,
    height: 140,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
  },
  photoAddLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
    fontWeight: '600',
  },
  photoCard: {
    width: 108,
    gap: 4,
  },
  photoThumb: {
    width: 108,
    height: 108,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  aiBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  aiBadgeText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  contactList: {
    gap: 10,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 72,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  contactCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  contactName: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  contactMeta: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  formBody: {
    gap: 4,
  },
  footerSolo: {
    width: '100%',
    gap: 10,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 2,
  },
  footerNoteText: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  footerCta: {
    minHeight: 48,
    borderRadius: 12,
  },
  footerCtaText: {
    fontSize: 16,
    lineHeight: 24,
  },
  sourceLead: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
    color: tokens.colors.textSecondary,
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
