export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

// The filename the server sets on a file response, e.g. from
// `headers["content-disposition"]` of a rest-rpc client response.
export const getContentDispositionFilename = (contentDisposition: string | undefined) =>
  contentDisposition?.match(/filename="([^"]+)"/i)?.[1];
