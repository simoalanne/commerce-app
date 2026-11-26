import type { InferClientRequest, InferClientResponse } from "@rest-rpc/core";

import type { Api } from "@/api/client";

export type ProductSummary = InferClientResponse<Api["products"]["getAll"]>["body"][number];
export type ProductDetail = InferClientResponse<Api["products"]["getById"]>["body"];
export type VendorSummary = InferClientResponse<Api["vendors"]["getAll"]>["body"][number];
export type Category = InferClientResponse<Api["categories"]["getAll"]>["body"][number];
export type StorefrontContext = InferClientResponse<Api["storefront"]["getContext"]>["body"];
export type CustomerAddress = InferClientResponse<Api["user"]["addresses"]["list"]>["body"][number];
export type AddressDraft = InferClientRequest<Api["user"]["addresses"]["create"]>["body"];
