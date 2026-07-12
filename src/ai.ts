import type { Board, Difficulty, Move, Player } from "./types";
import { applyMove } from "./board";
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

  const mobility = getAllValidMoves(board, aiPlayer).length - getAllValidMoves(board, opponent(aiPlayer)).length;
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
      const child = applyMove(board, move);
      value = Math.max(value, minimax(child, depth - 1, alpha, beta, next, aiPlayer));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }

  let value = Infinity;
  for (const move of moves) {
    const child = applyMove(board, move);
    value = Math.min(value, minimax(child, depth - 1, alpha, beta, next, aiPlayer));
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
    const child = applyMove(board, move);
    const score = minimax(child, depth - 1, -Infinity, Infinity, opponent(aiPlayer), aiPlayer);

    if (score > bestScore) {
      bestScore = score;
      best = [move];
    } else if (score === bestScore) {
      best.push(move);
    }
  }

  return best[Math.floor(Math.random() * best.length)];
}
