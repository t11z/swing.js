// Tiny i18n layer: t('key'), switchable German/English, persisted.
import { STORAGE } from './config.js';

const DICTS = {
  de: {
    title: 'SWING',
    subtitle: 'Ein Remake des Puzzle-Klassikers von 1997',
    start: 'Spiel starten',
    highscores: 'Highscores',
    difficulty: 'Schwierigkeit',
    'difficulty.easy': 'leicht',
    'difficulty.normal': 'normal',
    'difficulty.hard': 'schwer',
    extras: 'Extras',
    on: 'an',
    off: 'aus',
    language: 'Sprache',
    playerName: 'Spielername',
    level: 'Level',
    score: 'Score',
    bonus: 'Bonus',
    highscore: 'Highscore',
    time: 'Zeit',
    balls: 'Kugeln',
    pause: 'PAUSE',
    pauseHint: 'P oder ESC zum Fortsetzen',
    gameOver: 'GAME OVER',
    yourScore: 'Dein Score',
    enterName: 'Name eingeben und mit ENTER bestätigen',
    starPhase: 'STERNE-BONUS!',
    levelUp: 'LEVEL {level}',
    back: 'Zurück',
    noScores: 'Noch keine Einträge — spiel eine Runde!',
    controls: 'Steuerung: ←/→ oder Maus bewegen · Leertaste/↓/Klick wirft · P pausiert · M stumm',
    helpSeesaw: 'Wirf Kugeln auf die Wippen: 3 gleiche Farben nebeneinander räumen ab.',
    helpWeight: 'Die Zahl ist das Gewicht — die schwerere Seite kippt und schleudert Kugeln!',
    rank: 'Platz',
    ok: 'OK',
    touchControls: 'Touch: Tippen zielt, erneutes Tippen wirft',
  },
  en: {
    title: 'SWING',
    subtitle: 'A remake of the 1997 puzzle classic',
    start: 'Start game',
    highscores: 'High scores',
    difficulty: 'Difficulty',
    'difficulty.easy': 'easy',
    'difficulty.normal': 'normal',
    'difficulty.hard': 'hard',
    extras: 'Extras',
    on: 'on',
    off: 'off',
    language: 'Language',
    playerName: 'Player name',
    level: 'Level',
    score: 'Score',
    bonus: 'Bonus',
    highscore: 'High score',
    time: 'Time',
    balls: 'Balls',
    pause: 'PAUSED',
    pauseHint: 'P or ESC to resume',
    gameOver: 'GAME OVER',
    yourScore: 'Your score',
    enterName: 'Type your name and press ENTER',
    starPhase: 'STAR BONUS!',
    levelUp: 'LEVEL {level}',
    back: 'Back',
    noScores: 'No entries yet — play a round!',
    controls: 'Controls: ←/→ or move mouse · Space/↓/click drops · P pauses · M mutes',
    helpSeesaw: 'Drop balls onto the seesaws: 3 same colors side by side clear.',
    helpWeight: 'The number is the weight — the heavier side tips and catapults balls!',
    rank: 'Rank',
    ok: 'OK',
    touchControls: 'Touch: tap to aim, tap again to drop',
  },
};

let lang;
try {
  lang = localStorage.getItem(STORAGE.LANG);
} catch { /* storage unavailable */ }
if (!lang) lang = (globalThis.navigator?.language || 'en').startsWith('de') ? 'de' : 'en';

export function getLang() {
  return lang;
}

export function setLang(l) {
  lang = DICTS[l] ? l : 'en';
  try {
    localStorage.setItem(STORAGE.LANG, lang);
  } catch { /* ignore */ }
}

export function t(key, vars = {}) {
  let s = DICTS[lang]?.[key] ?? DICTS.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}
