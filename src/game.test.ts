import { describe, expect, it } from "vitest";
import type { SaveRepository, SavedGame, Score } from "./persistence";
import { Game } from "./game";
import { boardFromRows } from "./testUtils";
import { getAllValidMoves } from "./rules";

/** In-memory stand-in for LocalStorageSaveRepository, proving Game never touches localStorage directly. */
function fakeRepository(initialScore: Score = { red: 0, black: 0, draws: 0 }): SaveRepository & { savedGame: SavedGame | null; savedScoreCalls: Score[] } {
  return {
    savedGame: null,
    savedScoreCalls: [],
    loadGame() {
      return this.savedGame;
    },
    saveGame(data: SavedGame) {
      this.savedGame = data;
    },
    loadScore() {
      return initialScore;
    },
    saveScore(score: Score) {
      this.savedScoreCalls.push(score);
    },
  };
}

describe("Game persistence (injected repository)", () => {
  it("reads its starting score from the injected repository, not localStorage", () => {
    const repo = fakeRepository({ red: 3, black: 1, draws: 2 });
    const game = new Game(repo);
    expect(game.score).toEqual({ red: 3, black: 1, draws: 2 });
  });

  it("persists a win through the repository's saveScore, not a global", () => {
    const repo = fakeRepository();
    const game = new Game(repo);

    // Black's only piece is one capture away from being wiped out.
    game.board = boardFromRows([
      "........",
      "........",
      "........",
      "........",
      "...b....",
      "....r...",
      "........",
      "........",
    ]);
    game.currentPlayer = "red";

    const [move] = getAllValidMoves(game.board, "red");
    game.executeMove(move);

    expect(game.gameOver).toBe(true);
    expect(game.winner).toBe("red");
    expect(repo.savedScoreCalls).toContainEqual({ red: 1, black: 0, draws: 0 });
  });

  it("load() returns false and leaves state untouched when the repository has nothing saved", () => {
    // Shape validation of raw localStorage data lives in LocalStorageSaveRepository
    // (see persistence.test.ts) — Game only needs to trust its repo's null/non-null contract.
    const repo = fakeRepository();
    const game = new Game(repo);
    const boardBefore = game.board;

    expect(game.load()).toBe(false);
    expect(game.board).toBe(boardBefore);
  });

  it("load() applies a well-formed saved payload from the repository", () => {
    const repo = fakeRepository();
    const game = new Game(repo);
    game.rename("Ana", "Beto");
    game.save();

    const freshGame = new Game(repo);
    expect(freshGame.load()).toBe(true);
    expect(freshGame.redName).toBe("Ana");
    expect(freshGame.blackName).toBe("Beto");
  });

  it("defaults to a working repository when none is injected", () => {
    // No repo passed — Game must fall back to LocalStorageSaveRepository without throwing,
    // even outside a real browser (vitest's default environment still provides localStorage).
    expect(() => new Game()).not.toThrow();
  });
});
