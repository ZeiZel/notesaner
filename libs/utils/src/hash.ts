export async function hashContent(content: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Node.js fallback
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(content).digest('hex');
}
