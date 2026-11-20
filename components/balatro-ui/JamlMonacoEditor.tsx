import React, { useEffect, useRef } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import type * as MonacoEditor from 'monaco-editor';
import jamlSchema from 'motely-wasm/jaml/schema.json';

export interface JamlMonacoEditorProps {
  value: string;
  language: 'yaml' | 'json';
  error: string | null;
  height?: number | string;
  onChange: (next: string) => void;
}

let providersRegistered = false;

type JsonSchemaDef = {
  enum?: string[];
  properties?: Record<string, unknown>;
};

function extractSchemaCompletions(): {
  topLevelKeys: string[];
  clauseKeys: string[];
  enumsByKey: Record<string, string[]>;
} {
  const schema = jamlSchema as {
    properties?: Record<string, unknown>;
    definitions?: Record<string, JsonSchemaDef>;
  };

  const defs = schema.definitions ?? {};
  const topLevelKeys = Object.keys(schema.properties ?? {});

  const enumOf = (defName: string): string[] => defs[defName]?.enum ?? [];

  const jokers = enumOf('MotelyJokerName');
  const rareJokers = enumOf('MotelyJokerRareName');
  const commonJokers = enumOf('MotelyJokerCommonName');
  const uncommonJokers = enumOf('MotelyJokerUncommonName');
  const legendaries = enumOf('MotelyJokerLegendaryName');
  const vouchers = enumOf('MotelyVoucherName');
  const tags = enumOf('MotelyTagName');
  const bosses = enumOf('MotelyBossBlindName');
  const tarots = enumOf('MotelyTarotCardName');
  const spectrals = enumOf('MotelySpectralCardName');
  const planets = enumOf('MotelyPlanetCardName');
  const boosters = enumOf('MotelyBoosterPackName');
  const decks = enumOf('MotelyDeckName');
  const stakes = enumOf('MotelyStakeName');
  const editions = enumOf('MotelyItemEditionName');
  const stickers = enumOf('MotelyJokerStickerName');
  const ranks = enumOf('MotelyStandardcardRankName');
  const suits = enumOf('MotelyStandardcardSuitName');

  const clauseKeys = [
    'joker',
    'jokers',
    'legendaryJoker',
    'rareJoker',
    'uncommonJoker',
    'commonJoker',
    'voucher',
    'tag',
    'smallBlindTag',
    'bigBlindTag',
    'boss',
    'tarotCard',
    'spectralCard',
    'planetCard',
    'boosterPack',
    'erraticRank',
    'erraticSuit',
    'antes',
    'ante',
    'edition',
    'stickers',
    'sources',
    'score',
    'min',
    'max',
    'with',
    'label',
    'shopItems',
    'boosterPacks',
    'arcanaPacks',
    'spectralPacks',
    'judgement',
    'wraith',
    'rareTag',
    'uncommonTag',
    'riffRaff',
  ];

  return {
    topLevelKeys,
    clauseKeys,
    enumsByKey: {
      deck: decks,
      stake: stakes,
      joker: ['Any', ...jokers],
      jokers: jokers,
      rareJoker: ['Any', ...rareJokers],
      commonJoker: ['Any', ...commonJokers],
      uncommonJoker: ['Any', ...uncommonJokers],
      legendaryJoker: ['Any', ...legendaries],
      soulJoker: ['Any', ...legendaries],
      voucher: ['Any', ...vouchers],
      tag: ['Any', ...tags],
      smallBlindTag: ['Any', ...tags],
      bigBlindTag: ['Any', ...tags],
      boss: ['Any', ...bosses],
      tarotCard: ['Any', ...tarots],
      spectralCard: ['Any', ...spectrals],
      planetCard: ['Any', ...planets],
      boosterPack: ['Any', ...boosters],
      edition: editions,
      stickers: stickers,
      erraticRank: ranks,
      erraticSuit: suits,
    },
  };
}

function registerBalatroMonaco(monaco: Monaco) {
  if (providersRegistered) return;
  providersRegistered = true;

  // 1. Custom Balatro Dark Editor Theme
  monaco.editor.defineTheme('balatro-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'key', foreground: 'f5b841', fontStyle: 'bold' },
      { token: 'string.key.json', foreground: 'f5b841', fontStyle: 'bold' },
      { token: 'string', foreground: '68d1ff' },
      { token: 'string.value.json', foreground: '68d1ff' },
      { token: 'number', foreground: '4bc292' },
      { token: 'keyword', foreground: 'fe5f55' },
      { token: 'comment', foreground: '7a9196', fontStyle: 'italic' },
    ],
    colors: {
      'editor.background': '#141e20',
      'editor.foreground': '#f2f7f8',
      'editor.lineHighlightBackground': '#1e2d30',
      'editor.selectionBackground': '#009dff44',
      'editorCursor.foreground': '#f5b841',
      'editorLineNumber.foreground': '#5a7277',
      'editorLineNumber.activeForeground': '#f5b841',
      'editorGutter.background': '#111a1c',
      'editorSuggestWidget.background': '#223033',
      'editorSuggestWidget.border': '#b9c2d2',
      'editorSuggestWidget.selectedBackground': '#fe5f55',
    },
  });

  // 2. Wire real motely-wasm/jaml/schema.json into Monaco's JSON validator & autocomplete
  const jsonLang = (monaco.languages as unknown as {
    json?: {
      jsonDefaults?: {
        setDiagnosticsOptions: (opts: Record<string, unknown>) => void;
      };
    };
  }).json;

  jsonLang?.jsonDefaults?.setDiagnosticsOptions({
    validate: true,
    allowComments: false,
    schemas: [
      {
        uri: 'https://seedfinder.app/schemas/motely-filter.schema.json',
        fileMatch: ['*'],
        schema: jamlSchema,
      },
    ],
  });

  // 3. Schema-driven YAML Autocomplete (all 150 Jokers, Vouchers, Tags, Bosses, Keys!)
  const catalog = extractSchemaCompletions();
  monaco.languages.registerCompletionItemProvider('yaml', {
    triggerCharacters: [':', ' ', '-'],
    provideCompletionItems: (model, position) => {
      const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      // Case A: Completing value after `key: `
      const valueMatch = /^\s*-?\s*([A-Za-z]+)\s*:\s*([A-Za-z0-9_]*)$/.exec(linePrefix);
      if (valueMatch) {
        const key = valueMatch[1];
        const values = catalog.enumsByKey[key];
        if (values && values.length > 0) {
          return {
            suggestions: values.map((v) => ({
              label: v,
              kind: monaco.languages.CompletionItemKind.EnumMember,
              insertText: v,
              detail: `motely-wasm (${key})`,
              range,
            })),
          };
        }
      }

      // Case B: Top-level key (indent 0)
      if (/^[A-Za-z]*$/.test(linePrefix)) {
        return {
          suggestions: catalog.topLevelKeys.map((k) => ({
            label: k,
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: `${k}: `,
            detail: 'JamlFilter property',
            range,
          })),
        };
      }

      // Case C: Indented clause property
      return {
        suggestions: catalog.clauseKeys.map((k) => ({
          label: k,
          kind: monaco.languages.CompletionItemKind.Field,
          insertText: `${k}: `,
          detail: 'JamlClause property',
          range,
        })),
      };
    },
  });
}

function parseErrorLineNumber(err: string | null): number {
  if (!err) return 1;
  const match = /line\s*(\d+)/i.exec(err);
  if (match) return Math.max(1, Number(match[1]));
  return 1;
}

export const JamlMonacoEditor: React.FC<JamlMonacoEditorProps> = ({
  value,
  language,
  error,
  height = 250,
  onChange,
}) => {
  const editorRef = useRef<MonacoEditor.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    registerBalatroMonaco(monaco);
    monaco.editor.setTheme('balatro-dark');
  };

  // Sync real JamlConfigLoader.check() errors straight onto Monaco red squiggles
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;

    if (!error) {
      monaco.editor.setModelMarkers(model, 'motely-jaml', []);
      return;
    }

    const line = Math.min(model.getLineCount(), parseErrorLineNumber(error));
    monaco.editor.setModelMarkers(model, 'motely-jaml', [
      {
        severity: monaco.MarkerSeverity.Error,
        message: error,
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: Math.max(2, model.getLineMaxColumn(line)),
      },
    ]);
  }, [error, value, language]);

  return (
    <div
      className={`overflow-hidden rounded-[6px] border-2 ${
        error ? 'border-[#fe5f55]' : 'border-[#4f6367]'
      } bg-[#141e20]`}
    >
      <Editor
        height={height}
        language={language}
        value={value}
        theme="balatro-dark"
        onMount={handleMount}
        onChange={(v) => onChange(v ?? '')}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineHeight: 20,
          tabSize: 2,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: 'on',
          quickSuggestions: true,
          suggestOnTriggerCharacters: true,
          padding: { top: 8, bottom: 8 },
          renderLineHighlight: 'line',
          overviewRulerLanes: 0,
        }}
      />
    </div>
  );
};
