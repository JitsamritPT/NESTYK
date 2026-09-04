export * from './base.entity';
export * from './user.entity';
export * from './master-role.entity';
export * from './user-role.entity';
export * from './property.entity';
export * from './property-owner.entity';
export * from './master-room-status.entity';
export * from './master-layout.entity';
export * from './master-facilities-group.entity';
export * from './master-facility.entity';
export * from './rent-room.entity';
export * from './room-media.entity';
export * from './rent-room-document.entity';
export * from './room-layout-value.entity';
export * from './room-facility.entity';
export * from './lead.entity';
export * from './tenant.entity';
export * from './room-tenancy.entity';
export * from './lease-contract.entity';

import { UserEntity } from './user.entity';
import { MasterRoleEntity } from './master-role.entity';
import { UserRoleEntity } from './user-role.entity';
import { PropertyEntity } from './property.entity';
import { PropertyOwnerEntity } from './property-owner.entity';
import { MasterRoomStatusEntity } from './master-room-status.entity';
import { MasterLayoutEntity } from './master-layout.entity';
import { MasterFacilitiesGroupEntity } from './master-facilities-group.entity';
import { MasterFacilityEntity } from './master-facility.entity';
import { RentRoomEntity } from './rent-room.entity';
import { RoomMediaEntity } from './room-media.entity';
import { RentRoomDocumentEntity } from './rent-room-document.entity';
import { RoomLayoutValueEntity } from './room-layout-value.entity';
import { RoomFacilityEntity } from './room-facility.entity';
import { LeadEntity } from './lead.entity';
import { TenantEntity } from './tenant.entity';
import { RoomTenancyEntity } from './room-tenancy.entity';
import { LeaseContractEntity } from './lease-contract.entity';

/** All blueprint tables (docs/new-project) — public schema via DATABASE_URL */
export const ALL_ENTITIES = [
  UserEntity,
  MasterRoleEntity,
  UserRoleEntity,
  PropertyEntity,
  PropertyOwnerEntity,
  MasterRoomStatusEntity,
  MasterLayoutEntity,
  MasterFacilitiesGroupEntity,
  MasterFacilityEntity,
  RentRoomEntity,
  RoomMediaEntity,
  RentRoomDocumentEntity,
  RoomLayoutValueEntity,
  RoomFacilityEntity,
  LeadEntity,
  TenantEntity,
  RoomTenancyEntity,
  LeaseContractEntity,
];

/** @deprecated use ALL_ENTITIES */
export const ALL_PROPTECH_ENTITIES = ALL_ENTITIES;
