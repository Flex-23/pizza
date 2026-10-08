import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type SummaryFigure = {
  label: string;
  value: string;
  icon: React.ReactNode;
  /** The headline figure of the report — the takings — reads in brand colour. */
  emphasis?: boolean;
};

/**
 * The footer every report ends on: a small strip of labelled totals, right at
 * the foot of the numbers they add up. Shared by the daily footer and the
 * monthly grand total so "total orders" and "total revenue" always look and read
 * the same wherever they appear.
 */
export function ReportSummary({ figures }: { figures: SummaryFigure[] }) {
  return (
    <Card className="flex-row flex-wrap items-stretch gap-0 p-0">
      {figures.map((figure, index) => (
        <div
          key={figure.label}
          className={cn(
            "flex min-w-44 flex-1 items-center gap-3 px-5 py-4",
            index > 0 && "border-s border-border",
            figure.emphasis && "bg-primary/5",
          )}
        >
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              figure.emphasis
                ? "bg-primary/12 text-primary"
                : "bg-muted text-muted-foreground",
            )}
            aria-hidden
          >
            {figure.icon}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">
              {figure.label}
            </span>
            <span
              className={cn(
                "text-xl font-extrabold tabular-nums",
                figure.emphasis && "text-primary",
              )}
            >
              {figure.value}
            </span>
          </div>
        </div>
      ))}
    </Card>
  );
}
