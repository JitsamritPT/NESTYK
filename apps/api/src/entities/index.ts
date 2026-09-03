export * from './base.entity';
export * from './user.entity';
export * from './user-role.entity';
export * from './listing.entity';
export * from './listing-image.entity';
export * from './contract.entity';
export * from './bill.entity';
export * from './service-ticket.entity';

import { UserEntity } from './user.entity';
import { UserRoleEntity } from './user-role.entity';
import { ListingEntity } from './listing.entity';
import { ListingImageEntity } from './listing-image.entity';
import { ContractEntity } from './contract.entity';
import { BillEntity } from './bill.entity';
import { ServiceTicketEntity } from './service-ticket.entity';

export const ALL_PROPTECH_ENTITIES = [
  UserEntity,
  UserRoleEntity,
  ListingEntity,
  ListingImageEntity,
  ContractEntity,
  BillEntity,
  ServiceTicketEntity,
];
