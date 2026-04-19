export default function DemoBanner() {
  const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
  if (!isDemo) return null;

  return (
    <div className="bg-amber-400 text-amber-950 px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 shrink-0">
      <span style={{ fontSize: 16 }}>🎭</span>
      <span>
        Demo Mode — all data is simulated, no Azure subscription required.
        Changes reset on server restart.
      </span>
      <a
        href="https://github.com/your-org/ca-guardian"
        target="_blank"
        rel="noopener noreferrer"
        className="underline font-semibold hover:text-amber-900 ml-2"
      >
        Deploy your own →
      </a>
    </div>
  );
}
