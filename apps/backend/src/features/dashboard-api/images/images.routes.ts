import { ImageMetadataSchema } from "@acme/shared/schemas/images";
import z from "zod";

import { type AppContext, dashboardRoute } from "#src/routing/base.ts";
import { ImageUploadInvalidContentType, ImageUploadTooLarge } from "#src/routing/errors.ts";
import { toResponse } from "#src/routing/toResponse.ts";
import { mergeLocalizedString, toLocalizedString } from "#src/utils/localizedObject.ts";

const imageRoute = dashboardRoute.meta({ access: "ADMIN" });

const idParams = z.object({ id: z.coerce.number<number>().int().positive() });

const acceptedImageContentTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const maxUploadBytes = 10 * 1024 * 1024;

const toImageResponse = (
  storage: AppContext["storage"],
  image: {
    id: number;
    storage_key: string;
    name?: string | null;
    alt?: PrismaJson.LocalizedString | null;
    created_at: Date;
  },
) => ({
  ...image,
  url: storage.getPublicUrl(image.storage_key),
});

export const imagesRoutes = {
  getAll: imageRoute.get("/images").handler(async ({ context }) => {
    const images = await context.db.image.findMany({
      select: {
        id: true,
        storage_key: true,
        name: true,
        created_at: true,
      },
      where: {
        kind: "CMS",
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
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
      const image = await context.db.image.findFirstOrThrow({
        where: { id: params.id, kind: "CMS" },
      });
      return toResponse(toImageResponse(context.storage, image), context.locale);
    }),

  update: imageRoute
    .put("/images/:id")
    .params(idParams)
    .body(ImageMetadataSchema)
    .handler(async ({ params, body, context }) => {
      const existingImage = await context.db.image.findUniqueOrThrow({
        where: { id: params.id, kind: "CMS" },
      });

      const updated = await context.runAppTransaction(async ({ tx, logAdminAction }) => {
        const updated = await tx.image.update({
          where: { id: params.id, kind: "CMS" },
          data: {
            name: body.name,
            alt: mergeLocalizedString(existingImage.alt, body.alt, context.locale),
          },
        });

        await logAdminAction({
          actor: context.authContext,
          action: "UPDATE",
          entity: "image",
          entityId: params.id,
          before: existingImage,
          after: updated,
        });

        return updated;
      });
      return toResponse(toImageResponse(context.storage, updated), context.locale);
    }),

  delete: imageRoute
    .delete("/images/:id")
    .params(idParams)
    .handler(async ({ params, context }) => {
      const image = await context.db.image.findFirstOrThrow({
        where: { id: params.id, kind: "CMS" },
      });

      await context.storage.deleteObject(image.storage_key);

      const deleted = await context.runAppTransaction(async ({ tx, logAdminAction }) => {
        const deleted = await tx.image.delete({
          where: { id: image.id, kind: "CMS" },
        });

        await logAdminAction({
          actor: context.authContext,
          action: "DELETE",
          entity: "image",
          entityId: params.id,
          before: deleted,
        });

        return deleted;
      });
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

  create: imageRoute
    .post("/images")
    .body(
      z.object({
        objectKey: z.string().trim().min(1),
        name: z.string().nullish(),
        alt: z.string().nullish(),
      }),
    )
    .handler(async ({ body, context }) => {
      const image = await context.runAppTransaction(async ({ tx, logAdminAction }) => {
        const image = await tx.image.create({
          data: {
            name: body.name,
            alt: toLocalizedString(body.alt, context.locale),
            storage_key: body.objectKey,
            kind: "CMS",
          },
        });

        await logAdminAction({
          actor: context.authContext,
          action: "CREATE",
          entity: "image",
          entityId: image.id,
          after: image,
        });

        return image;
      });
      return toResponse(toImageResponse(context.storage, image), context.locale);
    }),
};
