import { ImageMetadataSchema } from "@acme/shared/schemas/images";
import { RouteError } from "@rest-rpc/server";
import { and, eq } from "drizzle-orm";
import z from "zod";

import type { LocalizedString } from "#src/db/json.ts";
import { imageTable } from "#src/db/schema.ts";
import { type AppContext, dashboardRoute, dashboardTxRoute } from "#src/routing/base.ts";
import { ImageUploadInvalidContentType, ImageUploadTooLarge } from "#src/routing/errors.ts";
import { toResponse } from "#src/routing/toResponse.ts";
import { logAdminAction } from "#src/utils/adminActionLog.ts";
import { mergeLocalizedString, toLocalizedString } from "#src/utils/localizedObject.ts";

const imageRoute = dashboardRoute.meta({ access: "ADMIN" });
const imageTxRoute = dashboardTxRoute.meta({ access: "ADMIN" });

const idParams = z.object({ id: z.coerce.number<number>().int().positive() });

const acceptedImageContentTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const maxUploadBytes = 10 * 1024 * 1024;

const toImageResponse = (
  storage: AppContext["storage"],
  image: {
    id: number;
    storage_key: string;
    name?: string | null;
    alt?: LocalizedString | null;
    created_at: Date;
  },
) => ({
  ...image,
  url: storage.getPublicUrl(image.storage_key),
});

export const imagesRoutes = {
  getAll: imageRoute.get("/images").handler(async ({ context }) => {
    const images = await context.db.query.image.findMany({
      columns: {
        id: true,
        storage_key: true,
        name: true,
        created_at: true,
      },
      where: {
        kind: "CMS",
      },
      orderBy: { created_at: "desc", id: "desc" },
    });
    return toResponse(
      images.map((img) => ({
        id: img.id,
        url: context.storage.getPublicUrl(img.storage_key),
        name: img.name,
        created_at: img.created_at,
      })),
      context.locale,
    );
  }),

  getById: imageRoute
    .get("/images/:id")
    .params(idParams)
    .handler(async ({ params, context }) => {
      const image = await context.db.query.image.findFirst({
        where: { id: params.id, kind: "CMS" },
      });
      if (!image) throw new RouteError("NOT_FOUND", { status: 404 });
      return toResponse(toImageResponse(context.storage, image), context.locale);
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

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "UPDATE",
        entity: "image",
        entityId: params.id,
        before: existingImage,
        after: updated,
      });

      return toResponse(toImageResponse(context.storage, updated), context.locale);
    }),

  delete: imageTxRoute
    .delete("/images/:id")
    .params(idParams)
    .handler(async ({ params, context }) => {
      const image = await context.db.query.image.findFirst({
        where: { id: params.id, kind: "CMS" },
      });
      if (!image) throw new RouteError("NOT_FOUND", { status: 404 });

      const [deleted] = await context.db
        .delete(imageTable)
        .where(and(eq(imageTable.id, image.id), eq(imageTable.kind, "CMS")))
        .returning();

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "DELETE",
        entity: "image",
        entityId: params.id,
        before: deleted,
      });

      // Last, so a failed row delete keeps the file and a failed file delete
      // rolls the row back.
      await context.storage.deleteObject(image.storage_key);

      return toResponse(toImageResponse(context.storage, deleted), context.locale);
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

      return toResponse(
        await context.storage.getPresignedUrl({
          contentType: body.contentType,
          contentLength: body.contentLength,
        }),
        context.locale,
      );
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
          storage_key: body.objectKey,
          kind: "CMS",
        })
        .returning();

      await logAdminAction(context.db, {
        actor: context.authContext,
        action: "CREATE",
        entity: "image",
        entityId: image.id,
        after: image,
      });

      return toResponse(toImageResponse(context.storage, image), context.locale);
    }),
};
