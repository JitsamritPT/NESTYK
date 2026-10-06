import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ContractDocumentStorageService } from "../agent/contracts/contract-document-storage.service";
import { OwnerBillsController } from "./owner-bills.controller";
import { TenantBillsController } from "./tenant-bills.controller";
import { TenantBillingService } from "./tenant-billing.service";
import { TenantBillingScheduler } from "./tenant-billing.scheduler";

@Module({
  imports: [AuthModule],
  controllers: [TenantBillsController, OwnerBillsController],
  providers: [TenantBillingService, TenantBillingScheduler, ContractDocumentStorageService],
})
export class BillingModule {}
