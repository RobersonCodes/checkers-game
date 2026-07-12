import type { Board, Difficulty, Piece, Player } from "./types";

const SAVE_KEY = "checkers-save-v1";
const SCORE_KEY = "checkers-score-v1";

export interface Score {
  red: number;
  black: number;
  draws: number;
}

export interface SavedGame {
  board: Board;
  currentPlayer: Player;
  history: string[];
  redName: string;
  blackName: string;
  vsAI: boolean;
  difficulty: Difficulty;
  aiColor: Player;
}

/** Where Game reads/writes its save slot and persistent score. Lets tests swap in an in-memory fake instead of touching localStorage. */
export interface SaveRepository {
  loadGame(): SavedGame | null;
  saveGame(data: SavedGame): void;
  loadScore(): Score;
  saveScore(score: Score): void;
}

function isPlayer(value: unknown): value is Player {
  return value === "red" || value === "black";
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === "easy" || value === "medium" || value === "hard";
}

function isPiece(value: unknown): value is Piece {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === "number" &&
    typeof p.row === "number" &&
    typeof p.col === "number" &&
    p.row >= 0 &&
    p.row < 8 &&
    p.col >= 0 &&
    p.col < 8 &&
    isPlayer(p.color) &&
    typeof p.isKing === "boolean"
  );
}

function isBoard(value: unknown): value is Board {
  if (!Array.isArray(value) || value.length !== 8) return false;
  return value.every(row => Array.isArray(row) && row.length === 8 && row.every(cell => cell === null || isPiece(cell)));
}

/** Validates the shape of data parsed from localStorage before it is trusted as live game state. */
function isSavedGame(value: unknown): value is SavedGame {
  if (typeof value !== "object" || value === null) return false;
  const d = value as Record<string, unknown>;
  return (
    isBoard(d.board) &&
    isPlayer(d.currentPlayer) &&
    Array.isArray(d.history) &&
    d.history.every(entry => typeof entry === "string") &&
    typeof d.redName === "string" &&
    typeof d.blackName === "string" &&
    typeof d.vsAI === "boolean" &&
    isDifficulty(d.difficulty) &&
    isPlayer(d.aiColor)
  );
}

function isScore(value: unknown): value is Omit<Score, "draws"> & { draws?: number } {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return typeof s.red === "number" && typeof s.black === "number" && (s.draws === undefined || typeof s.draws === "number");
}

/** Reads/writes the save slot and score through the browser's localStorage. */
export class LocalStorageSaveRepository implements SaveRepository {
  loadGame(): SavedGame | null {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    try {
      const data: unknown = JSON.parse(raw);
      return isSavedGame(data) ? data : null;
    } catch {
      return null;
    }
  }

  saveGame(data: SavedGame): void {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  loadScore(): Score {
    try {
      const raw = localStorage.getItem(SCORE_KEY);
      if (!raw) return { red: 0, black: 0, draws: 0 };
      const data: unknown = JSON.parse(raw);
      if (!isScore(data)) return { red: 0, black: 0, draws: 0 };
      return { red: data.red, black: data.black, draws: data.draws ?? 0 };
    } catch {
      return { red: 0, black: 0, draws: 0 };
    }
  }

  saveScore(score: Score): void {
    localStorage.setItem(SCORE_KEY, JSON.stringify(score));
  }
}
