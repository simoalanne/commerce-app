import type { OrderStatus, Prisma } from "@prisma/client";
import { join, sqltag } from "@prisma/client/runtime/client";
import z from "zod";

import { supportedLocales } from "#src/locales.ts";
import { dashboardRoute } from "#src/routing/base.ts";
import { toResponse } from "#src/routing/toResponse.ts";

import {
  buildSummaryResponse,
  getSummaryWindowBounds,
  type LocalizationCoverageRow,
  type OrderQueryRow,
  type RevenueBySourceQueryRow,
} from "./summary.utils.ts";

const summaryRoute = dashboardRoute.meta({ access: "ADMIN" });

const PAID_REVENUE_STATUSES: OrderStatus[] = ["PAID", "DELIVERED"];

const queryOrderSummaryRows = async (
  db: Prisma.TransactionClient,
  {
    now,
    currentStart,
    previousStart,
  }: {
    now: Date;
    currentStart: Date;
    previousStart: Date;
  },
) =>
  await db.$queryRaw<OrderQueryRow[]>(sqltag`
		WITH filtered AS (
			SELECT created_at, charged_total, status
			FROM "Order"
			WHERE created_at >= ${previousStart} AND created_at < ${now}
		),
		range_series AS (
			SELECT gs::date AS day
			FROM generate_series(${currentStart}::date, ${now}::date, interval '1 day') gs
		),
		daily AS (
			SELECT
				rs.day,
				COALESCE(SUM(
					CASE
						WHEN f.status IN (${join(PAID_REVENUE_STATUSES)})
						THEN f.charged_total
						ELSE 0
					END
				), 0)::numeric AS revenue,
				COUNT(f.created_at)::bigint AS orders
			FROM range_series rs
			LEFT JOIN filtered f
				ON f.created_at >= rs.day
				AND f.created_at < rs.day + interval '1 day'
				AND f.created_at >= ${currentStart}
			GROUP BY rs.day
			ORDER BY rs.day
		)
		SELECT
			COALESCE(SUM(
				CASE
					WHEN f.created_at >= ${currentStart}
						AND f.created_at < ${now}
						AND f.status IN (${join(PAID_REVENUE_STATUSES)})
					THEN f.charged_total
					ELSE 0
				END
			), 0)::numeric AS current_revenue,
			COALESCE(SUM(
				CASE
					WHEN f.created_at >= ${previousStart}
						AND f.created_at < ${currentStart}
						AND f.status IN (${join(PAID_REVENUE_STATUSES)})
					THEN f.charged_total
					ELSE 0
				END
			), 0)::numeric AS previous_revenue,
			COUNT(*) FILTER (
				WHERE f.created_at >= ${currentStart}
					AND f.created_at < ${now}
					AND f.status IN (${join(PAID_REVENUE_STATUSES)})
			)::int AS current_paid_orders,
			COUNT(*) FILTER (
				WHERE f.created_at >= ${previousStart}
					AND f.created_at < ${currentStart}
					AND f.status IN (${join(PAID_REVENUE_STATUSES)})
			)::int AS previous_paid_orders,
			(
				SELECT json_agg(
					json_build_object(
						'date', to_char(day, 'YYYY-MM-DD'),
						'revenue', revenue,
						'orders', orders
					)
					ORDER BY day
				)
				FROM daily
			) AS chart
		FROM filtered f
	`);

const queryRevenueBySourceRows = async (
  db: Prisma.TransactionClient,
  {
    now,
    currentStart,
  }: {
    now: Date;
    currentStart: Date;
  },
) =>
  await db.$queryRaw<RevenueBySourceQueryRow>(sqltag`
		SELECT
			COALESCE(NULLIF(BTRIM(f.utm_source), ''), 'direct') AS source,
			COALESCE(SUM(
				CASE
					WHEN f.status IN (${join(PAID_REVENUE_STATUSES)})
					THEN f.charged_total
					ELSE 0
				END
			), 0)::numeric AS revenue,
			COUNT(*) FILTER (
				WHERE f.status IN (${join(PAID_REVENUE_STATUSES)})
			)::int AS orders
		FROM "Order" f
		WHERE f.created_at >= ${currentStart}
			AND f.created_at < ${now}
		GROUP BY COALESCE(NULLIF(BTRIM(f.utm_source), ''), 'direct')
		ORDER BY revenue DESC, orders DESC, source ASC
	`);

const queryActiveProductCountRows = async (db: Prisma.TransactionClient) =>
  await db.product.count({
    where: {
      storefront_visibility: "ACTIVE",
    },
  });

const queryCustomerCountRows = async (db: Prisma.TransactionClient) =>
  await db.customerAccount.count();

const queryLocalizationCoverageRows = async (db: Prisma.TransactionClient) =>
  await db.$queryRaw<LocalizationCoverageRow[]>(sqltag`
		WITH fields AS (
			SELECT name::jsonb AS content FROM "Category"
			UNION ALL
			SELECT name::jsonb FROM "Product"
			UNION ALL
			SELECT headline::jsonb FROM "Product"
			UNION ALL
			SELECT full_description::jsonb FROM "Product"
			UNION ALL
			SELECT name::jsonb FROM "Tag"
			UNION ALL
			SELECT slogan::jsonb FROM "Vendor"
			UNION ALL
			SELECT story::jsonb FROM "Vendor"
			UNION ALL
			SELECT tags::jsonb FROM "Vendor"
		),
		localizable AS (
			SELECT row_number() OVER () AS field_id, content FROM fields
		),
		marked AS (
			SELECT
				field_id,
				locale,
				CASE
					WHEN jsonb_typeof(content->locale) = 'string' THEN btrim(content->>locale) <> ''
					WHEN jsonb_typeof(content->locale) = 'array' THEN jsonb_array_length(content->locale) > 0
					ELSE false
				END AS ok
			FROM localizable CROSS JOIN unnest(${[...supportedLocales]}::text[]) AS locales(locale)
		),
		by_locale AS (
			SELECT locale, COUNT(*) FILTER (WHERE ok)::int AS completed FROM marked GROUP BY locale
		),
		by_field AS (
			SELECT bool_and(ok) AS all_ok FROM marked GROUP BY field_id
		)
		SELECT
			(SELECT COUNT(*)::int FROM localizable) AS out_of,
			(SELECT COUNT(*) FILTER (WHERE all_ok)::int FROM by_field) AS completed_all_locales,
			(SELECT jsonb_object_agg(locale, completed) FROM by_locale) AS completed_by_locale
	`);

export const summaryRoutes = {
  get: summaryRoute
    .get("/summary")
    .query(
      z.object({
        days: z.coerce.number<number>().int().min(7).max(90).optional(),
      }),
    )
    .handler(async ({ query, context }) => {
      const { days = 90 } = query;
      const now = new Date();
      const { currentStart, previousStart } = getSummaryWindowBounds(now, days);

      const [orderRows, revenueBySourceRows, activeProducts, customers, localizationRows] =
        await Promise.all([
          queryOrderSummaryRows(context.db, {
            now,
            currentStart,
            previousStart,
          }),
          queryRevenueBySourceRows(context.db, {
            now,
            currentStart,
          }),
          queryActiveProductCountRows(context.db),
          queryCustomerCountRows(context.db),
          queryLocalizationCoverageRows(context.db),
        ]);

      return toResponse(
        buildSummaryResponse({
          now,
          days,
          orderRow: orderRows[0],
          revenueBySource: revenueBySourceRows,
          activeProducts,
          customers,
          localizationRow: localizationRows[0],
        }),
      );
    }),
};
