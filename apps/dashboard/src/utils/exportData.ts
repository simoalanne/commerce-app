import { downloadBlob } from "@acme/shared";

type ExportFormat = "csv" | "json";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);

const normalizeExportValue = (value: unknown): string | number | boolean | null => {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  if (isPlainObject(value)) {
    return JSON.stringify(value);
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return String(value);
};

const flattenEntry = (
  value: unknown,
  parentKey?: string,
): Record<string, string | number | boolean | null> => {
  if (Array.isArray(value)) {
    if (!parentKey) {
      return {};
    }

    return {
      [parentKey]: value
        .map((item) => normalizeExportValue(item))
        .map((item) => (item == null ? "" : String(item)))
        .join(", "),
    };
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value).flatMap(([key, nestedValue]) =>
      Object.entries(flattenEntry(nestedValue, parentKey ? `${parentKey}.${key}` : key)),
    );
    return Object.fromEntries(entries);
  }

  if (!parentKey) {
    return {};
  }

  return {
    [parentKey]: normalizeExportValue(value),
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

const buildCsv = (rows: Record<string, unknown>[]) => {
  const flattenedRows = rows.map((row) => flattenEntry(row));
  const headers = Array.from(new Set(flattenedRows.flatMap((row) => Object.keys(row))));

  const csvRows = flattenedRows.map((row) =>
    headers
      .map((header) => {
        const value = row[header];
        return escapeCsvField(value == null ? "" : String(value));
      })
      .join(","),
  );

  return [headers.join(","), ...csvRows].join("\r\n");
};

const downloadTextContentAsFile = ({
  content,
  filename,
  type,
  bom,
}: {
  content: string;
  filename: string;
  type: string;
  bom?: string;
}) => {
  const blob = new Blob([`${bom ?? ""}${content}`], { type });
  downloadBlob(blob, filename);
};

const slugifyFilenamePart = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "") || "export";

export const downloadDataExport = <TRow extends Record<string, unknown>>({
  rows,
  format,
  filenameBase,
}: {
  rows: TRow[];
  format: ExportFormat;
  filenameBase: string;
}) => {
  if (format === "json") {
    downloadTextContentAsFile({
      content: JSON.stringify(rows, null, 2),
      filename: `${filenameBase}.json`,
      type: "application/json;charset=utf-8;",
    });
    return;
  }

  downloadTextContentAsFile({
    content: buildCsv(rows),
    filename: `${filenameBase}.csv`,
    type: "text/csv;charset=utf-8;",
    bom: "\uFEFF",
  });
};

export const buildExportFilenameBase = (value: string) => slugifyFilenamePart(value);
