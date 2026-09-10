import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, AuthRequestUser } from '../../auth/decorators/current-user.decorator';
import { AgentLeadsService } from './agent-leads.service';

@Controller('agent/leads')
@UseGuards(AuthGuard, RolesGuard)
@Roles('agent')
export class AgentLeadsController {
  constructor(private readonly leads: AgentLeadsService) {}
  @Get('locations') locations(@CurrentUser() user: AuthRequestUser) { return this.leads.locationCatalog(user.id); }
  @Get('visa-types') visaTypes() { return this.leads.listVisaTypes(); }
  @Post() create(@CurrentUser() user: AuthRequestUser, @Body() body: unknown) { return this.leads.create(user.id, body); }
  @Get() list(@CurrentUser() user: AuthRequestUser, @Query() query: { q?: string; page?: string; limit?: string; province?: string; locations?: string; includeUnspecified?: string }) { return this.leads.list(user.id, query); }
  @Get(':id') view(@CurrentUser() user: AuthRequestUser, @Param('id', ParseIntPipe) id: number) { return this.leads.view(user.id, id); }
}
