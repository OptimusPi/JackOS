/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface InkFunctionCall {
  name?: string;
  args?: Record<string, unknown>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

export async function analyzeInk(
  base64Image: string,
  context: 'desktop' | 'mail'
): Promise<InkFunctionCall[]> {
  const data = await postJson<{ functionCalls?: InkFunctionCall[] }>(
    '/api/gemini/analyze-ink',
    { base64Image, context }
  );
  return data.functionCalls ?? [];
}

export async function summarizeText(prompt: string): Promise<string> {
  const data = await postJson<{ text?: string }>('/api/gemini/summarize', { prompt });
  return data.text ?? '';
}

export async function generateWallpaper(
  sketchBase64: string,
  sketchDescription?: string
): Promise<string | null> {
  const data = await postJson<{ dataUrl?: string | null }>('/api/gemini/wallpaper', {
    sketchBase64,
    sketchDescription,
  });
  return data.dataUrl ?? null;
}