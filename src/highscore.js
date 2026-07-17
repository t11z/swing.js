// Top-10 highscore list in localStorage.
import { STORAGE } from './config.js';

const MAX_ENTRIES = 10;

export function loadScores() {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE.SCORES));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Returns the 1-based rank of the new entry, or null if it didn't make the list.
export function addScore(entry) {
  const e = {
    name: entry.name || '???',
    score: entry.score | 0,
    level: entry.level | 0,
    difficulty: entry.difficulty,
    date: entry.date ?? Date.now(),
  };
  const list = loadScores();
  list.push(e);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE.SCORES, JSON.stringify(trimmed));
  } catch { /* ignore */ }
  const rank = trimmed.indexOf(e);
  return rank >= 0 ? rank + 1 : null;
}

export function loadName() {
  try {
    return localStorage.getItem(STORAGE.NAME) || '';
  } catch {
    return '';
  }
}

export function saveName(name) {
  try {
    localStorage.setItem(STORAGE.NAME, name);
  } catch { /* ignore */ }
}
