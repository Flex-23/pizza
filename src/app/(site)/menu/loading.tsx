import { FoodCardSkeleton } from "@/components/menu/food-card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MenuLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <div className="flex flex-col items-center gap-3 py-8 sm:py-10">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <Skeleton className="h-11 w-full rounded-full" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-28 shrink-0 rounded-full" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <FoodCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
