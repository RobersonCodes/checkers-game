import { describe, expect, it } from "vitest";
import { boardFromRows } from "./testUtils";
import { getAllValidMoves } from "./rules";
import { getBestMove } from "./ai";

describe("getBestMove", () => {
  it("returns null when the AI's side has no legal move", () => {
    const board = boardFromRows([
      "........",
      "........",
      "........",
      "........",
      "........",
      "..b.....",
      ".b......",
      "r.......",
    ]);
    expect(getBestMove(board, "red", "easy")).toBeNull();
  });

  it("takes the only legal move without needing to search when just one exists", () => {
    // Mandatory-capture chain forces a single legal move for red.
    const board = boardFromRows([
      "........",
      "........",
      "........",
      "........",
      "...b....",
      "........",
      ".b....b.",
      "r......r",
    ]);
    const move = getBestMove(board, "red", "easy");
    expect(move?.from).toEqual({ row: 7, col: 0 });
    expect(move?.captured).toHaveLength(2);
  });

  it("looks ahead to avoid hanging a piece to an immediate recapture", () => {
    // Red can step to (4,3) or (4,5). Stepping to (4,3) leaves (5,4) empty,
    // letting the black man at (3,2) capture it right back next ply.
    // Stepping to (4,5) is completely safe. Any real search (even the
    // shallow "easy" depth) must prefer the safe square.
    const board = boardFromRows([
      "........",
      "........",
      "........",
      "..b.....",
      "........",
      "....r...",
      "........",
      "........",
    ]);

    const rootMoves = getAllValidMoves(board, "red");
    expect(rootMoves.map(m => `${m.to.row},${m.to.col}`).sort()).toEqual(["4,3", "4,5"]);

    const move = getBestMove(board, "red", "easy");
    expect(move?.to).toEqual({ row: 4, col: 5 });
  });

  it("keeps avoiding the hanging square at every difficulty depth", () => {
    const board = boardFromRows([
      "........",
      "........",
      "........",
      "..b.....",
      "........",
      "....r...",
      "........",
      "........",
    ]);

    for (const difficulty of ["easy", "medium", "hard"] as const) {
      const move = getBestMove(board, "red", difficulty);
      expect(move?.to, `difficulty=${difficulty}`).toEqual({ row: 4, col: 5 });
    }
  });

  it("only ever returns a move that rules.ts considers legal", () => {
    const board = boardFromRows([
      "........",
      "........",
      "........",
      "........",
      "...b....",
      "........",
      ".b....b.",
      "r......r",
    ]);
    const legal = getAllValidMoves(board, "red");
    const move = getBestMove(board, "red", "medium");
    expect(legal).toContainEqual(move);
  });
});
