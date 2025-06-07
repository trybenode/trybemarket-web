import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import clsx from "clsx";

export default function CategoryBarSkeleton() {
  return (
    <div className="my-4">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex space-x-2 p-1">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className={clsx(
                "h-8 w-24 rounded-full bg-gray-200 animate-pulse",
                "dark:bg-gray-700"
              )}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
