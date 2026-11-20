import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { GoogleGenAI, Type } from '@google/genai';
import type { Tool } from '@google/genai';
import { buildSeedOgElement, parseSeedOgParams } from './lib/ogCardTemplate.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let resvgReady: Promise<void> | null = null;
function ensureResvgWasm(): Promise<void> {
  if (!resvgReady) {
    const wasmPath = path.resolve(__dirname, 'node_modules/@vercel/og/dist/resvg.wasm');
    const wasmBuf = fs.readFileSync(wasmPath);
    resvgReady = initWasm(wasmBuf);
  }
  return resvgReady;
}

let cachedBalatroFont: Buffer | null = null;
function getBalatroFontBuffer(): Buffer | null {
  if (cachedBalatroFont) return cachedBalatroFont;
  const candidates = [
    path.resolve(__dirname, 'node_modules/jaml-ui/assets/fonts/m6x11plus.ttf'),
    path.resolve(__dirname, 'node_modules/@vercel/og/dist/Geist-Regular.ttf'),
  ];
  for (const fontPath of candidates) {
    if (fs.existsSync(fontPath)) {
      cachedBalatroFont = fs.readFileSync(fontPath);
      return cachedBalatroFont;
    }
  }
  return null;
}

const TEXT_MODEL = process.env.VERTEX_TEXT_MODEL || 'gemini-4-hydrogen';
const IMAGE_MODEL = process.env.VERTEX_IMAGE_MODEL || 'gemini-3.1-flash-lite-image';

const HOME_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'delete_item',
        description:
          'Call this function for EACH item (application or folder) that has an "X" or cross drawn over it. If multiple items are crossed out, call this function multiple times.',
        parameters: {
          type: Type.OBJECT,
          required: ['itemName'],
          properties: {
            itemName: {
              type: Type.STRING,
              description: 'The exact name of the item to delete as seen on screen.',
            },
          },
        },
      },
      {
        name: 'explode_folder',
        description:
          'Call this when the user draws outward pointing arrows from a folder to "explode" it and show its contents.',
        parameters: {
          type: Type.OBJECT,
          required: ['folderName'],
          properties: {
            folderName: {
              type: Type.STRING,
              description: 'The exact name of the folder to explode as seen on screen.',
            },
          },
        },
      },
      {
        name: 'explain_item',
        description:
          'Call this when the user draws a question mark "?" over an item (or nearby an item). If it is a folder, it will summarize its contents. If it is a text file, it will summarize its text content.',
        parameters: {
          type: Type.OBJECT,
          required: ['itemName'],
          properties: {
            itemName: {
              type: Type.STRING,
              description: 'The name of the item (app or folder) to explain.',
            },
          },
        },
      },
      {
        name: 'change_background',
        description:
          'Call this when the user draws a sketch on the empty desktop background (not specifically targeting an app icon), intending to turn that sketch into a new wallpaper. Do NOT call this if the sketch is clearly trying to interact with an existing icon (like crossing it out).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            sketch_description: {
              type: Type.STRING,
              description:
                'A short description of what the sketch appears to be, to help generating the wallpaper (e.g., "mountains", "flower", "abstract curves").',
            },
          },
        },
      },
    ],
  },
];

const MAIL_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'delete_email',
        description:
          'Call this when the user draws a line through (strikes out) or an "X" over an email row in the list to delete it. Call multiple times if multiple emails are struck out.',
        parameters: {
          type: Type.OBJECT,
          required: ['subject_text'],
          properties: {
            subject_text: {
              type: Type.STRING,
              description: 'Distinct text from the subject line of the email.',
            },
            sender_text: {
              type: Type.STRING,
              description: 'The name of the sender of the email.',
            },
          },
        },
      },
      {
        name: 'summarize_email',
        description:
          'Call this when the user draws a question mark "?" over email row(s) or highlights them. This will summarize the BODY of the email(s) concisely. CRITICAL: If the gesture covers MULTIPLE emails, you MUST generate MULTIPLE SEPARATE calls to this function, one for EACH email covered by the gesture.',
        parameters: {
          type: Type.OBJECT,
          required: ['subject_text'],
          properties: {
            subject_text: {
              type: Type.STRING,
              description: 'Distinct text from the subject line of the email to summarize.',
            },
            sender_text: {
              type: Type.STRING,
              description: 'The name of the sender of the email.',
            },
          },
        },
      },
    ],
  },
];

const SYSTEM_INSTRUCTION = `You are Gemini Ink, an intelligent assistant. 
The user interacts with the screen by drawing "ink" strokes (white lines) on top of the UI.
Your job is to interpret their intent based on standard symbols and the current active application context.
If the user has drawn multiple distinct symbols (like multiple 'X's on different items), you MUST call the appropriate tool multiple times, once for each distinct user intent.
`;

interface AiClientBundle {
  ai: GoogleGenAI;
  provider: 'vertex-adc' | 'vertex-express' | 'gemini-api';
}

function createAiClient(): GoogleGenAI {
  return createAiClientWithProvider().ai;
}

function createAiClientWithProvider(): AiClientBundle {
  const httpOptions = {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  };

  const useVertexFlag = process.env.GOOGLE_GENAI_USE_VERTEXAI !== 'false';
  const gcpProject = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const gcpLocation = process.env.GOOGLE_CLOUD_LOCATION?.trim() || 'us-central1';
  const vertexApiKey = process.env.VERTEX_AI_API_KEY?.trim();

  // 1. Standard Vertex AI (GCP Project + Location via ADC / Cloud Run / Service Account)
  if (useVertexFlag && gcpProject) {
    return {
      provider: 'vertex-adc',
      ai: new GoogleGenAI({
        vertexai: true,
        project: gcpProject,
        location: gcpLocation,
        httpOptions,
      }),
    };
  }

  // 2. Vertex AI Express Mode (Vertex AI API Key)
  if (useVertexFlag && vertexApiKey) {
    return {
      provider: 'vertex-express',
      ai: new GoogleGenAI({
        vertexai: true,
        apiKey: vertexApiKey,
        httpOptions,
      }),
    };
  }

  // 3. Gemini API Key fallback (auto-configured in AI Studio Secrets)
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'Neither Vertex AI (GOOGLE_CLOUD_PROJECT / VERTEX_AI_API_KEY) nor GEMINI_API_KEY is configured on the server.'
    );
  }
  return {
    provider: 'gemini-api',
    ai: new GoogleGenAI({
      apiKey,
      httpOptions,
    }),
  };
}

function getErrorStatus(err: unknown): number {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status?: unknown }).status;
    if (typeof status === 'number' && status >= 400 && status < 600) {
      return status;
    }
  }
  return 500;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  // 1. Ink gesture analysis with function calling
  app.post('/api/gemini/analyze-ink', async (req: Request, res: Response) => {
    try {
      const { base64Image, context } = req.body as {
        base64Image?: string;
        context?: 'desktop' | 'mail';
      };

      if (!base64Image) {
        res.status(400).json({ error: 'Missing base64Image in request body.' });
        return;
      }

      const ai = createAiClient();
      const isMail = context === 'mail';
      const activeTools = isMail ? MAIL_TOOLS : HOME_TOOLS;
      const contextDescription = isMail ? 'Mail App' : 'Desktop (Home Screen)';

      const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          {
            text: `Analyze the white ink drawings. The user is currently focused on: ${contextDescription}.`,
          },
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: activeTools,
        },
      });

      res.json({
        functionCalls: response.functionCalls ?? [],
      });
    } catch (err) {
      console.error('Server /api/gemini/analyze-ink error:', err);
      res.status(getErrorStatus(err)).json({ error: getErrorMessage(err) });
    }
  });

  // 2. Concise text / email summarization
  app.post('/api/gemini/summarize', async (req: Request, res: Response) => {
    try {
      const { prompt } = req.body as { prompt?: string };
      if (!prompt) {
        res.status(400).json({ error: 'Missing prompt in request body.' });
        return;
      }

      const ai = createAiClient();
      const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: prompt,
      });

      res.json({ text: response.text ?? '' });
    } catch (err) {
      console.error('Server /api/gemini/summarize error:', err);
      res.status(getErrorStatus(err)).json({ error: getErrorMessage(err) });
    }
  });

  // 3. Sketch-to-wallpaper image generation
  app.post('/api/gemini/wallpaper', async (req: Request, res: Response) => {
    try {
      const { sketchBase64, sketchDescription } = req.body as {
        sketchBase64?: string;
        sketchDescription?: string;
      };

      if (!sketchBase64) {
        res.status(400).json({ error: 'Missing sketchBase64 in request body.' });
        return;
      }

      const ai = createAiClient();
      const imgResponse = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: sketchBase64 } },
            {
              text: `Generate an aesthetically pleasing, realistic looking wallpaper based on this sketch. The final image should align well spatially with the original trace, as if the sketch was a guideline, but REMOVE all the actual sketch lines from the final output. ${sketchDescription ? `It looks like: ${sketchDescription}` : ''}`,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: '16:9',
          },
        },
      });

      let dataUrl: string | null = null;
      const parts = imgResponse.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData?.data) {
            dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      res.json({ dataUrl });
    } catch (err) {
      console.error('Server /api/gemini/wallpaper error:', err);
      res.status(getErrorStatus(err)).json({ error: getErrorMessage(err) });
    }
  });

  // 3b. Vertex AI / Gemini: Balatro Seed Card Lore & Card Metadata
  app.post('/api/vertex/seed-card-lore', async (req: Request, res: Response) => {
    try {
      const {
        seed,
        deck,
        stake,
        cardStyle = 'joker',
        ante = 1,
        boss,
        voucher,
        souls = [],
        shopItems = [],
      } = req.body as {
        seed?: string;
        deck?: string;
        stake?: string;
        cardStyle?: 'joker' | 'planet' | 'spectral';
        ante?: number;
        boss?: string;
        voucher?: string;
        souls?: string[];
        shopItems?: string[];
      };

      if (!seed) {
        res.status(400).json({ error: 'Missing seed in request body.' });
        return;
      }

      const { ai, provider } = createAiClientWithProvider();
      const stylePrompt =
        cardStyle === 'planet'
          ? 'a Balatro Planet Card (celestial body name, poker hand level-up vibe, cosmic astronomy humor)'
          : cardStyle === 'spectral'
          ? 'a Balatro Spectral Card (eerie occult ritual name, high-risk high-reward spectral pact)'
          : 'a Balatro Joker Card (punchy iconic Joker title, witty mechanics tied to real Balatro synergies)';

      const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: `Create custom Balatro card text for seed "${seed}" styled as ${stylePrompt}.
Real deterministic seed data:
- Deck: ${deck || 'Ghost'} Deck
- Stake: ${stake || 'White'} Stake
- Focused Ante: ${ante}
- Boss Blind: ${boss || 'Unknown'}
- Voucher: ${voucher || 'Unknown'}
- Soul Legendaries: ${souls.length > 0 ? souls.join(', ') : 'None in early Antes'}
- Notable Shop Drops: ${shopItems.length > 0 ? shopItems.slice(0, 8).join(', ') : 'Mixed pool'}

Write crisp, punchy Balatro tooltip copy that directly references the actual items/souls/boss in this seed. Keep cardName under 24 characters and abilityLines to 2-3 short lines (each under 46 characters) using Balatro syntax like "+50 Chips", "+15 Mult", "X3 Mult", or "$10".`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            required: ['cardName', 'subtitle', 'abilityLines', 'flavorQuote', 'rarity'],
            properties: {
              cardName: { type: Type.STRING, description: 'Short Balatro card name (max 24 chars).' },
              subtitle: { type: Type.STRING, description: '2-4 word archetype subtitle.' },
              abilityLines: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2-3 short Balatro-style effect lines grounded in the seed drops.',
              },
              flavorQuote: { type: Type.STRING, description: 'One short witty flavor line (max 48 chars).' },
              rarity: {
                type: Type.STRING,
                description: 'One of: Common, Uncommon, Rare, Legendary, Planet, Spectral.',
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ ...parsed, provider, model: TEXT_MODEL });
    } catch (err) {
      console.error('Server /api/vertex/seed-card-lore error:', err);
      res.status(getErrorStatus(err)).json({ error: getErrorMessage(err) });
    }
  });

  // 3c. Vertex AI / Gemini: Bespoke Pixel-Art Balatro Seed Card Artwork
  app.post('/api/vertex/seed-card-art', async (req: Request, res: Response) => {
    try {
      const {
        seed,
        deck,
        cardStyle = 'joker',
        cardName,
        heroItem,
        boss,
        souls = [],
      } = req.body as {
        seed?: string;
        deck?: string;
        cardStyle?: 'joker' | 'planet' | 'spectral';
        cardName?: string;
        heroItem?: string;
        boss?: string;
        souls?: string[];
      };

      if (!seed) {
        res.status(400).json({ error: 'Missing seed in request body.' });
        return;
      }

      const { ai, provider } = createAiClientWithProvider();
      const styleGuide =
        cardStyle === 'planet'
          ? 'retro 16-bit pixel art celestial planet floating in a deep cyan-teal starry cosmos with luminous orbital rings and playing-card suit constellations'
          : cardStyle === 'spectral'
          ? 'retro 16-bit pixel art arcane spectral crystal and ghostly joker mask glowing with electric violet and cyan astral flames on deep midnight indigo'
          : 'retro 16-bit pixel art whimsical poker joker emblem with bold ink outlines, vibrant casino crimson, cobalt blue, and gold foil accents on warm vintage playing-card parchment';

      const subjectHints = [
        cardName ? `Theme: "${cardName}"` : '',
        heroItem ? `Inspired by "${heroItem}"` : '',
        souls.length > 0 ? `Legendary motifs: ${souls.slice(0, 2).join(', ')}` : '',
        deck ? `${deck} Deck atmosphere` : '',
        boss ? `Subtle nod to ${boss}` : '',
      ]
        .filter(Boolean)
        .join('. ');

      const prompt = `Create a centered vertical illustration for a collectible indie poker roguelike card in ${styleGuide}. ${subjectHints}. Crisp pixel-art aesthetic, clean readable silhouette, zero text, zero letters, zero numbers, no outer card border or watermark.`;

      const imgResponse = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: '3:4',
          },
        },
      });

      let dataUrl: string | null = null;
      const parts = imgResponse.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (!dataUrl) {
        res.status(502).json({ error: 'Model returned no image data for this seed card.' });
        return;
      }

      res.json({ dataUrl, provider, model: IMAGE_MODEL });
    } catch (err) {
      console.error('Server /api/vertex/seed-card-art error:', err);
      res.status(getErrorStatus(err)).json({ error: getErrorMessage(err) });
    }
  });

  // 4. Real @vercel/og (satori + resvg-wasm) 1200x630 Balatro Seed Social Share Card PNG
  app.get('/api/og', async (req: Request, res: Response) => {
    try {
      await ensureResvgWasm();
      const fontData = getBalatroFontBuffer();
      const params = parseSeedOgParams(req.query as Record<string, unknown>);
      const element = buildSeedOgElement({ ...params, hasBalatroFont: Boolean(fontData) });

      const svg = await satori(element, {
        width: 1200,
        height: 630,
        fonts: fontData
          ? [
              {
                name: 'm6x11plus',
                data: fontData,
                style: 'normal',
                weight: 400,
              },
            ]
          : [],
      });

      const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(Buffer.from(png));
    } catch (err) {
      console.error('Server /api/og error:', err);
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  const injectSeedOgMeta = (html: string, req: Request): string => {
    const seed = typeof req.query.seed === 'string' ? req.query.seed.trim().toUpperCase() : '';
    if (!seed) return html;
    const deck = typeof req.query.deck === 'string' ? req.query.deck.trim() : 'Ghost';
    const stake = typeof req.query.stake === 'string' ? req.query.stake.trim() : 'White';
    const ante = typeof req.query.ante === 'string' ? req.query.ante.trim() : '1';
    const qs = new URLSearchParams({ seed, deck, stake, ante });
    if (typeof req.query.boss === 'string') qs.set('boss', req.query.boss);
    if (typeof req.query.voucher === 'string') qs.set('voucher', req.query.voucher);
    if (typeof req.query.souls === 'string') qs.set('souls', req.query.souls);
    if (typeof req.query.shop === 'string') qs.set('shop', req.query.shop);

    const safeSeed = seed.replace(/[^A-Z0-9_-]/g, '');
    const title = `Seed ${safeSeed} (${deck} / ${stake}) – seedfinder.app`;
    const desc = `Inspect Balatro seed ${safeSeed} on ${deck} Deck (${stake} Stake): Ante 1–8 shop queues, booster packs, Soul Legendaries, and interactive run routing.`;
    const ogImg = `/api/og?${qs.toString()}`;

    return html
      .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
      .replace(/property="og:title" content="[^"]*"/, `property="og:title" content="${title}"`)
      .replace(/name="twitter:title" content="[^"]*"/, `name="twitter:title" content="${title}"`)
      .replace(/property="og:description" content="[^"]*"/, `property="og:description" content="${desc}"`)
      .replace(/name="twitter:description" content="[^"]*"/, `name="twitter:description" content="${desc}"`)
      .replace(/property="og:image" content="[^"]*"/, `property="og:image" content="${ogImg}"`)
      .replace(/name="twitter:image" content="[^"]*"/, `name="twitter:image" content="${ogImg}"`);
  };

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.get('/{*splat}', async (req, res, next) => {
      try {
        const raw = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, injectSeedOgMeta(raw, req));
        res.status(200).set({ 'Content-Type': 'text/html' }).end(transformed);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir, { index: false }));
    app.get('/{*splat}', (req, res) => {
      const raw = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
      res.status(200).set({ 'Content-Type': 'text/html' }).end(injectSeedOgMeta(raw, req));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
