import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PropertyEntity } from '../entities/property.entity';
import { PropertyOwnerEntity } from '../entities/property-owner.entity';
import { MasterRoomStatusEntity } from '../entities/master-room-status.entity';
import { MasterLayoutEntity } from '../entities/master-layout.entity';
import { MasterFacilityEntity } from '../entities/master-facility.entity';
import { MasterFacilitiesGroupEntity } from '../entities/master-facilities-group.entity';
import { RentRoomEntity } from '../entities/rent-room.entity';
import { RoomMediaEntity } from '../entities/room-media.entity';
import { RoomLayoutValueEntity } from '../entities/room-layout-value.entity';
import { RoomFacilityEntity } from '../entities/room-facility.entity';
import { RentRoomDocumentEntity } from '../entities/rent-room-document.entity';
import { AgentRoomsController } from './rooms/agent-rooms.controller';
import { AgentRoomsService } from './rooms/agent-rooms.service';
import { AgentListingsController } from './listings/agent-listings.controller';
import { AgentListingsService } from './listings/agent-listings.service';
import { AgentPlacesController } from './places/agent-places.controller';
import { AgentPlacesService } from './places/agent-places.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      PropertyEntity,
      PropertyOwnerEntity,
      MasterRoomStatusEntity,
      MasterLayoutEntity,
      MasterFacilityEntity,
      MasterFacilitiesGroupEntity,
      RentRoomEntity,
      RoomMediaEntity,
      RoomLayoutValueEntity,
      RoomFacilityEntity,
      RentRoomDocumentEntity,
    ]),
  ],
  controllers: [AgentRoomsController, AgentListingsController, AgentPlacesController],
  providers: [AgentRoomsService, AgentListingsService, AgentPlacesService],
  exports: [AgentRoomsService, AgentListingsService, AgentPlacesService],
})
export class AgentModule {}
