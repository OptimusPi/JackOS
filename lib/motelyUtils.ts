/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum MotelyItemSeal {
    None = "None",
    Red = "Red",
    Blue = "Blue",
    Gold = "Gold",
    Purple = "Purple"
}

export enum MotelyItemEdition {
    None = "None",
    Base = "Base",
    Foil = "Foil",
    Holographic = "Holographic",
    Polychrome = "Polychrome",
    Negative = "Negative"
}

export enum MotelyItemEnhancement {
    None = "None",
    Bonus = "Bonus",
    Mult = "Mult",
    Wild = "Wild",
    Glass = "Glass",
    Steel = "Steel",
    Stone = "Stone",
    Gold = "Gold",
    Lucky = "Lucky"
}

export const formatDisplayName = (name: string): string => {
    const specialCases: Record<string, string> = {
        "EightBall": "8 Ball",
        "Cloud9": "Cloud 9",
        "OopsAll6s": "Oops! All 6s",
        "ToTheMoon": "To the Moon",
        "ToDoList": "To Do List",
        "RiffRaff": "Riff-raff",
        "MailInRebate": "Mail In Rebate",
        "TheWheel": "The Wheel",
        "TheWheelOfFortune": "The Wheel of Fortune",
        "SockandBuskin": "Sock and Buskin",
        "SockAndBuskin": "Sock and Buskin",
        "DriversLicense": "Driver's License",
        "DirectorsCut": "Director's Cut",
        "PlanetX": "Planet X",
        "Soul": "The Soul",
        "MrBones": "Mr. Bones",
        "ChaostheClown": "Chaos the Clown",
        "ChaosTheClown": "Chaosthe Clown",
        "ShootTheMoon": "Shoot the Moon",
        "RideTheBus": "Ride the Bus",
        "HitTheRoad": "Hit the Road",
        "TheVerdant": "Verdant Leaf",
        "VerdantLeaf": "Verdant Leaf",
        "VioletVessel": "Violet Vessel",
        "CrimsonHeart": "Crimson Heart",
        "AmberAcorn": "Amber Acorn",
        "CeruleanBell": "Cerulean Bell",
        "TheFool": "The Fool",
        "TheMagician": "The Magician",
        "TheHighPriestess": "The High Priestess",
        "TheEmpress": "The Empress",
        "TheEmperor": "The Emperor",
        "TheHierophant": "The Hierophant",
        "TheLovers": "The Lovers",
        "TheChariot": "The Chariot",
        "TheHermit": "The Hermit",
        "Justice": "Justice",
        "TheJustice": "Justice",
        "TheHangedMan": "The Hanged Man",
        "Death": "Death",
        "TheDeath": "Death",
        "Temperance": "Temperance",
        "TheTemperance": "Temperance",
        "TheDevil": "The Devil",
        "TheTower": "The Tower",
        "TheStar": "The Star",
        "TheMoon": "The Moon",
        "TheSun": "The Sun",
        "Judgement": "Judgement",
        "TheWorld": "The World",
        "Strength": "Strength",
    };

    if (specialCases[name]) return specialCases[name];

    let result = "";
    for (let i = 0; i < name.length; i++) {
        if (i > 0 && name[i] === name[i].toUpperCase() && name[i - 1] !== name[i - 1].toUpperCase()) {
            result += " ";
        }
        result += name[i];
    }
    return result;
};

export const formatPackName = (pack: string): string => {
    const packs: Record<string, string> = {
        "Arcana": "Arcana Pack",
        "JumboArcana": "Jumbo Arcana Pack",
        "MegaArcana": "Mega Arcana Pack",
        "Celestial": "Celestial Pack",
        "JumboCelestial": "Jumbo Celestial Pack",
        "MegaCelestial": "Mega Celestial Pack",
        "Spectral": "Spectral Pack",
        "JumboSpectral": "Jumbo Spectral Pack",
        "MegaSpectral": "Mega Spectral Pack",
        "Buffoon": "Buffoon Pack",
        "JumboBuffoon": "Jumbo Buffoon Pack",
        "MegaBuffoon": "Mega Buffoon Pack",
        "Standard": "Standard Pack",
        "JumboStandard": "Jumbo Standard Pack",
        "MegaStandard": "Mega Standard Pack",
    };
    return packs[pack] || formatDisplayName(pack);
};

export const formatCard = (cardCode: string): string => {
    const [rankCode, suitCode] = cardCode.split('_');
    const ranks: Record<string, string> = {
        "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8", "9": "9", "10": "10",
        "J": "Jack", "Q": "Queen", "K": "King", "A": "Ace"
    };
    const suits: Record<string, string> = {
        "C": "Clubs", "D": "Diamonds", "H": "Hearts", "S": "Spades"
    };
    return `${ranks[rankCode] || rankCode} of ${suits[suitCode] || suitCode}`;
};
