import type { PartyContract } from "@nestyk/types";
import { apiGet, apiPost } from "./api";

export function listMyContracts(): Promise<PartyContract[]> {
  return apiGet("/contracts/mine");
}

export function signMyContract(
  id: number,
  party: "owner" | "tenant",
  signaturePng: string,
): Promise<PartyContract> {
  return apiPost(`/contracts/mine/${id}/sign`, { party, signaturePng });
}
