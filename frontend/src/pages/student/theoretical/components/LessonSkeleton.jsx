export default function LessonSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
  <div className="h-6 bg-slate-200 rounded w-2/3 animate-pulse" />
  <div className="h-4 bg-slate-200 rounded w-1/2 animate-pulse" />
      <div className="space-y-3 mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 bg-slate-200 rounded animate-pulse w-full" />
        ))}
      </div>
      <div className="flex gap-4 mt-8">
  <div className="h-10 bg-slate-200 rounded w-28 animate-pulse" />
  <div className="h-10 bg-slate-200 rounded w-28 animate-pulse" />
      </div>
    </div>
  );
}