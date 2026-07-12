import type { Board, Move, Piece, Player, Position } from "./types";

const DIAGONALS: [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function key(row: number, col: number): string {
  return `${row},${col}`;
}

function promotionRow(color: Player): number {
  // Red starts at the bottom and advances toward row 0; black is the opposite.
  return color === "red" ? 0 : 7;
}

function forwardDirections(color: Player): [number, number][] {
  const rowStep = color === "red" ? -1 : 1;
  return [
    [rowStep, -1],
    [rowStep, 1],
  ];
}

/** Squares physically occupied right now, honoring squares the moving piece has already left. */
function occupied(board: Board, row: number, col: number, vacated: Set<string>): boolean {
  if (vacated.has(key(row, col))) return false;
  return board[row][col] !== null;
}

export function getSimpleMovesForPiece(board: Board, piece: Piece): Move[] {
  const moves: Move[] = [];
  const directions = piece.isKing ? DIAGONALS : forwardDirections(piece.color);

  if (piece.isKing) {
    for (const [dr, dc] of directions) {
      let row = piece.row + dr;
      let col = piece.col + dc;
      while (inBounds(row, col) && board[row][col] === null) {
        moves.push({
          from: { row: piece.row, col: piece.col },
          to: { row, col },
          captured: [],
          promotes: false,
        });
        row += dr;
        col += dc;
      }
    }
    return moves;
  }

  for (const [dr, dc] of directions) {
    const row = piece.row + dr;
    const col = piece.col + dc;
    if (inBounds(row, col) && board[row][col] === null) {
      moves.push({
        from: { row: piece.row, col: piece.col },
        to: { row, col },
        captured: [],
        promotes: row === promotionRow(piece.color),
      });
    }
  }

  return moves;
}

interface CaptureState {
  currentRow: number;
  currentCol: number;
  capturedSet: Set<string>;
  vacated: Set<string>;
  path: Position[];
}

function manCaptureLegs(
  board: Board,
  piece: Piece,
  state: CaptureState
): { row: number; col: number; capturedAt: Position; capturedSet: Set<string>; vacated: Set<string> }[] {
  const legs: {
    row: number;
    col: number;
    capturedAt: Position;
    capturedSet: Set<string>;
    vacated: Set<string>;
  }[] = [];

  for (const [dr, dc] of DIAGONALS) {
    const midRow = state.currentRow + dr;
    const midCol = state.currentCol + dc;
    const landRow = state.currentRow + dr * 2;
    const landCol = state.currentCol + dc * 2;

    if (!inBounds(landRow, landCol)) continue;
    if (!occupied(board, midRow, midCol, state.vacated)) continue;
    if (state.capturedSet.has(key(midRow, midCol))) continue;

    const midPiece = board[midRow][midCol]!;
    if (midPiece.color === piece.color) continue;
    if (occupied(board, landRow, landCol, state.vacated)) continue;

    const nextCaptured = new Set(state.capturedSet);
    nextCaptured.add(key(midRow, midCol));
    const nextVacated = new Set(state.vacated);
    nextVacated.add(key(state.currentRow, state.currentCol));

    legs.push({
      row: landRow,
      col: landCol,
      capturedAt: { row: midRow, col: midCol },
      capturedSet: nextCaptured,
      vacated: nextVacated,
    });
  }

  return legs;
}

function kingCaptureLegs(
  board: Board,
  piece: Piece,
  state: CaptureState
): { row: number; col: number; capturedAt: Position; capturedSet: Set<string>; vacated: Set<string> }[] {
  const legs: {
    row: number;
    col: number;
    capturedAt: Position;
    capturedSet: Set<string>;
    vacated: Set<string>;
  }[] = [];

  for (const [dr, dc] of DIAGONALS) {
    let row = state.currentRow + dr;
    let col = state.currentCol + dc;

    // Scan outward for the first occupied square along this diagonal.
    while (inBounds(row, col) && !occupied(board, row, col, state.vacated)) {
      row += dr;
      col += dc;
    }

    if (!inBounds(row, col)) continue;

    const blockerPiece = board[row][col];
    const isAlreadyCaptured = state.capturedSet.has(key(row, col));
    if (!blockerPiece || blockerPiece.color === piece.color || isAlreadyCaptured) {
      continue; // own piece, or an already-spent capture, blocks this direction entirely
    }

    const capturedAt: Position = { row, col };
    let landRow = row + dr;
    let landCol = col + dc;

    while (inBounds(landRow, landCol) && !occupied(board, landRow, landCol, state.vacated)) {
      const nextCaptured = new Set(state.capturedSet);
      nextCaptured.add(key(capturedAt.row, capturedAt.col));
      const nextVacated = new Set(state.vacated);
      nextVacated.add(key(state.currentRow, state.currentCol));

      legs.push({
        row: landRow,
        col: landCol,
        capturedAt,
        capturedSet: nextCaptured,
        vacated: nextVacated,
      });

      landRow += dr;
      landCol += dc;
    }
  }

  return legs;
}

/**
 * Every complete capture chain available to a piece, expressed as terminal
 * moves (from the piece's original square to its final landing square,
 * with every captured square along the way). Continuation is mandatory
 * whenever a further capture exists, and a man that promotes mid-chain
 * stops immediately even if more jumps remain on the board.
 */
export function getCaptureSequencesForPiece(board: Board, piece: Piece): Move[] {
  const results: Move[] = [];

  function explore(state: CaptureState, isKing: boolean) {
    const legs = isKing ? kingCaptureLegs(board, piece, state) : manCaptureLegs(board, piece, state);

    if (legs.length === 0) {
      if (state.path.length > 0) {
        results.push({
          from: { row: piece.row, col: piece.col },
          to: { row: state.currentRow, col: state.currentCol },
          captured: state.path,
          promotes: false,
        });
      }
      return;
    }

    for (const leg of legs) {
      const nextPath = [...state.path, leg.capturedAt];
      const promotesHere = !isKing && leg.row === promotionRow(piece.color);

      if (promotesHere) {
        results.push({
          from: { row: piece.row, col: piece.col },
          to: { row: leg.row, col: leg.col },
          captured: nextPath,
          promotes: true,
        });
        continue; // a freshly-crowned king may not keep capturing this turn
      }

      explore(
        {
          currentRow: leg.row,
          currentCol: leg.col,
          capturedSet: leg.capturedSet,
          vacated: leg.vacated,
          path: nextPath,
        },
        isKing
      );
    }
  }

  explore(
    {
      currentRow: piece.row,
      currentCol: piece.col,
      capturedSet: new Set(),
      vacated: new Set(),
      path: [],
    },
    piece.isKing
  );

  return results;
}

function allPieces(board: Board, player: Player): Piece[] {
  const pieces: Piece[] = [];
  for (const row of board) {
    for (const cell of row) {
      if (cell && cell.color === player) pieces.push(cell);
    }
  }
  return pieces;
}

/**
 * Legal moves for a player this turn, with capture rules fully enforced:
 * if any piece can capture, only capture moves are legal, and only the
 * one(s) reaching the maximum number of captures across the whole side
 * (the official "lei da maioria" majority-capture rule).
 */
export function getAllValidMoves(board: Board, player: Player): Move[] {
  const pieces = allPieces(board, player);
  const captureMoves = pieces.flatMap(piece => getCaptureSequencesForPiece(board, piece));

  if (captureMoves.length > 0) {
    const maxCaptures = Math.max(...captureMoves.map(m => m.captured.length));
    return captureMoves.filter(m => m.captured.length === maxCaptures);
  }

  return pieces.flatMap(piece => getSimpleMovesForPiece(board, piece));
}

export function getValidMovesForSquare(board: Board, player: Player, row: number, col: number): Move[] {
  return getAllValidMoves(board, player).filter(m => m.from.row === row && m.from.col === col);
}

export function hasAnyMoves(board: Board, player: Player): boolean {
  return getAllValidMoves(board, player).length > 0;
}

export function countPieces(board: Board, player: Player): { men: number; kings: number } {
  const pieces = allPieces(board, player);
  return {
    men: pieces.filter(p => !p.isKing).length,
    kings: pieces.filter(p => p.isKing).length,
  };
}

export function opponent(player: Player): Player {
  return player === "red" ? "black" : "red";
}
