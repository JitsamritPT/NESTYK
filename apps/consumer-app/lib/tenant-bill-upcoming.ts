import type { PartyContract, TenantNextBill } from "@nestyk/types";

/** Use the server's future schedule rather than the dashboard's oldest unpaid bill. */
export function upcomingTenantBill(
  contracts: PartyContract[],
): TenantNextBill | null {
  const lease = contracts
    .filter(
      (row) =>
        row.formKind === "lease" &&
        row.status === "active" &&
        row.myParties.includes("tenant") &&
        row.nextRentBill &&
        Number(row.monthlyRent) > 0,
    )
    .sort(
      (a, b) =>
        a.nextRentBill!.issueDate.localeCompare(b.nextRentBill!.issueDate) ||
        a.id - b.id,
    )[0];
  if (!lease) return null;
  return {
    ...lease.nextRentBill!,
    billId: null,
    leaseContractId: lease.id,
    property: lease.property,
    room: lease.room,
    amount: Number(lease.monthlyRent),
    status: "upcoming",
  };
}
