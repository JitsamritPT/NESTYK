import { Controller, Get, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, AuthRequestUser } from '../../auth/decorators/current-user.decorator';
import { AgentListingsService } from './agent-listings.service';

@Controller('agent/listings')
@UseGuards(AuthGuard, RolesGuard)
@Roles('agent')
export class AgentListingsController {
  constructor(private readonly listingsService: AgentListingsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthRequestUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('visibility') visibility?: string,
  ) {
    if (!user?.id) {
      throw new UnauthorizedException('Call POST /auth/sync first');
    }
    return this.listingsService.listMine(user.id, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      q,
      visibility,
    });
  }
}
