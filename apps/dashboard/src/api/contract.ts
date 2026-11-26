import { extractContract } from "@rest-rpc/core";
import { dashboardRouter } from "backend/routes";

// Imported as a macro: runs at build time, so only the extracted JSON ships.
export const getContract = () => extractContract(dashboardRouter);
