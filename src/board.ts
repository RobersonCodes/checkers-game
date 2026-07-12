import type { Board, Move, Piece, Position } from "./types";

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

export interface MoveUndo {
  from: Position;
  to: Position;
  piece: Piece;
  wasKing: boolean;
  captured: { position: Position; piece: Piece }[];
}

/**
 * Applies a move by mutating the board and its piece objects in place,
 * returning enough information to reverse it via undoMoveInPlace. This
 * exists only for the AI search: cloning a fresh board (applyMove above) at
 * every node of a minimax tree dominates its allocation cost, whereas
 * mutate-then-undo is the standard technique to avoid that. Game state
 * transitions should keep going through the immutable applyMove/cloneBoard
 * pair, where sharing board references across renders/history would be a bug.
 */
export function makeMoveInPlace(board: Board, move: Move): MoveUndo {
  const piece = board[move.from.row][move.from.col]!;
  const wasKing = piece.isKing;

  const captured: { position: Position; piece: Piece }[] = [];
  for (const position of move.captured) {
    const capturedPiece = board[position.row][position.col]!;
    captured.push({ position, piece: capturedPiece });
    board[position.row][position.col] = null;
  }

  board[move.from.row][move.from.col] = null;
  piece.row = move.to.row;
  piece.col = move.to.col;
  if (move.promotes) piece.isKing = true;
  board[move.to.row][move.to.col] = piece;

  return { from: move.from, to: move.to, piece, wasKing, captured };
}

/** Reverses a makeMoveInPlace call, restoring the board and piece objects to their prior state. */
export function undoMoveInPlace(board: Board, undo: MoveUndo): void {
  const { piece } = undo;
  board[undo.to.row][undo.to.col] = null;
  piece.row = undo.from.row;
  piece.col = undo.from.col;
  piece.isKing = undo.wasKing;
  board[undo.from.row][undo.from.col] = piece;

  for (const { position, piece: capturedPiece } of undo.captured) {
    board[position.row][position.col] = capturedPiece;
  }
}
