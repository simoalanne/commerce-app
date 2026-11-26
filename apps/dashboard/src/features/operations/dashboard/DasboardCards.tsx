import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCents } from "@/lib/money";

type SummaryKpis = {
  totalRevenueCents: number;
  revenueDeltaPct: number;
  paidOrders: number;
  paidOrdersDeltaPct: number;
  activeProducts: number;
  customers: number;
};

type SectionCardsProps = {
  kpis: SummaryKpis;
  windowDays: number;
  localizationCoverage: {
    overall: { percentage: number; completed: number; outOf: number };
    byLocale: Record<string, { percentage: number }>;
  };
};

const numberFormatter = new Intl.NumberFormat("en-US");

export function SectionCards({ kpis, windowDays, localizationCoverage }: SectionCardsProps) {
  const revenueTrendUp = kpis.revenueDeltaPct >= 0;
  const ordersTrendUp = kpis.paidOrdersDeltaPct >= 0;
  const RevenueTrendIcon = revenueTrendUp ? IconTrendingUp : IconTrendingDown;
  const OrdersTrendIcon = ordersTrendUp ? IconTrendingUp : IconTrendingDown;

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-5 dark:*:data-[slot=card]:bg-card">
      <Card className={revenueTrendUp ? "bg-green-300" : "@container/card"}>
        <CardHeader>
          <CardDescription>Total Revenue</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatCents(kpis.totalRevenueCents)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className={revenueTrendUp ? "border-green-500" : ""}>
              <RevenueTrendIcon />
              {kpis.revenueDeltaPct > 0 ? "+" : ""}
              {kpis.revenueDeltaPct.toFixed(1)}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Revenue vs previous period <RevenueTrendIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">Last {windowDays} days</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Paid Orders</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {numberFormatter.format(kpis.paidOrders)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <OrdersTrendIcon />
              {kpis.paidOrdersDeltaPct > 0 ? "+" : ""}
              {kpis.paidOrdersDeltaPct.toFixed(1)}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Paid orders vs previous period <OrdersTrendIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">Last {windowDays} days</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active Products</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {numberFormatter.format(kpis.activeProducts)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              Inventory
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Products currently available <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">Status is ACTIVE or FEATURED</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Customers</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {numberFormatter.format(kpis.customers)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              Total
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Registered customer base <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">Role = CUSTOMER</div>
        </CardFooter>
      </Card>

      <Card
        className={localizationCoverage.overall.percentage <= 33 ? "bg-red-200" : "@container/card"}
      >
        <CardHeader>
          <CardDescription>Localization Coverage</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {localizationCoverage.overall.percentage.toFixed(1)}%
          </CardTitle>
          <CardAction>
            <Badge
              variant="outline"
              className={localizationCoverage.overall.percentage <= 33 ? "border-red-500" : ""}
            >
              {localizationCoverage.overall.completed}/{localizationCoverage.overall.outOf}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Localizable fields fully translated
          </div>
          <div className="text-muted-foreground">
            {Object.entries(localizationCoverage.byLocale)
              .map(([locale, coverage]) => `${locale} ${coverage.percentage.toFixed(0)}%`)
              .join(" · ")}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
