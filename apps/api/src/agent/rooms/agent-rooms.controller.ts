import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
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
  constructor(private readonly roomsService: AgentRoomsService) {}

  @Get('properties')
  listProperties(@CurrentUser() user: AuthRequestUser) {
    return this.roomsService.listProperties(user.id);
  }

  @Get('property-types')
  listPropertyTypes() {
    return this.roomsService.listPropertyTypes();
  }

  @Get('property-owners')
  listPropertyOwners(@CurrentUser() user: AuthRequestUser) {
    return this.roomsService.listPropertyOwners(user.id);
  }

  @Post('media/upload')
  @HttpCode(HttpStatus.OK)
  uploadMedia(@Body() body: { mediaUrl?: string }) {
    // Local greenfield: client uploads elsewhere (or later Supabase Storage),
    // this endpoint accepts a final URL for wizard wiring.
    if (!body.mediaUrl?.trim()) {
      return { ok: false, message: 'mediaUrl required (storage upload TBD)' };
    }
    return { mediaUrl: body.mediaUrl.trim() };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthRequestUser, @Body() body: CreateRoomBody) {
    return this.roomsService.createScoutRoom(user, body);
  }
}
