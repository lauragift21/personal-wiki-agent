interface SearchSkeletonProps {
  count?: number;
}

export function SearchSkeleton({ count = 3 }: SearchSkeletonProps) {
  return (
    <div className="space-y-3 animate-fade-in">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="search-skeleton-card"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          {/* Header skeleton */}
          <div className="p-4 border-b border-[var(--border)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[var(--bg-tertiary)] skeleton-pulse" />
                  <div className="w-32 h-4 rounded bg-[var(--bg-tertiary)] skeleton-pulse" />
                  <div className="w-20 h-3 rounded bg-[var(--bg-tertiary)] skeleton-pulse" />
                </div>
                <div className="w-3/4 h-5 rounded bg-[var(--bg-tertiary)] skeleton-pulse" />
              </div>
              <div className="w-16 h-6 rounded-full bg-[var(--bg-tertiary)] skeleton-pulse flex-shrink-0" />
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="w-16 h-3 rounded bg-[var(--bg-tertiary)] skeleton-pulse" />
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--bg-tertiary)] skeleton-pulse" />
                <div className="w-20 h-3 rounded bg-[var(--bg-tertiary)] skeleton-pulse" />
              </div>
            </div>
          </div>

          {/* Content skeleton */}
          <div className="p-4 space-y-2">
            <div className="w-full h-4 rounded bg-[var(--bg-tertiary)] skeleton-pulse" />
            <div className="w-full h-4 rounded bg-[var(--bg-tertiary)] skeleton-pulse" />
            <div className="w-5/6 h-4 rounded bg-[var(--bg-tertiary)] skeleton-pulse" />
          </div>

          {/* Footer skeleton */}
          <div className="px-4 py-3 border-t border-[var(--border)] flex gap-3">
            <div className="w-28 h-8 rounded-lg bg-[var(--bg-tertiary)] skeleton-pulse" />
            <div className="w-20 h-8 rounded-lg bg-[var(--bg-tertiary)] skeleton-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
