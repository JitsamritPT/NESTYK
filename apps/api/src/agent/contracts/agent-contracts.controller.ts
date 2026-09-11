import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, AuthRequestUser } from '../../auth/decorators/current-user.decorator';
import { AgentContractsService } from './agent-contracts.service';

@Controller('agent/contracts')
@UseGuards(AuthGuard, RolesGuard)
@Roles('agent')
export class AgentContractsController {
  constructor(private readonly contracts: AgentContractsService) {}
  @Get('types') types() { return this.contracts.types(); }
  @Get('candidates') candidates(@CurrentUser() user: AuthRequestUser) { return this.contracts.candidates(user.id); }
  @Get() list(@CurrentUser() user: AuthRequestUser) { return this.contracts.list(user.id); }
  @Get(':id') view(@CurrentUser() user: AuthRequestUser, @Param('id', ParseIntPipe) id: number) { return this.contracts.view(user.id, id); }
  @Post() create(@CurrentUser() user: AuthRequestUser, @Body() body: unknown) { return this.contracts.create(user.id, body); }
}
