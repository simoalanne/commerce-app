"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

const UTM_STORAGE_KEY = "acme_utm_tracking";
const UTM_STORAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type UtmTrackingValues = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

type StoredUtmTracking = UtmTrackingValues & {
  capturedAt: number;
};

function readUtmTracking(searchParams: URLSearchParams): UtmTrackingValues | null {
  const utmSource = searchParams.get("utm_source")?.trim();
  const utmMedium = searchParams.get("utm_medium")?.trim();
  const utmCampaign = searchParams.get("utm_campaign")?.trim();

  if (!utmSource && !utmMedium && !utmCampaign) {
    return null;
  }

  const tracking: UtmTrackingValues = {};

  if (utmSource) {
    tracking.utm_source = utmSource;
  }

  if (utmMedium) {
    tracking.utm_medium = utmMedium;
  }

  if (utmCampaign) {
    tracking.utm_campaign = utmCampaign;
  }

  return tracking;
}

function saveUtmTracking(values: UtmTrackingValues) {
  window.localStorage.setItem(
    UTM_STORAGE_KEY,
    JSON.stringify({
      ...values,
      capturedAt: Date.now(),
    }),
  );
}

export function getStoredUtmTracking(): UtmTrackingValues | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawTracking = window.localStorage.getItem(UTM_STORAGE_KEY);
    if (!rawTracking) {
      return null;
    }

    const parsedTracking = JSON.parse(rawTracking) as Partial<StoredUtmTracking>;
    if (
      typeof parsedTracking.capturedAt !== "number" ||
      Date.now() - parsedTracking.capturedAt > UTM_STORAGE_TTL_MS
    ) {
      window.localStorage.removeItem(UTM_STORAGE_KEY);
      return null;
    }

    const tracking: UtmTrackingValues = {};

    if (typeof parsedTracking.utm_source === "string" && parsedTracking.utm_source.trim()) {
      tracking.utm_source = parsedTracking.utm_source.trim();
    }

    if (typeof parsedTracking.utm_medium === "string" && parsedTracking.utm_medium.trim()) {
      tracking.utm_medium = parsedTracking.utm_medium.trim();
    }

    if (typeof parsedTracking.utm_campaign === "string" && parsedTracking.utm_campaign.trim()) {
      tracking.utm_campaign = parsedTracking.utm_campaign.trim();
    }

    return Object.keys(tracking).length > 0 ? tracking : null;
  } catch {
    return null;
  }
}

export function clearStoredUtmTracking() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(UTM_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function UtmTrackerInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const tracking = readUtmTracking(searchParams);
    if (!tracking) {
      return;
    }

    try {
      saveUtmTracking(tracking);
    } catch (error) {
      console.error("Failed to save UTM tracking:", error);
    }
  }, [searchParams]);

  return null;
}

export function UtmTracker() {
  return (
    <Suspense fallback={null}>
      <UtmTrackerInner />
    </Suspense>
  );
}
