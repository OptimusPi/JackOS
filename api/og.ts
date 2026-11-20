import { ImageResponse } from '@vercel/og';
import { buildSeedOgElement, parseSeedOgParams } from '../lib/ogCardTemplate';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const query: Record<string, string> = {};
  searchParams.forEach((v, k) => {
    query[k] = v;
  });

  const params = parseSeedOgParams(query);
  const element = buildSeedOgElement({ ...params, hasBalatroFont: false });

  return new ImageResponse(element, {
    width: 1200,
    height: 630,
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=86400',
    },
  });
}
