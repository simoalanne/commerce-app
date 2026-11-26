import { sql } from "drizzle-orm";

import type { Db } from "#src/db/client.ts";

import { InsufficientStock } from "./checkout.errors.ts";

type StockAdjustment = {
  sku: string;
  quantity: number;
};

type ProductStockAdjustment = {
  product_id: number | null;
  quantity: number | null;
};

// The (sku, quantity) rows of a VALUES list.
export const buildValues = (items: StockAdjustment[]) =>
  sql.join(
    items.map((item) => sql`(${item.sku}::text, ${item.quantity}::int)`),
    sql`, `,
  );

type StockAdjustmentParams = {
  items: StockAdjustment[];
  transaction: Db;
};

type ProductStockAdjustmentParams = {
  items: ProductStockAdjustment[];
  transaction: Db;
};

export const reserveStockOrThrow = async ({ items, transaction }: StockAdjustmentParams) => {
  if (!items.length) return;

  const values = buildValues(items);
  const { rows: stockResults } = await transaction.execute<{
    sku: string;
    availableStock: number;
    adjusted: boolean;
  }>(sql`
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

  await transaction.execute(sql`
		UPDATE "Product" p
		SET current_stock = p.current_stock - s.quantity,
				reserved_stock = p.reserved_stock - s.quantity
		FROM (VALUES ${buildValues(items)}) AS s(sku, quantity)
		WHERE p.sku = s.sku;
	`);
};

export const releaseReservedStock = async ({ items, transaction }: StockAdjustmentParams) => {
  if (!items.length) return;

  await transaction.execute(sql`
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

  await transaction.execute(sql`
		UPDATE "Product" p
		SET current_stock = p.current_stock + s.quantity
		FROM (
			VALUES ${sql.join(
        restockItems.map((item) => sql`(${item.product_id}::int, ${item.quantity}::int)`),
        sql`, `,
      )}
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
  const { rows } = await transaction.execute<{ sku: string; uncommittedQuantity: number }>(sql`
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
  return rows;
};
