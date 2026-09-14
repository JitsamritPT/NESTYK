import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AuthGuard } from "../../auth/guards/auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import {
  CurrentUser,
  AuthRequestUser,
} from "../../auth/decorators/current-user.decorator";
import { AgentContractsService } from "./agent-contracts.service";
import { MAX_CONTRACT_DOCUMENT_BYTES } from "./contract-document-storage.service";

@Controller("agent/contracts")
@UseGuards(AuthGuard, RolesGuard)
@Roles("agent")
export class AgentContractsController {
  constructor(private readonly contracts: AgentContractsService) {}
  @Get("types") types() {
    return this.contracts.types();
  }
  @Get("candidates") candidates(@CurrentUser() user: AuthRequestUser) {
    return this.contracts.candidates(user.id);
  }
  @Get() list(@CurrentUser() user: AuthRequestUser) {
    return this.contracts.list(user.id);
  }
  @Get(":id") view(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.contracts.view(user.id, id);
  }
  @Post() create(@CurrentUser() user: AuthRequestUser, @Body() body: unknown) {
    return this.contracts.create(user.id, body);
  }
  @Post(":id/reservation-preview")
  @HttpCode(HttpStatus.OK)
  reservationPreview(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.contracts.reservationPdf(user.id, id, false);
  }
  @Post(":id/generate-reservation")
  @HttpCode(HttpStatus.OK)
  generateReservation(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.contracts.reservationPdf(user.id, id, true);
  }
  @Post(":id/sign")
  @HttpCode(HttpStatus.OK)
  sign(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.contracts.sign(user.id, id, body);
  }
  @Post(":id/documents/:kind")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_CONTRACT_DOCUMENT_BYTES, files: 1, fields: 0 },
    }),
  )
  uploadDocument(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
    @Param("kind") kind: string,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
  ) {
    return this.contracts.uploadDocument(user.id, id, kind, file);
  }
}
