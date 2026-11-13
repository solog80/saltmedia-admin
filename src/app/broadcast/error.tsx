'use client';

export default function BroadcastError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-6 text-white space-y-4">
      <h1 className="text-xl font-bold text-red-400">Broadcast page error</h1>
      <pre className="whitespace-pre-wrap rounded bg-black/40 p-4 text-sm">{error.message}{error.digest ? `\n\ndigest: ${error.digest}` : ''}</pre>
      <button className="rounded bg-amber-500 px-4 py-2 text-sm font-bold text-black" onClick={reset}>Retry</button>
    </div>
  );
}
