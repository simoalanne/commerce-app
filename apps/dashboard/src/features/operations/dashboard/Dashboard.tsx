import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AsyncBoundary } from "@/components/async-boundary";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { RevenueBySourceCard } from "@/components/RevenueBySourceCard";
import { queryUtils } from "@/context/ApiClientContext";
import { SectionCards } from "@/features/operations/dashboard/DasboardCards";

export default function DashBoardPage() {
  return (
    <AsyncBoundary>
      <DashboardContent />
    </AsyncBoundary>
  );
}

function DashboardContent() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <DashboardSummary />
        </div>
      </div>
    </div>
  );
}

function DashboardSummary() {
  const [summaryDays, setSummaryDays] = useState<7 | 30 | 90>(30);

  const { data: summaryData } = useSuspenseQuery(
    queryUtils.summary.get.queryOptions({
      request: { query: { days: summaryDays } },
      select: (r) => r.body,
    }),
  );

  return (
    <>
      <SectionCards
        kpis={summaryData.kpis}
        windowDays={summaryData.windowDays}
        localizationCoverage={summaryData.localizationCoverage}
      />
      <div className="grid gap-4 px-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)] lg:px-6">
        <ChartAreaInteractive
          data={summaryData.chart.revenueByDay}
          windowDays={summaryData.windowDays}
          onWindowDaysChange={setSummaryDays}
        />
        <RevenueBySourceCard revenueBySource={summaryData.chart.revenueBySource} />
      </div>
    </>
  );
}
