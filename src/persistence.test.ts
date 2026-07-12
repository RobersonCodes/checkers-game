import { beforeEach, describe, expect, it } from "vitest";
import type { SavedGame } from "./persistence";
import { LocalStorageSaveRepository } from "./persistence";
import { createInitialBoard } from "./board";

const SAVE_KEY = "checkers-save-v1";
const SCORE_KEY = "checkers-score-v1";

/** Minimal Storage stand-in — vitest's default "node" environment has no real localStorage. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

const validSavedGame: SavedGame = {
  board: createInitialBoard(),
  currentPlayer: "red",
  history: ["Vermelho: a3 → b4"],
  redName: "Ana",
  blackName: "Beto",
  vsAI: true,
  difficulty: "hard",
  aiColor: "black",
};

describe("LocalStorageSaveRepository.loadGame", () => {
  it("returns null when nothing is saved", () => {
    expect(new LocalStorageSaveRepository().loadGame()).toBeNull();
  });

  it("round-trips a well-formed save", () => {
    const repo = new LocalStorageSaveRepository();
    repo.saveGame(validSavedGame);
    expect(repo.loadGame()).toEqual(validSavedGame);
  });

  it("rejects a payload with the wrong shape instead of returning it", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ board: "not-a-board" }));
    expect(new LocalStorageSaveRepository().loadGame()).toBeNull();
  });

  it("rejects a board that isn't 8x8 instead of returning it", () => {
    const corrupted = { ...validSavedGame, board: validSavedGame.board.slice(0, 6) };
    localStorage.setItem(SAVE_KEY, JSON.stringify(corrupted));
    expect(new LocalStorageSaveRepository().loadGame()).toBeNull();
  });

  it("rejects invalid JSON instead of throwing", () => {
    localStorage.setItem(SAVE_KEY, "{not valid json");
    expect(() => new LocalStorageSaveRepository().loadGame()).not.toThrow();
    expect(new LocalStorageSaveRepository().loadGame()).toBeNull();
  });
});

describe("LocalStorageSaveRepository.loadScore", () => {
  it("defaults to zeroes when nothing is saved", () => {
    expect(new LocalStorageSaveRepository().loadScore()).toEqual({ red: 0, black: 0, draws: 0 });
  });

  it("defaults draws to 0 for a pre-existing score payload that predates the draws field", () => {
    localStorage.setItem(SCORE_KEY, JSON.stringify({ red: 2, black: 1 }));
    expect(new LocalStorageSaveRepository().loadScore()).toEqual({ red: 2, black: 1, draws: 0 });
  });

  it("round-trips a full score", () => {
    const repo = new LocalStorageSaveRepository();
    repo.saveScore({ red: 4, black: 2, draws: 1 });
    expect(repo.loadScore()).toEqual({ red: 4, black: 2, draws: 1 });
  });
});
