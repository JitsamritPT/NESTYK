import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../../auth/guards/auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import {
  CurrentUser,
  AuthRequestUser,
} from "../../auth/decorators/current-user.decorator";
import { AgentContractsService } from "./agent-contracts.service";

@Controller("contracts")
@UseGuards(AuthGuard, RolesGuard)
@Roles("tenant", "owner")
export class PartyContractsController {
  constructor(private readonly contracts: AgentContractsService) {}

  @Get("mine")
  mine(@CurrentUser() user: AuthRequestUser) {
    return this.contracts.listForUser(user.id);
  }

  @Post("mine/:id/sign")
  @HttpCode(HttpStatus.OK)
  sign(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.contracts.signAsParty(user.id, id, body);
  }
}
