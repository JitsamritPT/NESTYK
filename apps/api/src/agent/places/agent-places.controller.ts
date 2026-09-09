import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AgentPlacesService } from './agent-places.service';

@Controller('agent/places')
@UseGuards(AuthGuard, RolesGuard)
@Roles('agent', 'owner')
export class AgentPlacesController {
  constructor(private readonly placesService: AgentPlacesService) {}

  @Get('autocomplete')
  autocomplete(
    @Query('q') q?: string,
    @Query('language') language?: string,
  ) {
    return this.placesService.autocomplete(q ?? '', this.normalizeLanguage(language));
  }

  @Get('nearby')
  nearby(@Query('latitude') latitude?: string, @Query('longitude') longitude?: string, @Query('language') language?: string) {
    return this.placesService.nearby(latitude?.trim() ? Number(latitude) : NaN, longitude?.trim() ? Number(longitude) : NaN, this.normalizeLanguage(language));
  }

  @Get('details')
  details(
    @Query('placeId') placeId?: string,
    @Query('language') language?: string,
  ) {
    return this.placesService.details(placeId ?? '', this.normalizeLanguage(language));
  }

  private normalizeLanguage(language?: string): string {
    const value = (language || 'th').toLowerCase().slice(0, 2);
    if (value === 'en' || value === 'zh' || value === 'ja' || value === 'th') {
      return value;
    }
    return 'th';
  }
}
