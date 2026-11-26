import {
  type ClientFor,
  type ClientHeaders,
  type CreateClientOptions,
  contractFromJson,
  createClient,
} from "@rest-rpc/core";
import contract from "backend/contracts/customer.json";
import type { customerRouter } from "backend/routes";

// Turbopack has no macros, so the contract is a JSON file written by
// `pnpm --filter backend contract`.
const customerContract = contractFromJson<typeof customerRouter>(contract);

export type Api = ClientFor<typeof customerRouter>;

export const createCustomerClient = <const THeaders extends ClientHeaders>(
  options: Omit<CreateClientOptions<THeaders>, "origin">,
) =>
  createClient(customerContract, {
    origin: process.env.NEXT_PUBLIC_API_URL,
    ...options,
  });
