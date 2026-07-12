import type { Board, Player } from "./types";

let nextId = 1;

export function emptyBoard(): Board {
  return Array.from({ length: 8 }, () => Array(8).fill(null));
}

/**
 * Builds a board from 8 row strings (row 0 first). Each character is one column:
 * "." empty, "r"/"b" a red/black man, "R"/"B" a red/black king.
 */
export function boardFromRows(rows: string[]): Board {
  const board = emptyBoard();
  for (let row = 0; row < 8; row++) {
    const line = rows[row];
    for (let col = 0; col < 8; col++) {
      const ch = line[col];
      if (ch === ".") continue;
      const color: Player = ch.toLowerCase() === "r" ? "red" : "black";
      const isKing = ch === ch.toUpperCase();
      board[row][col] = { id: nextId++, row, col, color, isKing };
    }
  }
  return board;
}
