import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_ROOM_PHOTO_BYTES, RoomPhotoStorageService } from './room-photo-storage.service';
import {
  Body,
  UploadedFile,
  UseInterceptors,
  Req,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Patch,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, AuthRequestUser } from '../../auth/decorators/current-user.decorator';
import { AgentRoomsService } from './agent-rooms.service';
import { CreateRoomBody } from './dto/create-room.dto';

@Controller('agent/rooms')
@UseGuards(AuthGuard, RolesGuard)
@Roles('agent')
export class AgentRoomsController {
  constructor(private readonly roomsService: AgentRoomsService, private readonly photos: RoomPhotoStorageService) {}

  @Get('properties')
  listProperties(@CurrentUser() user: AuthRequestUser) {
    return this.roomsService.listProperties(user.id);
  }

  @Get('property-types')
  listPropertyTypes() {
    return this.roomsService.listPropertyTypes();
  }

  @Get('contract-types')
  listContractTypes() {
    return this.roomsService.listContractTypes();
  }

  @Get('room-types')
  listRoomTypes() {
    return this.roomsService.listRoomTypes();
  }

  @Get('contacts')
  listContacts(@CurrentUser() user: AuthRequestUser) {
    return this.roomsService.listContacts(user.id);
  }

  @Get('property-owners')
  listPropertyOwners(@CurrentUser() user: AuthRequestUser) {
    return this.roomsService.listPropertyOwners(user.id);
  }

  @Post('media/upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ROOM_PHOTO_BYTES, files: 1, fields: 0 } }))
  uploadMedia(@CurrentUser() user: AuthRequestUser,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
    @Req() request: { protocol: string; get(name: string): string }) {
    return this.photos.upload(user.id, file, `${request.protocol}://${request.get('host')}`);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthRequestUser, @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateRoomBody, @Req() request: { protocol: string; get(name: string): string }) {
    return this.roomsService.createScoutRoom(user, body, `${request.protocol}://${request.get('host')}`, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthRequestUser, @Body() body: CreateRoomBody,
    @Req() request: { protocol: string; get(name: string): string }) {
    return this.roomsService.createScoutRoom(user, body, `${request.protocol}://${request.get('host')}`);
  }
}
