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
    customer_account: r.one.customerAccount({
      from: r.user.clerk_id,
      to: r.customerAccount.user_id,
    }),
    admin_account: r.one.adminAccount({
      from: r.user.clerk_id,
      to: r.adminAccount.user_id,
    }),
  },
  customerAccount: {
    user: r.one.user({
      from: r.customerAccount.user_id,
      to: r.user.clerk_id,
      optional: false,
    }),
    addresses: r.many.customerAddress({
      from: r.customerAccount.id,
      to: r.customerAddress.customer_id,
    }),
    orders: r.many.order({ from: r.customerAccount.id, to: r.order.customer_id }),
    reviews: r.many.review({ from: r.customerAccount.id, to: r.review.customer_id }),
    customerFavoriteProducts: r.many.customerFavoriteProduct({
      from: r.customerAccount.id,
      to: r.customerFavoriteProduct.customer_account_id,
    }),
    customerFavoriteVendors: r.many.customerFavoriteVendor({
      from: r.customerAccount.id,
      to: r.customerFavoriteVendor.customer_account_id,
    }),
    customerSavedCartItems: r.many.customerSavedCartItem({
      from: r.customerAccount.id,
      to: r.customerSavedCartItem.customer_account_id,
    }),
  },
  customerFavoriteProduct: {
    customer_account: r.one.customerAccount({
      from: r.customerFavoriteProduct.customer_account_id,
      to: r.customerAccount.id,
      optional: false,
    }),
    product: r.one.product({
      from: r.customerFavoriteProduct.product_id,
      to: r.product.id,
      optional: false,
    }),
  },
  customerFavoriteVendor: {
    customer_account: r.one.customerAccount({
      from: r.customerFavoriteVendor.customer_account_id,
      to: r.customerAccount.id,
      optional: false,
    }),
    vendor: r.one.vendor({
      from: r.customerFavoriteVendor.vendor_id,
      to: r.vendor.id,
      optional: false,
    }),
  },
  customerSavedCartItem: {
    customer_account: r.one.customerAccount({
      from: r.customerSavedCartItem.customer_account_id,
      to: r.customerAccount.id,
      optional: false,
    }),
    product: r.one.product({
      from: r.customerSavedCartItem.product_id,
      to: r.product.id,
      optional: false,
    }),
  },
  adminAccount: {
    user: r.one.user({ from: r.adminAccount.user_id, to: r.user.clerk_id, optional: false }),
    adminActionLogs: r.many.adminActionLog({
      from: r.adminAccount.id,
      to: r.adminActionLog.admin_account_id,
    }),
  },
  order: {
    customer: r.one.customerAccount({ from: r.order.customer_id, to: r.customerAccount.id }),
    reviews: r.many.review({ from: r.order.id, to: r.review.order_id }),
    order_items: r.many.orderItem({ from: r.order.id, to: r.orderItem.order_id }),
    refunds: r.many.refund({ from: r.order.id, to: r.refund.order_id }),
  },
  orderItem: {
    product: r.one.product({ from: r.orderItem.product_id, to: r.product.id }),
    vendor: r.one.vendor({ from: r.orderItem.vendor_id, to: r.vendor.id }),
    order: r.one.order({ from: r.orderItem.order_id, to: r.order.id, optional: false }),
    refundItems: r.many.refundItem({ from: r.orderItem.id, to: r.refundItem.order_item_id }),
  },
  refund: {
    order: r.one.order({ from: r.refund.order_id, to: r.order.id, optional: false }),
    refund_items: r.many.refundItem({ from: r.refund.id, to: r.refundItem.refund_id }),
  },
  refundItem: {
    refund: r.one.refund({ from: r.refundItem.refund_id, to: r.refund.id, optional: false }),
    order_item: r.one.orderItem({
      from: r.refundItem.order_item_id,
      to: r.orderItem.id,
      optional: false,
    }),
  },
  customerAddress: {
    customer: r.one.customerAccount({
      from: r.customerAddress.customer_id,
      to: r.customerAccount.id,
      optional: false,
    }),
  },
  category: {
    image: r.one.image({ from: r.category.image_id, to: r.image.id, optional: false }),
    products: r.many.product({ from: r.category.id, to: r.product.category_id }),
  },
  product: {
    tags: r.many.productTag({ from: r.product.id, to: r.productTag.product_id }),
    images: r.many.productImage({ from: r.product.id, to: r.productImage.product_id }),
    category: r.one.category({ from: r.product.category_id, to: r.category.id }),
    vendor: r.one.vendor({ from: r.product.vendor_id, to: r.vendor.id, optional: false }),
    reviews: r.many.review({ from: r.product.id, to: r.review.product_id }),
    order_items: r.many.orderItem({ from: r.product.id, to: r.orderItem.product_id }),
    customerFavoriteProducts: r.many.customerFavoriteProduct({
      from: r.product.id,
      to: r.customerFavoriteProduct.product_id,
    }),
    customerSavedCartItems: r.many.customerSavedCartItem({
      from: r.product.id,
      to: r.customerSavedCartItem.product_id,
    }),
  },
  vendor: {
    images: r.many.vendorImage({ from: r.vendor.id, to: r.vendorImage.vendor_id }),
    products: r.many.product({ from: r.vendor.id, to: r.product.vendor_id }),
    reviews: r.many.review({ from: r.vendor.id, to: r.review.vendor_id }),
    order_items: r.many.orderItem({ from: r.vendor.id, to: r.orderItem.vendor_id }),
    customerFavoriteVendors: r.many.customerFavoriteVendor({
      from: r.vendor.id,
      to: r.customerFavoriteVendor.vendor_id,
    }),
  },
  image: {
    products: r.many.productImage({ from: r.image.id, to: r.productImage.image_id }),
    categories: r.many.category({ from: r.image.id, to: r.category.image_id }),
    vendors: r.many.vendorImage({ from: r.image.id, to: r.vendorImage.image_id }),
    review: r.one.review({ from: r.image.review_id, to: r.review.id }),
  },
  productImage: {
    product: r.one.product({
      from: r.productImage.product_id,
      to: r.product.id,
      optional: false,
    }),
    image: r.one.image({ from: r.productImage.image_id, to: r.image.id, optional: false }),
  },
  tag: {
    products: r.many.productTag({ from: r.tag.id, to: r.productTag.tag_id }),
  },
  productTag: {
    product: r.one.product({ from: r.productTag.product_id, to: r.product.id, optional: false }),
    tag: r.one.tag({ from: r.productTag.tag_id, to: r.tag.id, optional: false }),
  },
  vendorImage: {
    vendor: r.one.vendor({ from: r.vendorImage.vendor_id, to: r.vendor.id, optional: false }),
    image: r.one.image({ from: r.vendorImage.image_id, to: r.image.id, optional: false }),
  },
  review: {
    customer: r.one.customerAccount({ from: r.review.customer_id, to: r.customerAccount.id }),
    order: r.one.order({ from: r.review.order_id, to: r.order.id }),
    vendor: r.one.vendor({ from: r.review.vendor_id, to: r.vendor.id }),
    product: r.one.product({ from: r.review.product_id, to: r.product.id }),
    images: r.many.image({ from: r.review.id, to: r.image.review_id }),
  },
  adminActionLog: {
    admin_account: r.one.adminAccount({
      from: r.adminActionLog.admin_account_id,
      to: r.adminAccount.id,
    }),
  },
}));
