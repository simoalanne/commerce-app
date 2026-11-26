import type { InferClientResponse } from "@rest-rpc/core";

import type { queryUtils } from "@/context/ApiClientContext";

type CustomerRow = InferClientResponse<typeof queryUtils.customers.getAll.fetch>["body"][number];

const splitCustomerName = (fullName: string) => {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return {
      firstName: "",
      lastName: "",
    };
  }

  const firstSpaceIndex = trimmed.indexOf(" ");
  if (firstSpaceIndex === -1) {
    return {
      firstName: trimmed,
      lastName: "",
    };
  }

  return {
    firstName: trimmed.slice(0, firstSpaceIndex).trim(),
    lastName: trimmed.slice(firstSpaceIndex + 1).trim(),
  };
};

const escapeCsvField = (value: string) => {
  const normalized = value.replaceAll('"', '""');
  if (
    normalized.includes(",") ||
    normalized.includes('"') ||
    normalized.includes("\n") ||
    normalized.includes("\r")
  ) {
    return `"${normalized}"`;
  }

  return normalized;
};

export const buildCustomerCsv = (customers: CustomerRow[]) => {
  const rows = customers.map((customer) => {
    const { firstName, lastName } = splitCustomerName(customer.fullName);
    return [customer.email, firstName, lastName].map(escapeCsvField).join(",");
  });

  return ["email,firstName,lastName", ...rows].join("\r\n");
};

export const downloadCustomerCsv = (customers: CustomerRow[]) => {
  const csv = buildCustomerCsv(customers);
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "customers.csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
