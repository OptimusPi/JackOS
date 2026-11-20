import React from 'react';

export interface SeedOgParams {
  seed: string;
  deck: string;
  stake: string;
  ante: string;
  boss: string;
  voucher: string;
  souls: string[];
  shopItems: string[];
  hasBalatroFont?: boolean;
}

export function parseSeedOgParams(query: Record<string, unknown>): SeedOgParams {
  const seed = String(query.seed ?? 'ALEEB').trim().toUpperCase().slice(0, 16) || 'ALEEB';
  const deck = String(query.deck ?? 'Ghost').trim().slice(0, 20) || 'Ghost';
  const stake = String(query.stake ?? 'White').trim().slice(0, 20) || 'White';
  const ante = String(query.ante ?? '1').trim().slice(0, 4) || '1';
  const boss = String(query.boss ?? '').trim().slice(0, 28) || 'Live Ante 1–8 Map';
  const voucher = String(query.voucher ?? '').trim().slice(0, 28) || 'Full Shop & Packs';
  const soulsRaw = String(query.souls ?? '').trim();
  const shopRaw = String(query.shop ?? '').trim();

  const souls = soulsRaw
    ? soulsRaw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4)
    : [];
  const shopItems = shopRaw
    ? shopRaw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6)
    : [];

  return { seed, deck, stake, ante, boss, voucher, souls, shopItems };
}

export function buildSeedOgElement(params: SeedOgParams): React.ReactElement {
  const { seed, deck, stake, ante, boss, voucher, souls, shopItems, hasBalatroFont = true } = params;
  const h = React.createElement;

  return h(
    'div',
    {
      style: {
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '38px 46px',
        background: 'linear-gradient(135deg, #1b3d33 0%, #182426 52%, #29181d 100%)',
        color: '#ffffff',
        fontFamily: hasBalatroFont ? 'm6x11plus' : 'sans-serif',
        border: '10px solid #b9c2d2',
      },
    },
    // Top Brand + Run Config Row
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
        },
      },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '18px' } },
        h(
          'div',
          {
            style: {
              display: 'flex',
              background: '#fe5f55',
              borderBottom: '6px solid #b8352e',
              borderRadius: '10px',
              padding: '8px 22px',
              fontSize: '34px',
              letterSpacing: '2px',
              color: '#ffffff',
            },
          },
          'seedfinder.app'
        ),
        h(
          'div',
          {
            style: {
              display: 'flex',
              fontSize: '26px',
              color: '#b7c7ca',
            },
          },
          'BALATRO SEED REPORT'
        )
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            background: '#009dff',
            borderBottom: '6px solid #0068b8',
            borderRadius: '10px',
            padding: '10px 24px',
            fontSize: '30px',
            color: '#ffffff',
          },
        },
        `${deck} Deck  /  ${stake} Stake`
      )
    ),

    // Center Hero Seed + Ante Breakdown
    h(
      'div',
      {
        style: {
          display: 'flex',
          gap: '26px',
          alignItems: 'stretch',
          width: '100%',
        },
      },
      // Left: Seed Code + Boss & Voucher Slab
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flex: '1.1',
            background: '#223033',
            border: '4px solid #6f7987',
            borderRadius: '14px',
            padding: '28px 34px',
          },
        },
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column' } },
          h(
            'div',
            { style: { display: 'flex', fontSize: '24px', color: '#f5b841', marginBottom: '8px' } },
            'SEED CODE'
          ),
          h(
            'div',
            {
              style: {
                display: 'flex',
                fontSize: seed.length > 9 ? '66px' : '92px',
                lineHeight: 1,
                letterSpacing: '6px',
                color: '#ffffff',
              },
            },
            seed
          )
        ),
        h(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginTop: '24px',
              paddingTop: '18px',
              borderTop: '2px solid #3c4f54',
              fontSize: '26px',
            },
          },
          h(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', width: '100%' } },
            h('span', { style: { color: '#9db0b4' } }, `ANTE ${ante} BOSS`),
            h('span', { style: { color: '#fe5f55' } }, boss)
          ),
          h(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', width: '100%' } },
            h('span', { style: { color: '#9db0b4' } }, `ANTE ${ante} VOUCHER`),
            h('span', { style: { color: '#f5b841' } }, voucher)
          )
        )
      ),

      // Right Highlight Column (Souls + Shop)
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flex: '0.95',
            gap: '16px',
          },
        },
        h(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              background: '#2a2236',
              border: '4px solid #9e74ce',
              borderRadius: '14px',
              padding: '18px 22px',
              flex: 1,
            },
          },
          h(
            'div',
            { style: { display: 'flex', fontSize: '22px', color: '#d5b8ff', marginBottom: '10px' } },
            'SOUL LEGENDARIES'
          ),
          h(
            'div',
            { style: { display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '26px' } },
            ...(souls.length > 0
              ? souls.map((s, idx) =>
                  h(
                    'div',
                    {
                      key: `s-${idx}`,
                      style: {
                        display: 'flex',
                        background: '#9e74ce',
                        borderBottom: '4px solid #6b4896',
                        borderRadius: '6px',
                        padding: '5px 14px',
                        fontSize: '24px',
                        color: '#ffffff',
                      },
                    },
                    s
                  )
                )
              : [
                  h(
                    'div',
                    { key: 'none', style: { display: 'flex', color: '#b7c7ca', fontSize: '24px' } },
                    'Deterministic Ante 1-8 Analysis'
                  ),
                ])
          )
        ),
        h(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              background: '#173c2f',
              border: '4px solid #4bc292',
              borderRadius: '14px',
              padding: '18px 22px',
              flex: 1,
            },
          },
          h(
            'div',
            { style: { display: 'flex', fontSize: '22px', color: '#7be0b4', marginBottom: '10px' } },
            `ANTE ${ante} SHOP HIGHLIGHTS`
          ),
          h(
            'div',
            { style: { display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '24px' } },
            ...(shopItems.length > 0
              ? shopItems.map((it, idx) =>
                  h(
                    'div',
                    {
                      key: `sh-${idx}`,
                      style: {
                        display: 'flex',
                        background: '#223033',
                        border: '2px solid #b9c2d2',
                        borderRadius: '6px',
                        padding: '5px 12px',
                        fontSize: '22px',
                        color: '#ffffff',
                      },
                    },
                    it
                  )
                )
              : [
                  h(
                    'div',
                    { key: 'open', style: { display: 'flex', color: '#c7dcd3', fontSize: '24px' } },
                    'Inspect full shop queue & booster packs'
                  ),
                ])
          )
        )
      )
    ),

    // Footer
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '22px',
          color: '#9db0b4',
        },
      },
      h('div', { style: { display: 'flex' } }, 'Powered by motely-wasm  |  Real Balatro RNG'),
      h('div', { style: { display: 'flex', color: '#f5b841' } }, 'Open in seedfinder.app')
    )
  );
}
