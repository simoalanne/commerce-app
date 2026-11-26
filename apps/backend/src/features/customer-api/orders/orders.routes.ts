import { RouteError } from "@rest-rpc/server";
import z from "zod";

import type { ObjectStorageProvider } from "#src/integrations/object-storage/objectStorage.provider.ts";
import { customerRoute } from "#src/routing/base.ts";
import { resolveLocalizedFields } from "#src/routing/localizedFields.ts";
import { getFirstLinkedImageUrl } from "#src/utils/imageUrl.ts";
import { relevantOrderStatuses } from "#src/utils/orderStatus.ts";
import { generateOrderInvoicePdf } from "#src/utils/pdf/generateOrderInvoicePdf.ts";
import { generateRefundReceiptPdf } from "#src/utils/pdf/generateRefundReceiptPdf.ts";

import { createOrderCapabilityJwt, verifyOrderCapabilityJwt } from "./orderCapabilities.ts";
import {
  buildOrderPricing,
  findRelevantOrderById,
  findRelevantOrders,
  type RelevantOrder,
} from "./relevantOrders.ts";

function buildOrderDetail(storage: ObjectStorageProvider, order: RelevantOrder) {
  const details = order.orderDetails;
  const pricing = buildOrderPricing(order);

  const firstVendorItem = order.orderItems[0];
  const vendorName = firstVendorItem?.vendorName ?? "Unknown Farm";
  const vendorImage = getFirstLinkedImageUrl(storage, firstVendorItem?.vendor?.images);
  const items = order.orderItems.map((item) => ({
    sku: item.sku,
    name: item.product?.name ?? item.name,
    imageUrl: getFirstLinkedImageUrl(storage, item.product?.images),
    quantity: item.quantity,
    refundedQuantity: order.refundSummary.refundedQuantityByOrderItemId.get(item.id) ?? 0,
    unitPriceCents: item.unitSalesPriceCents,
  }));

  return {
    id: order.id,
    status: order.status,
    totalCents: order.chargedTotalCents,
    pricing,
    refundReceipts: order.refundReceipts,
    createdAt: order.createdAt,
    vendorName,
    vendorImage,
    hasSubmittedReview: order.hasSubmittedReview,
    orderDetails: {
      items,
      delivery: {
        addressLabel: details.delivery.addressLabel,
        instructions: details.delivery.instructions,
      },
    },
  };
}

// TODO: consider if we should just have single getById method that works either
// via authContext and orderId or via issued short-lived token. This would simplify the API and reduce duplication of logic.
export const ordersRoutes = {
  getById: customerRoute
    .meta({ access: "AUTHENTICATED" })
    .get("/orders/:orderId")
    .params(z.object({ orderId: z.coerce.number<number>().int().positive() }))
    .handler(async ({ params, context }) => {
      const order = await findRelevantOrderById(context.db, {
        orderId: params.orderId,
        customerId: context.authContext.customerId,
      });

      return resolveLocalizedFields(buildOrderDetail(context.storage, order), context.locale);
    }),

  downloadInvoice: customerRoute
    .meta({ access: "AUTHENTICATED" })
    .get("/orders/:orderId/invoice")
    .params(z.object({ orderId: z.coerce.number<number>().int().positive() }))
    .handler(async ({ params, context, respond }) => {
      const { body, contentType, filename } = await generateOrderInvoicePdf(
        { db: context.db, config: context.config },
        {
          access: "customer",
          orderId: params.orderId,
          customerId: context.authContext.customerId,
          locale: context.locale,
        },
      );

      return respond(new Blob([new Uint8Array(body)], { type: contentType }), {
        headers: {
          "content-type": contentType,
          "content-disposition": `attachment; filename="${filename.replaceAll('"', '\\"')}"`,
        },
      });
    }),

  downloadRefundReceipt: customerRoute
    .meta({ access: "AUTHENTICATED" })
    .get("/orders/:orderId/refunds/:refundId/receipt")
    .params(
      z.object({
        orderId: z.coerce.number<number>().int().positive(),
        refundId: z.coerce.number<number>().int().positive(),
      }),
    )
    .handler(async ({ params, context, respond }) => {
      const { body, contentType, filename } = await generateRefundReceiptPdf(
        { db: context.db, config: context.config },
        {
          access: "customer",
          orderId: params.orderId,
          refundId: params.refundId,
          customerId: context.authContext.customerId,
          locale: context.locale,
        },
      );

      return respond(new Blob([new Uint8Array(body)], { type: contentType }), {
        headers: {
          "content-type": contentType,
          "content-disposition": `attachment; filename="${filename.replaceAll('"', '\\"')}"`,
        },
      });
    }),

  getGuestById: customerRoute
    .get("/orders/guest")
    .query(z.object({ token: z.string().trim().min(1) }))
    .handler(async ({ query, context }) => {
      const capability = await verifyOrderCapabilityJwt(context.config, {
        token: query.token,
        scope: "order:read",
      });
      const order = await findRelevantOrderById(context.db, {
        orderId: capability.orderId,
      });
      return resolveLocalizedFields(buildOrderDetail(context.storage, order), context.locale);
    }),

  createAccessToken: customerRoute
    .meta({ access: "OPTIONAL_AUTHENTICATED" })
    .post("/orders/access-token")
    .body(
      z.object({
        orderId: z.number().int().positive().optional(),
        token: z.uuid().optional(),
        scope: z.enum(["order:read", "order:review"]),
      }),
    )
    .handler(async ({ body, context }) => {
      const { orderId, token, scope } = body;

      if (token) {
        return await createOrderCapabilityJwt(
          { db: context.db, config: context.config },
          { token, scope },
        );
      }

      const { authContext } = context;
      if (!authContext.isAuthenticated || !orderId) {
        throw new RouteError("NOT_FOUND", { status: 404 });
      }

      const order = await context.db.query.order.findFirst({
        where: {
          id: orderId,
          customerId: authContext.customerId,
          status: scope === "order:review" ? "SHIPPED" : { in: [...relevantOrderStatuses] },
        },
        columns: { id: true },
      });
      if (!order) throw new RouteError("NOT_FOUND", { status: 404 });

      return await createOrderCapabilityJwt(
        { db: context.db, config: context.config },
        { orderId, customerId: authContext.customerId, scope },
      );
    }),

  list: customerRoute
    .meta({ access: "AUTHENTICATED" })
    .get("/orders")
    .handler(async ({ context }) => {
      const orders = await findRelevantOrders(context.db, {
        customerId: context.authContext.customerId,
      });

      return resolveLocalizedFields(
        orders.map((order) => {
          const detail = buildOrderDetail(context.storage, order);
          const [itemPreview, ...remainingItems] = detail.orderDetails.items;

          return {
            id: detail.id,
            status: detail.status,
            totalCents: detail.totalCents,
            createdAt: detail.createdAt,
            vendorName: detail.vendorName,
            vendorImage: detail.vendorImage,
            itemPreview: itemPreview ?? null,
            remainingItemCount: remainingItems.length,
            hasSubmittedReview: detail.hasSubmittedReview,
          };
        }),
        context.locale,
      );
    }),
};
