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
