export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-2/3 rounded-lg bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
        <div className="space-y-2.5 pt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
