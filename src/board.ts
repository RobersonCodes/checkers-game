import type { Board, Move, Piece } from "./types";

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  let nextId = 1;

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 !== 0) {
        board[row][col] = {
          id: nextId++,
          row,
          col,
          color: "black",
          isKing: false,
        };
      }
    }
  }

  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 !== 0) {
        board[row][col] = {
          id: nextId++,
          row,
          col,
          color: "red",
          isKing: false,
        };
      }
    }
  }

  return board;
}

export function cloneBoard(board: Board): Board {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)));
}

/**
 * Applies an already-legal Move to a board and returns a new board.
 * Removes every captured piece (not just the midpoint — flying kings can
 * capture from a distance), relocates the moving piece and promotes it
 * to king when it lands on the back row.
 */
export function applyMove(board: Board, move: Move): Board {
  const newBoard = cloneBoard(board);
  const piece = newBoard[move.from.row][move.from.col];

  if (!piece) return newBoard;

  for (const captured of move.captured) {
    newBoard[captured.row][captured.col] = null;
  }

  const movedPiece: Piece = {
    ...piece,
    row: move.to.row,
    col: move.to.col,
    isKing: piece.isKing || move.promotes,
  };

  newBoard[move.from.row][move.from.col] = null;
  newBoard[move.to.row][move.to.col] = movedPiece;

  return newBoard;
}
