import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, AuthRequestUser } from '../../auth/decorators/current-user.decorator';
import { RoomShareLinksService } from './room-share-links.service';

@Controller('agent/listings')
@UseGuards(AuthGuard, RolesGuard)
@Roles('agent')
export class AgentRoomShareLinksController {
  constructor(private readonly shareLinks: RoomShareLinksService) {}

  @Post(':id/share-links')
  create(
    @CurrentUser() user: AuthRequestUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.shareLinks.create(user.id, id, body);
  }

  @Get(':id/share-links')
  list(@CurrentUser() user: AuthRequestUser, @Param('id', ParseIntPipe) id: number) {
    return this.shareLinks.list(user.id, id);
  }

  @Delete(':id/share-links/:linkId')
  revoke(
    @CurrentUser() user: AuthRequestUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('linkId', ParseIntPipe) linkId: number,
  ) {
    return this.shareLinks.revoke(user.id, id, linkId);
  }
}

@Controller('public/room-shares')
export class PublicRoomShareController {
  constructor(private readonly shareLinks: RoomShareLinksService) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  resolve(@Param('token') token: string) {
    return this.shareLinks.publicResolve(token);
  }
}
