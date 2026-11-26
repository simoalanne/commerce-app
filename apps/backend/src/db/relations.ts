// Relations for the relational queries. The keys of `tables` are the names
// under db.query (db.query.product), and the relation names match the former
// Prisma relation fields, so `with` produces the same shapes `include` did.
import { defineRelations } from "drizzle-orm";

import {
  adminAccountTable,
  adminActionLogTable,
  categoryTable,
  contactSubmissionTable,
  customerAccountTable,
  customerAddressTable,
  customerFavoriteProductTable,
  customerFavoriteVendorTable,
  customerSavedCartItemTable,
  imageTable,
  legalDocumentTable,
  orderItemTable,
  orderTable,
  productImageTable,
  productSearchDocumentTable,
  productTable,
  productTagTable,
  promotionCodeTable,
  refundItemTable,
  refundTable,
  reviewTable,
  tagTable,
  userTable,
  vendorImageTable,
  vendorTable,
  webhookSubscriptionTable,
} from "./schema.ts";

const tables = {
  user: userTable,
  contactSubmission: contactSubmissionTable,
  customerAccount: customerAccountTable,
  customerFavoriteProduct: customerFavoriteProductTable,
  customerFavoriteVendor: customerFavoriteVendorTable,
  customerSavedCartItem: customerSavedCartItemTable,
  adminAccount: adminAccountTable,
  promotionCode: promotionCodeTable,
  order: orderTable,
  orderItem: orderItemTable,
  refund: refundTable,
  refundItem: refundItemTable,
  customerAddress: customerAddressTable,
  category: categoryTable,
  product: productTable,
  vendor: vendorTable,
  image: imageTable,
  legalDocument: legalDocumentTable,
  productImage: productImageTable,
  tag: tagTable,
  productTag: productTagTable,
  vendorImage: vendorImageTable,
  webhookSubscription: webhookSubscriptionTable,
  review: reviewTable,
  productSearchDocument: productSearchDocumentTable,
  adminActionLog: adminActionLogTable,
};

export const relations = defineRelations(tables, (r) => ({
  user: {
    customerAccount: r.one.customerAccount({
      from: r.user.clerkId,
      to: r.customerAccount.userId,
    }),
    adminAccount: r.one.adminAccount({
      from: r.user.clerkId,
      to: r.adminAccount.userId,
    }),
  },
  customerAccount: {
    user: r.one.user({
      from: r.customerAccount.userId,
      to: r.user.clerkId,
      optional: false,
    }),
    addresses: r.many.customerAddress({
      from: r.customerAccount.id,
      to: r.customerAddress.customerId,
    }),
    orders: r.many.order({ from: r.customerAccount.id, to: r.order.customerId }),
    reviews: r.many.review({ from: r.customerAccount.id, to: r.review.customerId }),
    customerFavoriteProducts: r.many.customerFavoriteProduct({
      from: r.customerAccount.id,
      to: r.customerFavoriteProduct.customerAccountId,
    }),
    customerFavoriteVendors: r.many.customerFavoriteVendor({
      from: r.customerAccount.id,
      to: r.customerFavoriteVendor.customerAccountId,
    }),
    customerSavedCartItems: r.many.customerSavedCartItem({
      from: r.customerAccount.id,
      to: r.customerSavedCartItem.customerAccountId,
    }),
  },
  customerFavoriteProduct: {
    customerAccount: r.one.customerAccount({
      from: r.customerFavoriteProduct.customerAccountId,
      to: r.customerAccount.id,
      optional: false,
    }),
    product: r.one.product({
      from: r.customerFavoriteProduct.productId,
      to: r.product.id,
      optional: false,
    }),
  },
  customerFavoriteVendor: {
    customerAccount: r.one.customerAccount({
      from: r.customerFavoriteVendor.customerAccountId,
      to: r.customerAccount.id,
      optional: false,
    }),
    vendor: r.one.vendor({
      from: r.customerFavoriteVendor.vendorId,
      to: r.vendor.id,
      optional: false,
    }),
  },
  customerSavedCartItem: {
    customerAccount: r.one.customerAccount({
      from: r.customerSavedCartItem.customerAccountId,
      to: r.customerAccount.id,
      optional: false,
    }),
    product: r.one.product({
      from: r.customerSavedCartItem.productId,
      to: r.product.id,
      optional: false,
    }),
  },
  adminAccount: {
    user: r.one.user({ from: r.adminAccount.userId, to: r.user.clerkId, optional: false }),
    adminActionLogs: r.many.adminActionLog({
      from: r.adminAccount.id,
      to: r.adminActionLog.adminAccountId,
    }),
  },
  order: {
    customer: r.one.customerAccount({ from: r.order.customerId, to: r.customerAccount.id }),
    reviews: r.many.review({ from: r.order.id, to: r.review.orderId }),
    orderItems: r.many.orderItem({ from: r.order.id, to: r.orderItem.orderId }),
    refunds: r.many.refund({ from: r.order.id, to: r.refund.orderId }),
  },
  orderItem: {
    product: r.one.product({ from: r.orderItem.productId, to: r.product.id }),
    vendor: r.one.vendor({ from: r.orderItem.vendorId, to: r.vendor.id }),
    order: r.one.order({ from: r.orderItem.orderId, to: r.order.id, optional: false }),
    refundItems: r.many.refundItem({ from: r.orderItem.id, to: r.refundItem.orderItemId }),
  },
  refund: {
    order: r.one.order({ from: r.refund.orderId, to: r.order.id, optional: false }),
    refundItems: r.many.refundItem({ from: r.refund.id, to: r.refundItem.refundId }),
  },
  refundItem: {
    refund: r.one.refund({ from: r.refundItem.refundId, to: r.refund.id, optional: false }),
    orderItem: r.one.orderItem({
      from: r.refundItem.orderItemId,
      to: r.orderItem.id,
      optional: false,
    }),
  },
  customerAddress: {
    customer: r.one.customerAccount({
      from: r.customerAddress.customerId,
      to: r.customerAccount.id,
      optional: false,
    }),
  },
  category: {
    image: r.one.image({ from: r.category.imageId, to: r.image.id, optional: false }),
    products: r.many.product({ from: r.category.id, to: r.product.categoryId }),
  },
  product: {
    tags: r.many.productTag({ from: r.product.id, to: r.productTag.productId }),
    images: r.many.productImage({ from: r.product.id, to: r.productImage.productId }),
    category: r.one.category({ from: r.product.categoryId, to: r.category.id }),
    vendor: r.one.vendor({ from: r.product.vendorId, to: r.vendor.id, optional: false }),
    reviews: r.many.review({ from: r.product.id, to: r.review.productId }),
    orderItems: r.many.orderItem({ from: r.product.id, to: r.orderItem.productId }),
    customerFavoriteProducts: r.many.customerFavoriteProduct({
      from: r.product.id,
      to: r.customerFavoriteProduct.productId,
    }),
    customerSavedCartItems: r.many.customerSavedCartItem({
      from: r.product.id,
      to: r.customerSavedCartItem.productId,
    }),
  },
  vendor: {
    images: r.many.vendorImage({ from: r.vendor.id, to: r.vendorImage.vendorId }),
    products: r.many.product({ from: r.vendor.id, to: r.product.vendorId }),
    reviews: r.many.review({ from: r.vendor.id, to: r.review.vendorId }),
    orderItems: r.many.orderItem({ from: r.vendor.id, to: r.orderItem.vendorId }),
    customerFavoriteVendors: r.many.customerFavoriteVendor({
      from: r.vendor.id,
      to: r.customerFavoriteVendor.vendorId,
    }),
  },
  image: {
    products: r.many.productImage({ from: r.image.id, to: r.productImage.imageId }),
    categories: r.many.category({ from: r.image.id, to: r.category.imageId }),
    vendors: r.many.vendorImage({ from: r.image.id, to: r.vendorImage.imageId }),
    review: r.one.review({ from: r.image.reviewId, to: r.review.id }),
  },
  productImage: {
    product: r.one.product({
      from: r.productImage.productId,
      to: r.product.id,
      optional: false,
    }),
    image: r.one.image({ from: r.productImage.imageId, to: r.image.id, optional: false }),
  },
  tag: {
    products: r.many.productTag({ from: r.tag.id, to: r.productTag.tagId }),
  },
  productTag: {
    product: r.one.product({ from: r.productTag.productId, to: r.product.id, optional: false }),
    tag: r.one.tag({ from: r.productTag.tagId, to: r.tag.id, optional: false }),
  },
  vendorImage: {
    vendor: r.one.vendor({ from: r.vendorImage.vendorId, to: r.vendor.id, optional: false }),
    image: r.one.image({ from: r.vendorImage.imageId, to: r.image.id, optional: false }),
  },
  review: {
    customer: r.one.customerAccount({ from: r.review.customerId, to: r.customerAccount.id }),
    order: r.one.order({ from: r.review.orderId, to: r.order.id }),
    vendor: r.one.vendor({ from: r.review.vendorId, to: r.vendor.id }),
    product: r.one.product({ from: r.review.productId, to: r.product.id }),
    images: r.many.image({ from: r.review.id, to: r.image.reviewId }),
  },
  adminActionLog: {
    adminAccount: r.one.adminAccount({
      from: r.adminActionLog.adminAccountId,
      to: r.adminAccount.id,
    }),
  },
}));
