export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="animate-pulse space-y-4">
        <div className="mx-auto h-10 w-2/3 rounded-lg bg-muted" />
        <div className="mx-auto h-4 w-1/2 rounded bg-muted" />
        <div className="grid grid-cols-1 gap-4 pt-10 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
