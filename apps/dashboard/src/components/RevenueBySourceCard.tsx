import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type RevenueBySourceItem = {
  source: string;
  revenue: number;
  orders: number;
};

type RevenueBySourceCardProps = {
  revenueBySource: RevenueBySourceItem[];
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const sourceColorClasses = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
];

export function RevenueBySourceCard({ revenueBySource }: RevenueBySourceCardProps) {
  const totalRevenue = revenueBySource.reduce((sum, item) => sum + item.revenue, 0);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>Revenue by Source</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {revenueBySource.length}
          <span className="ml-2 text-sm font-normal text-muted-foreground">sources</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          {totalRevenue > 0
            ? `Total tracked revenue: ${currencyFormatter.format(totalRevenue)}`
            : "No tracked source revenue yet"}
        </div>
        <div className="space-y-3">
          {revenueBySource.map((item, index) => {
            const sourceLabel = formatSourceLabel(item.source);
            const share = totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0;
            const colorClass = sourceColorClasses[index % sourceColorClasses.length];

            return (
              <div key={item.source} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`size-2.5 shrink-0 rounded-full ${colorClass}`}
                      aria-hidden="true"
                    />
                    <span className="truncate font-medium">{sourceLabel}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{item.orders} orders</span>
                    <span>{share.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${colorClass}`}
                    style={{ width: `${Math.max(4, share)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{sourceLabel}</span>
                  <span>{currencyFormatter.format(item.revenue)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function formatSourceLabel(source: string) {
  switch (source.toLowerCase()) {
    case "utm_source":
      return "Source";
    case "google":
      return "Google";
    case "meta":
    case "facebook":
      return "Meta";
    case "direct":
      return "Direct";
    default:
      return source
        .split("_")
        .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
        .join(" ");
  }
}
