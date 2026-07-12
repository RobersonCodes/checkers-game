import { describe, expect, it } from "vitest";
import { boardFromRows } from "./testUtils";
import {
  countPieces,
  getAllValidMoves,
  getCaptureSequencesForPiece,
  getSimpleMovesForPiece,
  getValidMovesForSquare,
  hasAnyMoves,
  opponent,
} from "./rules";

describe("getSimpleMovesForPiece", () => {
  it("moves a man diagonally forward only, never sideways/backward", () => {
    const board = boardFromRows([
      "........",
      "........",
      "........",
      "........",
      "........",
      "....r...",
      "........",
      "........",
    ]);
    const piece = board[5][4]!;
    const moves = getSimpleMovesForPiece(board, piece);
    const targets = moves.map(m => `${m.to.row},${m.to.col}`).sort();
    expect(targets).toEqual(["4,3", "4,5"]);
  });

  it("promotes a man that reaches the far row", () => {
    const board = boardFromRows([
      "........",
      "...r....",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
    ]);
    const piece = board[1][3]!;
    const moves = getSimpleMovesForPiece(board, piece);
    const toBackRow = moves.find(m => m.to.row === 0);
    expect(toBackRow?.promotes).toBe(true);
  });

  it("slides a king along the whole open diagonal, stopping at the edge", () => {
    const board = boardFromRows([
      "........",
      "........",
      "........",
      "........",
      "....R...",
      "........",
      "........",
      "........",
    ]);
    const king = board[4][4]!;
    const moves = getSimpleMovesForPiece(board, king);
    const upLeft = moves.filter(m => m.to.row < 4 && m.to.col < 4).map(m => `${m.to.row},${m.to.col}`).sort();
    expect(upLeft).toEqual(["0,0", "1,1", "2,2", "3,3"]);
  });
});

describe("getCaptureSequencesForPiece", () => {
  it("captures a single adjacent enemy and lands beyond it", () => {
    const board = boardFromRows([
      "........",
      "........",
      "........",
      "........",
      "...b....",
      "....r...",
      "........",
      "........",
    ]);
    const piece = board[5][4]!;
    const sequences = getCaptureSequencesForPiece(board, piece);
    expect(sequences).toHaveLength(1);
    expect(sequences[0].to).toEqual({ row: 3, col: 2 });
    expect(sequences[0].captured).toEqual([{ row: 4, col: 3 }]);
  });

  it("forces a man to continue a multi-jump chain instead of stopping after one capture", () => {
    const board = boardFromRows([
      "........",
      "........",
      "........",
      "........",
      "...b....",
      "........",
      ".b......",
      "r.......",
    ]);
    const piece = board[7][0]!;
    const sequences = getCaptureSequencesForPiece(board, piece);
    expect(sequences).toHaveLength(1);
    expect(sequences[0].to).toEqual({ row: 3, col: 4 });
    expect(sequences[0].captured).toEqual([
      { row: 6, col: 1 },
      { row: 4, col: 3 },
    ]);
  });

  it("stops a man's turn the instant a capture lands it on the crowning row, even if more captures exist", () => {
    const board = boardFromRows([
      "........",
      "..b.b...",
      ".r......",
      "........",
      "........",
      "........",
      "........",
      "........",
    ]);
    const piece = board[2][1]!;
    const sequences = getCaptureSequencesForPiece(board, piece);
    expect(sequences).toHaveLength(1);
    expect(sequences[0].to).toEqual({ row: 0, col: 3 });
    expect(sequences[0].captured).toEqual([{ row: 1, col: 2 }]);
    expect(sequences[0].promotes).toBe(true);
  });

  it("lets a flying king land on any empty square beyond the captured piece", () => {
    const board = boardFromRows([
      "........",
      "........",
      "........",
      "........",
      "...b....",
      "........",
      "........",
      "R.......",
    ]);
    const king = board[7][0]!;
    const sequences = getCaptureSequencesForPiece(board, king);
    const landings = sequences.map(m => `${m.to.row},${m.to.col}`).sort();
    expect(landings).toEqual(["0,7", "1,6", "2,5", "3,4"]);
    for (const move of sequences) {
      expect(move.captured).toEqual([{ row: 4, col: 3 }]);
    }
  });
});

describe("getAllValidMoves — mandatory capture and lei da maioria", () => {
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

  it("forbids simple moves once any capture is available", () => {
    const moves = getAllValidMoves(board, "red");
    expect(moves.every(m => m.captured.length > 0)).toBe(true);
  });

  it("keeps only the maximum-length capture chain across the whole side", () => {
    const moves = getAllValidMoves(board, "red");
    expect(moves).toHaveLength(1);
    expect(moves[0].from).toEqual({ row: 7, col: 0 });
    expect(moves[0].captured).toHaveLength(2);
  });

  it("filters out the shorter capture for the piece that isn't part of the majority move", () => {
    const movesForA = getValidMovesForSquare(board, "red", 7, 7);
    expect(movesForA).toHaveLength(0);
  });
});

describe("hasAnyMoves", () => {
  it("is false when the only piece is boxed in with no legal move", () => {
    // Red at (7,0) has one in-bounds diagonal (6,1); it's occupied by an
    // enemy whose own capture-landing square (5,2) is also occupied, so
    // neither a simple move nor a capture is possible.
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
    expect(hasAnyMoves(board, "red")).toBe(false);
  });

  it("is true once a legal move exists", () => {
    const board = boardFromRows([
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
      "r.......",
    ]);
    expect(hasAnyMoves(board, "red")).toBe(true);
  });
});

describe("countPieces", () => {
  it("separates men and kings per side", () => {
    const board = boardFromRows([
      "........",
      "........",
      "........",
      "........",
      "........",
      "b.B.....",
      "..b.....",
      "r.R.r...",
    ]);
    expect(countPieces(board, "red")).toEqual({ men: 2, kings: 1 });
    expect(countPieces(board, "black")).toEqual({ men: 2, kings: 1 });
  });
});

describe("opponent", () => {
  it("toggles between red and black", () => {
    expect(opponent("red")).toBe("black");
    expect(opponent("black")).toBe("red");
  });
});
