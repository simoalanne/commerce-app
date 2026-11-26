"use client";

import type { InferClientRequest, InferClientResponse } from "@rest-rpc/core";
import { useMutation } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useState } from "react";

import type { Api } from "@/api/client";
import { useRouter } from "@/i18n/navigation";
import { useApiClient } from "@/providers/ApiClientProvider";

import styles from "./ReviewYourOrderPage.module.css";

type OrderReviewPage = InferClientResponse<Api["orderReviews"]["getByOrder"]>["body"];

type ProductReviewable = Extract<OrderReviewPage["reviewables"][number], { kind: "PRODUCT" }>;

type VendorReviewable = Extract<OrderReviewPage["reviewables"][number], { kind: "VENDOR" }>;

type SaveReviewRequest = InferClientRequest<
  Api["orderReviews"]["saveByOrder"]
>["body"]["reviews"][number];

type ReviewDraft = {
  rating: number;
  comment: string;
  objectKey: string | null;
  imageUrl: string | null;
  file: File | null;
  showReviewerName: boolean;
};

type ReviewDraftState = {
  products: Record<number, ReviewDraft>;
  vendors: Record<number, ReviewDraft>;
  store: ReviewDraft;
};

type ReviewYourOrderPageClientProps = {
  initialPage: OrderReviewPage;
  orderId: number;
  accessToken: string;
};

const emptyDraft = (): ReviewDraft => ({
  rating: 0,
  comment: "",
  objectKey: null,
  imageUrl: null,
  file: null,
  showReviewerName: true,
});

const createDraftState = (page: OrderReviewPage): ReviewDraftState => {
  return {
    products: Object.fromEntries(
      page.reviewables
        .filter((reviewable): reviewable is ProductReviewable => reviewable.kind === "PRODUCT")
        .map((product) => [product.productId, emptyDraft()]),
    ),
    vendors: Object.fromEntries(
      page.reviewables
        .filter((reviewable): reviewable is VendorReviewable => reviewable.kind === "VENDOR")
        .map((vendor) => [vendor.vendorId, emptyDraft()]),
    ),
    store: emptyDraft(),
  };
};

const toSubmittedReview = (review: ReviewDraft): SaveReviewRequest["review"] => {
  return {
    rating: review.rating,
    comment: review.comment.trim() || null,
    showReviewerName: review.showReviewerName,
    objectKey: review.objectKey,
  };
};

const hasRating = (draft: ReviewDraft) => draft.rating > 0;

const buildSavePayload = (page: OrderReviewPage, draft: ReviewDraftState): SaveReviewRequest[] => {
  const reviews: SaveReviewRequest[] = [];

  for (const reviewable of page.reviewables) {
    if (reviewable.kind === "PRODUCT") {
      const productDraft = draft.products[reviewable.productId];
      if (!hasRating(productDraft)) {
        continue;
      }

      reviews.push({
        kind: "PRODUCT",
        productId: reviewable.productId,
        review: toSubmittedReview(productDraft),
      });

      continue;
    }

    if (reviewable.kind === "VENDOR") {
      const vendorDraft = draft.vendors[reviewable.vendorId];

      if (!hasRating(vendorDraft)) {
        continue;
      }

      reviews.push({
        kind: "VENDOR",
        vendorId: reviewable.vendorId,
        review: toSubmittedReview(vendorDraft),
      });

      continue;
    }

    if (!hasRating(draft.store)) {
      continue;
    }

    reviews.push({
      kind: "STORE_EXPERIENCE",
      review: toSubmittedReview(draft.store),
    });
  }

  return reviews;
};

export default function ReviewYourOrderPageClient({
  initialPage,
  orderId,
  accessToken,
}: ReviewYourOrderPageClientProps) {
  const t = useTranslations("orderReviewPage");
  const { queryUtils } = useApiClient();
  const router = useRouter();

  const [draft, setDraft] = useState<ReviewDraftState>(() => createDraftState(initialPage));
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const alreadySubmitted = initialPage.reviewables.some((reviewable) => reviewable.review != null);
  const saveMutation = useMutation(queryUtils.orderReviews.saveByOrder.mutationOptions());
  const pendingReviewsCount = buildSavePayload(initialPage, draft).length;

  const handleSubmit = async () => {
    if (pendingReviewsCount === 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setUploadError(null);

    const uploadImage = async (review: ReviewDraft) => {
      if (!review.file) {
        return review;
      }

      const uploadSession = await queryUtils.orderReviews.getImagePresignedUrl.fetch({
        query: { token: accessToken },
        body: {
          contentType: review.file.type,
          contentLength: review.file.size,
        },
      });

      const uploadResponse = await fetch(uploadSession.body.uploadUrl, {
        method: uploadSession.body.uploadMethod,
        headers: uploadSession.body.uploadHeaders,
        body: review.file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }

      return {
        ...review,
        objectKey: uploadSession.body.objectKey,
        imageUrl: uploadSession.body.publicUrl,
        file: null,
      } satisfies ReviewDraft;
    };

    try {
      const uploadedDraft: ReviewDraftState = {
        products: Object.fromEntries(
          await Promise.all(
            Object.entries(draft.products).map(async ([productId, review]) => [
              productId,
              await uploadImage(review),
            ]),
          ),
        ),
        vendors: Object.fromEntries(
          await Promise.all(
            Object.entries(draft.vendors).map(async ([vendorId, review]) => [
              vendorId,
              await uploadImage(review),
            ]),
          ),
        ),
        store: await uploadImage(draft.store),
      };

      setDraft(uploadedDraft);

      await saveMutation.mutateAsync({
        query: { token: accessToken },
        body: {
          reviews: buildSavePayload(initialPage, uploadedDraft),
        },
      });

      router.replace("/account/orders");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("uploadError"));
      setIsSubmitting(false);
    }
  };

  const products = initialPage.reviewables.filter(
    (reviewable): reviewable is ProductReviewable => reviewable.kind === "PRODUCT",
  );

  const vendors = initialPage.reviewables.filter(
    (reviewable): reviewable is VendorReviewable => reviewable.kind === "VENDOR",
  );

  useEffect(() => {
    if (alreadySubmitted) router.replace("/account/orders");
  }, [alreadySubmitted, router]);

  if (alreadySubmitted) return null;

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.hero}>
          <div>
            <h1 className={styles.title}>{t("title", { orderId })}</h1>
          </div>
        </div>

        {saveMutation.isError ? <p className={styles.errorBanner}>{t("saveError")}</p> : null}
        {uploadError ? <p className={styles.errorBanner}>{uploadError}</p> : null}

        <div className={styles.sections}>
          <div className={styles.productGrid}>
            {products.map((product) => (
              <ReviewCard
                key={product.productId}
                title={product.productName}
                subtitle={product.vendorName}
                imageUrl={product.productImageUrl}
                commentLabel={t("productCommentLabel")}
                allowImageUpload={true}
                value={draft.products[product.productId]}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    products: {
                      ...current.products,
                      [product.productId]: value,
                    },
                  }))
                }
              />
            ))}

            {vendors.map((vendor) => (
              <ReviewCard
                key={vendor.vendorId}
                title={vendor.vendorName}
                commentLabel={t("vendorCommentLabel")}
                allowImageUpload={false}
                value={draft.vendors[vendor.vendorId]}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    vendors: {
                      ...current.vendors,
                      [vendor.vendorId]: value,
                    },
                  }))
                }
              />
            ))}
          </div>

          <div className={styles.singleCardRow}>
            <ReviewCard
              title={t("storePrompt")}
              commentLabel={t("storeCommentLabel")}
              allowImageUpload={false}
              value={draft.store}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  store: value,
                }))
              }
            />
          </div>
        </div>

        <div className={styles.footer}>
          <p className={styles.footerText}>
            {pendingReviewsCount > 0
              ? t("readyToSave", { count: pendingReviewsCount })
              : t("emptyHint")}
          </p>
          <button
            type="button"
            className={styles.submitButton}
            onClick={() => void handleSubmit()}
            disabled={pendingReviewsCount === 0 || isSubmitting}
          >
            {isSubmitting ? t("savePending") : t("save")}
          </button>
        </div>
      </section>
    </main>
  );
}

type ReviewCardProps = {
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  commentLabel: string;
  allowImageUpload: boolean;
  value: ReviewDraft;
  onChange: (value: ReviewDraft) => void;
};

function ReviewCard({
  title,
  subtitle,
  imageUrl,
  commentLabel,
  allowImageUpload,
  value,
  onChange,
}: ReviewCardProps) {
  const t = useTranslations("orderReviewPage");

  return (
    <article className={styles.reviewCard}>
      <div className={styles.reviewCardHeader}>
        <div>
          <p className={styles.reviewTitle}>{title}</p>
          {subtitle ? <p className={styles.reviewSubtitle}>{subtitle}</p> : null}
        </div>
        {imageUrl ? (
          <div className={styles.reviewImageWrapper}>
            <Image className={styles.reviewImage} src={imageUrl} alt={title} fill />
          </div>
        ) : null}
      </div>

      <div className={styles.starRow}>
        {[1, 2, 3, 4, 5].map((rating) => {
          const active = rating <= value.rating;

          return (
            <button
              key={rating}
              type="button"
              className={`${styles.starButton} ${active ? styles.starButtonActive : ""}`.trim()}
              onClick={() =>
                onChange({
                  ...value,
                  rating,
                })
              }
              aria-label={t("ratingValue", { value: rating })}
            >
              <Star size={20} fill={active ? "currentColor" : "none"} />
            </button>
          );
        })}
      </div>

      <label className={styles.commentField}>
        <span className={styles.commentLabel}>{commentLabel}</span>
        <textarea
          className={styles.commentInput}
          value={value.comment}
          onChange={(event) =>
            onChange({
              ...value,
              comment: event.target.value,
            })
          }
          rows={4}
          placeholder={t("commentPlaceholder")}
        />
      </label>

      <label className={styles.nameVisibilityField}>
        <input
          type="checkbox"
          checked={value.showReviewerName}
          onChange={(event) =>
            onChange({
              ...value,
              showReviewerName: event.target.checked,
            })
          }
        />
        <span>{t("showReviewerName")}</span>
      </label>

      {allowImageUpload ? (
        <div className={styles.uploadField}>
          <label className={styles.commentLabel} htmlFor={`${title}-image-upload`}>
            {t("imageLabel")}
          </label>
          <input
            id={`${title}-image-upload`}
            className={styles.fileInput}
            type="file"
            aria-label={t("ariaLabels.uploadImage")}
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }

              onChange({
                ...value,
                imageUrl: URL.createObjectURL(file),
                file,
              });
            }}
          />
          {value.imageUrl ? (
            <div className={styles.uploadPreviewWrapper}>
              <Image
                className={styles.uploadPreviewImage}
                src={value.imageUrl}
                alt={t("imageLabel")}
                fill
                unoptimized={value.imageUrl.startsWith("blob:")}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
