import { useEffect, useState } from 'react';

type Health = { ok: boolean; db: string; requestId: string };

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then(async (response) => {
        const body = await response.json();
        setHealth(body);
        setError(!response.ok);
      })
      .catch(() => setError(true));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
      <h1>Auction House</h1>
      <p style={{ fontSize: '18px', fontWeight: 'bold', color: error ? '#dc2626' : health?.ok ? '#16a34a' : '#6b7280' }}>
        {error ? 'Error' : health?.ok ? 'OK' : 'Loading…'}
      </p>
      {health && (
        <pre style={{ background: '#f3f4f6', padding: '16px', borderRadius: '8px', overflowX: 'auto', border: '1px solid #e5e7eb' }}>
          {JSON.stringify(health, null, 2)}
        </pre>
      )}
    </main>
  );
}
