import { mkdir, writeFile } from "node:fs/promises";

import { extractContract } from "@rest-rpc/server";

import { customerRouter } from "#src/routes.ts";

// The online store's bundler (Turbopack) has no macros, so it imports this
// file. The dashboard extracts its contract with a Vite macro instead.
const outDir = new URL("../generated/contracts/", import.meta.url);

await mkdir(outDir, { recursive: true });
await writeFile(new URL("customer.json", outDir), JSON.stringify(extractContract(customerRouter)));
