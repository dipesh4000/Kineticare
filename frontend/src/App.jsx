import { useState } from "react";
export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100 text-3xl">
          🚀
        </div>

        <h1 className="mb-2 text-3xl font-bold text-slate-800">
          Welcome!
        </h1>

        <p className="mb-6 text-slate-500">
          A sample React app styled with Tailwind CSS.
        </p>

        <div className="mb-6 rounded-xl bg-slate-50 p-6 text-center">
          <p className="mb-2 text-sm font-medium text-slate-500">
            Current Count
          </p>
          <p className="text-5xl font-bold text-blue-600">
            {count}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setCount((c) => c + 1)}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 active:scale-95"
          >
            Increment +
          </button>

          <button
            onClick={() => setCount(0)}
            className="rounded-lg border border-slate-200 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Reset
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Built with React + Tailwind CSS
        </p>
      </div>
    </div>
  );
}
