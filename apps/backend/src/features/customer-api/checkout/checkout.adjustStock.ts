import type { Prisma } from "@prisma/client";

import { InsufficientStock } from "./checkout.errors.ts";

type StockAdjustment = {
  sku: string;
  quantity: number;
};

type ProductStockAdjustment = {
  product_id: number | null;
  quantity: number | null;
};

// Helper to build the (sku, quantity) rows
export const buildValues = (items: StockAdjustment[]) =>
  items
    .map((i) => {
      const safeSku = i.sku.replace(/'/g, "''");
      return `('${safeSku}'::text, ${i.quantity}::int)`;
    })
    .join(", ");

type StockAdjustmentParams = {
  items: StockAdjustment[];
  transaction: Prisma.TransactionClient;
};

type ProductStockAdjustmentParams = {
  items: ProductStockAdjustment[];
  transaction: Prisma.TransactionClient;
};

export const reserveStockOrThrow = async ({ items, transaction }: StockAdjustmentParams) => {
  if (!items.length) return;

  const values = buildValues(items);
  const stockResults = await transaction.$queryRawUnsafe<
    { sku: string; availableStock: number; adjusted: boolean }[]
  >(`
			WITH requested(sku, quantity) AS (
				VALUES ${values}
			),
			updated AS (
				UPDATE "Product" p
				SET reserved_stock = p.reserved_stock + r.quantity
				FROM requested r
				WHERE p.sku = r.sku
					AND (p.current_stock - p.reserved_stock) >= r.quantity
				RETURNING
					p.sku,
					(p.current_stock - p.reserved_stock) AS "availableStock"
			)
			SELECT 
				r.sku, 
				COALESCE(u."availableStock", p.current_stock - p.reserved_stock) AS "availableStock",
				u.sku IS NOT NULL AS adjusted
			FROM requested r
			JOIN "Product" p ON p.sku = r.sku
			LEFT JOIN updated u ON u.sku = r.sku
		`);
  const failedRecords = stockResults
    .filter((result) => !result.adjusted)
    .map(({ sku, availableStock }) => ({ sku, availableStock }));

  if (failedRecords.length) {
    throw new InsufficientStock({ data: failedRecords });
  }
};

export const commitReservedStock = async ({ items, transaction }: StockAdjustmentParams) => {
  if (!items.length) return;

  await transaction.$executeRawUnsafe(`
		UPDATE "Product" p
		SET current_stock = p.current_stock - s.quantity,
				reserved_stock = p.reserved_stock - s.quantity
		FROM (VALUES ${buildValues(items)}) AS s(sku, quantity)
		WHERE p.sku = s.sku;
	`);
};

export const releaseReservedStock = async ({ items, transaction }: StockAdjustmentParams) => {
  if (!items.length) return;

  await transaction.$executeRawUnsafe(`
		UPDATE "Product" p
		SET reserved_stock = p.reserved_stock - s.quantity
		FROM (VALUES ${buildValues(items)}) AS s(sku, quantity)
		WHERE p.sku = s.sku;
	`);
};

export const restockProductStock = async ({ items, transaction }: ProductStockAdjustmentParams) => {
  const restockItems = items.filter(
    (item): item is { product_id: number; quantity: number } =>
      item.product_id != null && item.quantity != null && item.quantity > 0,
  );
  if (!restockItems.length) return;

  await transaction.$executeRawUnsafe(`
		UPDATE "Product" p
		SET current_stock = p.current_stock + s.quantity
		FROM (
			VALUES ${restockItems
        .map((item) => `(${item.product_id}::int, ${item.quantity}::int)`)
        .join(", ")}
		) AS s(product_id, quantity)
		WHERE p.id = s.product_id;
	`);
};

export const commitAsMuchStockAsPossible = async ({
  items,
  transaction,
}: StockAdjustmentParams) => {
  if (!items.length) return [];

  const values = buildValues(items);
  return await transaction.$queryRawUnsafe<{ sku: string; uncommittedQuantity: number }[]>(`
		WITH requested(sku, quantity) AS (
			VALUES ${values}
		),
		current AS (
			SELECT
				p.id AS product_id,
				p.sku,
				r.quantity,
				GREATEST(p.current_stock - p.reserved_stock, 0) AS available_stock
			FROM "Product" p
			JOIN requested r ON r.sku = p.sku
			FOR UPDATE
		),
		updated AS (
			UPDATE "Product" p
			SET current_stock = p.current_stock - LEAST(current.available_stock, current.quantity)
			FROM current
			WHERE p.id = current.product_id
			RETURNING
				p.sku,
				current.quantity - LEAST(current.available_stock, current.quantity) AS "uncommittedQuantity"
		)
		SELECT
			updated.sku,
			updated."uncommittedQuantity"
		FROM updated
		WHERE updated."uncommittedQuantity" > 0
	`);
};
