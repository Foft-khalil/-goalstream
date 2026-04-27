export async function seedMatches() {
  // This triggers seeding via an API call
  const res = await fetch('/api/seed', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to seed');
  return res.json();
}
