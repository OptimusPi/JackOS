import jokersSheet from 'jaml-ui/assets/Jokers.png';
import tarotsSheet from 'jaml-ui/assets/Tarots.png';
import vouchersSheet from 'jaml-ui/assets/Vouchers.png';
import tagsSheet from 'jaml-ui/assets/tags.png';
import boostersSheet from 'jaml-ui/assets/Boosters.png';
import blindsSheet from 'jaml-ui/assets/BlindChips.png';
import editionsSheet from 'jaml-ui/assets/Editions.png';
import enhancersSheet from 'jaml-ui/assets/Enhancers.png';
import stickersSheet from 'jaml-ui/assets/stickers.png';
import deckSheet from 'jaml-ui/assets/8BitDeck.png';
import stakesSheet from 'jaml-ui/assets/balatro-stake-chips.png';

export const JimboColor = {
  RED: '#ff4c40',
  BLUE: '#0093ff',
  GREEN: '#429f79',
  ORANGE: '#ff9800',
  GOLD: '#e4b643',
  PURPLE: '#9e74ce',

  DARK_RED: '#a02721',
  DARK_BLUE: '#0057a1',
  DARK_ORANGE: '#a05b00',
  DARK_GREEN: '#215f46',
  DARK_PURPLE: '#5e437e',

  DARK_GREY: '#3a5055',
  DARKEST: '#1e2b2d',
  GREY: '#708386',
  TEAL_GREY: '#404c4e',

  PANEL_EDGE: '#1e2e32',
  INNER_BORDER: '#334461',

  BORDER_SILVER: '#b9c2d2',
  BORDER_SOUTH: '#777e89',

  GOLD_TEXT: '#e4b643',
  GREEN_TEXT: '#35bd86',
  ORANGE_TEXT: '#ff8f00',
  WHITE: '#ffffff',
  BLACK: '#000000',
};

export const SHEETS = {
  jokers:    { src: jokersSheet,    cols: 10, rows: 16 },
  tarots:    { src: tarotsSheet,    cols: 10, rows: 6  },
  vouchers:  { src: vouchersSheet,  cols: 9,  rows: 4  },
  tags:      { src: tagsSheet,      cols: 6,  rows: 5  },
  boosters:  { src: boostersSheet,  cols: 4,  rows: 9  },
  blinds:    { src: blindsSheet,    cols: 21, rows: 31 },
  editions:  { src: editionsSheet,  cols: 5,  rows: 1  },
  enhancers: { src: enhancersSheet, cols: 7,  rows: 5  },
  stickers:  { src: stickersSheet,  cols: 5,  rows: 3  },
  decks:     { src: deckSheet,      cols: 13, rows: 4  },
  stakes:    { src: stakesSheet,    cols: 5,  rows: 2  },
} as const;
