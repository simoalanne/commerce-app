import type { InferClientResponse } from "@rest-rpc/core";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AsyncBoundary } from "@/components/async-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { queryUtils } from "@/context/ApiClientContext";

type ReviewStatus = "ALL" | "PENDING" | "APPROVED" | "REJECTED";
type ReviewItem = InferClientResponse<typeof queryUtils.reviews.getAll.fetch>["body"][number];

const reviewStatuses: ReviewStatus[] = ["ALL", "PENDING", "APPROVED", "REJECTED"];

const statusBadgeClassName: Record<Exclude<ReviewStatus, "ALL">, string> = {
  PENDING: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  APPROVED: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  REJECTED: "bg-rose-100 text-rose-800 hover:bg-rose-100",
};

const reviewKindLabel: Record<ReviewItem["kind"], string> = {
  VENDOR: "Vendor review",
  PRODUCT: "Product review",
  STORE_EXPERIENCE: "Store experience",
};

export default function ReviewsPage() {
  return (
    <AsyncBoundary loadingFallback={<ReviewsLoadingState />}>
      <ReviewsContent />
    </AsyncBoundary>
  );
}

function ReviewsContent() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ReviewStatus>("PENDING");
  const queryInput = statusFilter === "ALL" ? undefined : { query: { status: statusFilter } };
  const { data: reviews } = useSuspenseQuery(
    queryUtils.reviews.getAll.queryOptions({
      request: queryInput,
      select: (r) => r.body,
    }),
  );
  const updateStatusMutation = useMutation(queryUtils.reviews.updateStatus.mutationOptions());

  const handleStatusUpdate = (reviewId: number, status: Exclude<ReviewStatus, "ALL">) => {
    updateStatusMutation.mutate(
      { params: { id: reviewId }, body: { status } },
      {
        onSuccess: () => {
          toast.success(`Review marked as ${status.toLowerCase()}.`);
          queryClient.invalidateQueries({
            queryKey: queryUtils.reviews.getAll.queryKey(),
          });
        },
        onError: (error) => {
          toast.error(`Failed to update review: ${error.message}`);
        },
      },
    );
  };

  return (
    <div className="px-4 pb-6 lg:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review moderation</h1>
          <p className="text-sm text-muted-foreground">
            Approve or reject pending reviews, and revisit past decisions when you need to correct
            mistakes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {reviewStatuses.map((status) => (
            <Button
              key={status}
              type="button"
              variant={statusFilter === status ? "default" : "outline"}
              onClick={() => setStatusFilter(status)}
            >
              {status === "ALL" ? "All" : status}
            </Button>
          ))}
        </div>
      </div>

      {reviews.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No reviews found</CardTitle>
            <CardDescription>
              There are no reviews in the {statusFilter.toLowerCase()} view right now.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              isPending={updateStatusMutation.isPending}
              onApprove={() => handleStatusUpdate(review.id, "APPROVED")}
              onReject={() => handleStatusUpdate(review.id, "REJECTED")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({
  review,
  isPending,
  onApprove,
  onReject,
}: {
  review: ReviewItem;
  isPending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const createdAt = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(review.createdAt));

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{review.targetLabel}</CardTitle>
            <CardDescription>
              {reviewKindLabel[review.kind]} • Submitted {createdAt}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={statusBadgeClassName[review.status]}>{review.status}</Badge>
            <Badge variant="outline">{review.rating}/5</Badge>
            {review.orderId ? <Badge variant="secondary">Order #{review.orderId}</Badge> : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {review.comment ? (
          <p className="text-sm leading-6 text-slate-700">{review.comment}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No written comment.</p>
        )}

        {review.image ? (
          <div className="max-w-xs overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            <img
              src={review.image.url}
              alt=""
              className="aspect-square h-full w-full object-cover"
            />
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={isPending || review.status === "APPROVED"}
          onClick={onApprove}
        >
          <IconCheck className="mr-1 h-4 w-4" />
          Approve
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={isPending || review.status === "REJECTED"}
          onClick={onReject}
        >
          <IconX className="mr-1 h-4 w-4" />
          Reject
        </Button>
      </CardFooter>
    </Card>
  );
}

function ReviewsLoadingState() {
  return (
    <div className="px-4 pb-6 lg:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-24" />
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }, (_, imageIndex) => (
                  <Skeleton key={imageIndex} className="aspect-square w-full rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
