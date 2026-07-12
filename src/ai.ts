import type { Board, Difficulty, Move, Player } from "./types";
import { makeMoveInPlace, undoMoveInPlace } from "./board";
import { getAllValidMoves, opponent } from "./rules";

const MAN_VALUE = 100;
const KING_VALUE = 175;
const ADVANCE_WEIGHT = 4;
const CENTER_WEIGHT = 2;
const BACK_ROW_WEIGHT = 12;
const MOBILITY_WEIGHT = 1.5;
const WIN_SCORE = 100000;

const DEPTH_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 2,
  medium: 4,
  hard: 6,
};

function backRowFor(color: Player): number {
  // A piece's own back row is the opponent's promotion row — occupying it
  // denies the opponent a place to crown a king.
  return color === "red" ? 7 : 0;
}

const KING_STEPS: [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

function forwardRowStep(color: Player): number {
  return color === "red" ? -1 : 1;
}

/**
 * Cheap mobility proxy: counts empty squares immediately reachable by each
 * piece (kings: all 4 diagonal neighbors; men: their 2 forward neighbors).
 * evaluateBoard() is called at every leaf of the search tree, so this
 * deliberately does NOT call getAllValidMoves() here — that would re-run the
 * full capture-chain generator for both sides at every leaf just to score a
 * secondary heuristic term, which was the single most expensive avoidable
 * cost in the AI (see board.ts's makeMoveInPlace for the matching fix on
 * the allocation side).
 */
function countMobility(board: Board, player: Player): number {
  let mobility = 0;
  for (const row of board) {
    for (const piece of row) {
      if (!piece || piece.color !== player) continue;
      const steps = piece.isKing ? KING_STEPS : ([[forwardRowStep(piece.color), -1], [forwardRowStep(piece.color), 1]] as const);
      for (const [dr, dc] of steps) {
        const r = piece.row + dr;
        const c = piece.col + dc;
        if (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === null) mobility++;
      }
    }
  }
  return mobility;
}

function evaluateBoard(board: Board, aiPlayer: Player): number {
  let score = 0;

  for (const row of board) {
    for (const piece of row) {
      if (!piece) continue;
      const sign = piece.color === aiPlayer ? 1 : -1;

      score += sign * (piece.isKing ? KING_VALUE : MAN_VALUE);

      if (!piece.isKing) {
        const progress = piece.color === "red" ? 7 - piece.row : piece.row;
        score += sign * progress * ADVANCE_WEIGHT;

        if (piece.row === backRowFor(piece.color)) {
          score += sign * BACK_ROW_WEIGHT;
        }
      }

      const centrality = Math.min(piece.col, 7 - piece.col);
      score += sign * centrality * CENTER_WEIGHT;
    }
  }

  const mobility = countMobility(board, aiPlayer) - countMobility(board, opponent(aiPlayer));
  score += mobility * MOBILITY_WEIGHT;

  return score;
}

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  turnPlayer: Player,
  aiPlayer: Player
): number {
  const moves = getAllValidMoves(board, turnPlayer);
  const maximizing = turnPlayer === aiPlayer;

  if (moves.length === 0) {
    // The player to move has no legal moves: they lose.
    return maximizing ? -WIN_SCORE : WIN_SCORE;
  }

  if (depth === 0) {
    return evaluateBoard(board, aiPlayer);
  }

  const next = opponent(turnPlayer);

  if (maximizing) {
    let value = -Infinity;
    for (const move of moves) {
      const undo = makeMoveInPlace(board, move);
      value = Math.max(value, minimax(board, depth - 1, alpha, beta, next, aiPlayer));
      undoMoveInPlace(board, undo);
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }

  let value = Infinity;
  for (const move of moves) {
    const undo = makeMoveInPlace(board, move);
    value = Math.min(value, minimax(board, depth - 1, alpha, beta, next, aiPlayer));
    undoMoveInPlace(board, undo);
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return value;
}

/** Picks the AI's move via minimax with alpha-beta pruning, depth scaled by difficulty. */
export function getBestMove(board: Board, aiPlayer: Player, difficulty: Difficulty): Move | null {
  const moves = getAllValidMoves(board, aiPlayer);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const depth = DEPTH_BY_DIFFICULTY[difficulty];
  let best: Move[] = [];
  let bestScore = -Infinity;

  for (const move of moves) {
    const undo = makeMoveInPlace(board, move);
    const score = minimax(board, depth - 1, -Infinity, Infinity, opponent(aiPlayer), aiPlayer);
    undoMoveInPlace(board, undo);

    if (score > bestScore) {
      bestScore = score;
      best = [move];
    } else if (score === bestScore) {
      best.push(move);
    }
  }

  return best[Math.floor(Math.random() * best.length)];
}
