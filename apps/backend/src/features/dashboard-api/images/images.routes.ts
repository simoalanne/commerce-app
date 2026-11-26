import { ImageMetadataSchema } from "@acme/shared/schemas/images";
import { RouteError } from "@rest-rpc/server";
import { and, eq } from "drizzle-orm";
import z from "zod";

import { imageTable } from "#src/db/schema.ts";
import { dashboardRoute, dashboardTxRoute } from "#src/routing/base.ts";
import { ImageUploadInvalidContentType, ImageUploadTooLarge } from "#src/routing/errors.ts";
import { resolveLocalizedFields } from "#src/routing/localizedFields.ts";
import { mergeLocalizedString, toLocalizedString } from "#src/utils/localizedObject.ts";

const imageRoute = dashboardRoute.meta({ access: "ADMIN" });
const imageTxRoute = dashboardTxRoute.meta({ access: "ADMIN" });

const idParams = z.object({ id: z.coerce.number<number>().int().positive() });

const acceptedImageContentTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const maxUploadBytes = 10 * 1024 * 1024;

export const imagesRoutes = {
  getAll: imageRoute.get("/images").handler(async ({ context }) => {
    const images = await context.db.query.image.findMany({
      columns: {
        id: true,
        storageKey: true,
        name: true,
        createdAt: true,
      },
      where: {
        kind: "CMS",
      },
      orderBy: { createdAt: "desc", id: "desc" },
    });
    return images.map((img) => ({
      id: img.id,
      url: context.storage.getPublicUrl(img.storageKey),
      name: img.name,
      createdAt: img.createdAt,
    }));
  }),

  getById: imageRoute
    .get("/images/:id")
    .params(idParams)
    .handler(async ({ params, context }) => {
      const image = await context.db.query.image.findFirst({
        where: { id: params.id, kind: "CMS" },
      });
      if (!image) throw new RouteError("NOT_FOUND", { status: 404 });
      return resolveLocalizedFields(
        { ...image, url: context.storage.getPublicUrl(image.storageKey) },
        context.locale,
      );
    }),

  update: imageTxRoute
    .put("/images/:id")
    .params(idParams)
    .body(ImageMetadataSchema)
    .handler(async ({ params, body, context }) => {
      const existingImage = await context.db.query.image.findFirst({
        where: { id: params.id, kind: "CMS" },
      });
      if (!existingImage) throw new RouteError("NOT_FOUND", { status: 404 });

      const [updated] = await context.db
        .update(imageTable)
        .set({
          name: body.name,
          alt: mergeLocalizedString(existingImage.alt, body.alt, context.locale),
        })
        .where(and(eq(imageTable.id, params.id), eq(imageTable.kind, "CMS")))
        .returning();

      return resolveLocalizedFields(
        { ...updated, url: context.storage.getPublicUrl(updated.storageKey) },
        context.locale,
      );
    }),

  delete: imageTxRoute
    .delete("/images/:id")
    .params(idParams)
    .handler(async ({ params, context }) => {
      const [deleted] = await context.db
        .delete(imageTable)
        .where(and(eq(imageTable.id, params.id), eq(imageTable.kind, "CMS")))
        .returning();
      if (!deleted) throw new RouteError("NOT_FOUND", { status: 404 });

      // Last, so a failed row delete keeps the file and a failed file delete
      // rolls the row back.
      await context.storage.deleteObject(deleted.storageKey);

      return resolveLocalizedFields(
        { ...deleted, url: context.storage.getPublicUrl(deleted.storageKey) },
        context.locale,
      );
    }),

  getPresignedUrl: imageRoute
    .post("/images/presigned-url")
    .body(
      z.object({
        contentType: z.string().trim().min(1),
        contentLength: z.number().int().positive(),
      }),
    )
    .error(ImageUploadInvalidContentType)
    .error(ImageUploadTooLarge)
    .handler(async ({ body, context }) => {
      if (!acceptedImageContentTypes.has(body.contentType)) {
        throw new ImageUploadInvalidContentType();
      }

      if (body.contentLength > maxUploadBytes) {
        throw new ImageUploadTooLarge();
      }

      return await context.storage.getPresignedUrl({
        contentType: body.contentType,
        contentLength: body.contentLength,
      });
    }),

  create: imageTxRoute
    .post("/images")
    .body(
      z.object({
        objectKey: z.string().trim().min(1),
        name: z.string().nullish(),
        alt: z.string().nullish(),
      }),
    )
    .handler(async ({ body, context }) => {
      const [image] = await context.db
        .insert(imageTable)
        .values({
          name: body.name,
          alt: toLocalizedString(body.alt, context.locale),
          storageKey: body.objectKey,
          kind: "CMS",
        })
        .returning();

      return resolveLocalizedFields(
        { ...image, url: context.storage.getPublicUrl(image.storageKey) },
        context.locale,
      );
    }),
};
