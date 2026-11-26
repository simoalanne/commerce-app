import crypto from "node:crypto";

type HmacParams = Record<string, string | number>;

export const calculateHmac = (secret: string, hparams: HmacParams, body?: string) => {
  const hmacPayload = Object.keys(hparams)
    .sort()
    .map((key) => [key, hparams[key]].join(":"))
    .concat(body ?? "")
    .join("\n");

  return crypto.createHmac("sha256", secret).update(hmacPayload).digest("hex");
};

export const validateHmac = (hparams: HmacParams, signature: string, secretKey: string) => {
  const hmac = calculateHmac(secretKey, hparams);
  return hmac === signature;
};

export const encodeMD5 = (data: string) => crypto.createHash("md5").update(data).digest("hex");
