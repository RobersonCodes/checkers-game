import type { Board, Difficulty, Move, Piece, Player } from "./types";
import { applyMove, createInitialBoard } from "./board";
import { countPieces, getAllValidMoves, getValidMovesForSquare, hasAnyMoves, opponent } from "./rules";

const SAVE_KEY = "checkers-save-v1";
const SCORE_KEY = "checkers-score-v1";

/**
 * Half-moves (single plies) allowed without a capture or promotion before the
 * game is ruled a draw. 40 is the common simplified threshold used when the
 * official piece-count-dependent endgame rules aren't implemented — it exists
 * purely to guarantee every game reaches a terminal state.
 */
const DRAW_MOVE_LIMIT = 40;
const REPETITION_LIMIT = 3;

export interface Score {
  red: number;
  black: number;
  draws: number;
}

interface SavedGame {
  board: Board;
  currentPlayer: Player;
  history: string[];
  redName: string;
  blackName: string;
  vsAI: boolean;
  difficulty: Difficulty;
  aiColor: Player;
}

function posToNotation(row: number, col: number): string {
  const colLetter = "abcdefgh"[col];
  const rowNumber = 8 - row;
  return `${colLetter}${rowNumber}`;
}

function isPlayer(value: unknown): value is Player {
  return value === "red" || value === "black";
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === "easy" || value === "medium" || value === "hard";
}

function isPiece(value: unknown): value is Piece {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === "number" &&
    typeof p.row === "number" &&
    typeof p.col === "number" &&
    p.row >= 0 &&
    p.row < 8 &&
    p.col >= 0 &&
    p.col < 8 &&
    isPlayer(p.color) &&
    typeof p.isKing === "boolean"
  );
}

function isBoard(value: unknown): value is Board {
  if (!Array.isArray(value) || value.length !== 8) return false;
  return value.every(row => Array.isArray(row) && row.length === 8 && row.every(cell => cell === null || isPiece(cell)));
}

/** Validates the shape of data parsed from localStorage before it is trusted as live game state. */
function isSavedGame(value: unknown): value is SavedGame {
  if (typeof value !== "object" || value === null) return false;
  const d = value as Record<string, unknown>;
  return (
    isBoard(d.board) &&
    isPlayer(d.currentPlayer) &&
    Array.isArray(d.history) &&
    d.history.every(entry => typeof entry === "string") &&
    typeof d.redName === "string" &&
    typeof d.blackName === "string" &&
    typeof d.vsAI === "boolean" &&
    isDifficulty(d.difficulty) &&
    isPlayer(d.aiColor)
  );
}

function isScore(value: unknown): value is Omit<Score, "draws"> & { draws?: number } {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return typeof s.red === "number" && typeof s.black === "number" && (s.draws === undefined || typeof s.draws === "number");
}

function loadScore(): Score {
  try {
    const raw = localStorage.getItem(SCORE_KEY);
    if (!raw) return { red: 0, black: 0, draws: 0 };
    const data: unknown = JSON.parse(raw);
    if (!isScore(data)) return { red: 0, black: 0, draws: 0 };
    return { red: data.red, black: data.black, draws: data.draws ?? 0 };
  } catch {
    return { red: 0, black: 0, draws: 0 };
  }
}

export class Game {
  board: Board = createInitialBoard();
  currentPlayer: Player = "red";
  selectedPiece: Piece | null = null;
  possibleMoves: Move[] = [];
  lastMove: { row: number; col: number } | null = null;
  history: string[] = [];
  redName = "Vermelho";
  blackName = "Preto";
  vsAI = false;
  aiColor: Player = "black";
  difficulty: Difficulty = "medium";
  score: Score = loadScore();
  gameOver = false;
  winner: Player | null = null;
  isDraw = false;

  private pendingMoveEvent: { captured: number; promotes: boolean } | null = null;
  private legalMovesCache: Move[] | null = null;
  /** Half-moves since the last capture or promotion; a draw-by-no-progress trigger. */
  private movesSinceProgress = 0;
  /** Occurrence count per (board, player-to-move) key, for threefold-repetition draws. */
  private positionCounts = new Map<string, number>();

  private positionKey(playerToMove: Player): string {
    let key = "";
    for (const row of this.board) {
      for (const cell of row) {
        key += cell ? `${cell.color[0]}${cell.isKing ? "K" : "m"}` : ".";
      }
    }
    return `${key}|${playerToMove}`;
  }

  /** Drains the sound/haptics-worthy event produced by the last executed move, if any. */
  consumeMoveEvent(): { captured: number; promotes: boolean } | null {
    const event = this.pendingMoveEvent;
    this.pendingMoveEvent = null;
    return event;
  }

  private legalMoves(): Move[] {
    if (!this.legalMovesCache) {
      this.legalMovesCache = getAllValidMoves(this.board, this.currentPlayer);
    }
    return this.legalMovesCache;
  }

  private invalidateCache(): void {
    this.legalMovesCache = null;
  }

  playerName(player: Player): string {
    return player === "red" ? this.redName : this.blackName;
  }

  isAiTurn(): boolean {
    return this.vsAI && !this.gameOver && this.currentPlayer === this.aiColor;
  }

  /** Standard click-to-move handler: select a piece, then click a highlighted square. */
  selectSquare(row: number, col: number): { blockedByMandatoryCapture: boolean } {
    if (this.gameOver || this.isAiTurn()) return { blockedByMandatoryCapture: false };

    const clickedPiece = this.board[row][col];

    if (this.selectedPiece && this.selectedPiece.row === row && this.selectedPiece.col === col) {
      this.selectedPiece = null;
      this.possibleMoves = [];
      return { blockedByMandatoryCapture: false };
    }

    if (clickedPiece && clickedPiece.color === this.currentPlayer) {
      const movesForPiece = getValidMovesForSquare(this.board, this.currentPlayer, row, col);
      if (movesForPiece.length === 0) {
        const anyCaptureElsewhere = this.legalMoves().some(m => m.captured.length > 0);
        this.selectedPiece = null;
        this.possibleMoves = [];
        return { blockedByMandatoryCapture: anyCaptureElsewhere };
      }
      this.selectedPiece = clickedPiece;
      this.possibleMoves = movesForPiece;
      return { blockedByMandatoryCapture: false };
    }

    if (this.selectedPiece) {
      const move = this.possibleMoves.find(m => m.to.row === row && m.to.col === col);
      if (move) {
        this.executeMove(move);
      }
    }

    return { blockedByMandatoryCapture: false };
  }

  executeMove(move: Move): void {
    const mover = this.currentPlayer;
    this.board = applyMove(this.board, move);
    this.lastMove = { row: move.to.row, col: move.to.col };
    this.selectedPiece = null;
    this.possibleMoves = [];
    this.pendingMoveEvent = { captured: move.captured.length, promotes: move.promotes };

    const from = posToNotation(move.from.row, move.from.col);
    const to = posToNotation(move.to.row, move.to.col);
    const suffix = move.captured.length > 0 ? ` (captura ${move.captured.length})` : "";
    const kingSuffix = move.promotes ? " — promovida a dama" : "";
    this.history.push(`${this.playerName(mover)}: ${from} → ${to}${suffix}${kingSuffix}`);

    this.invalidateCache();

    const next = opponent(mover);
    const opponentPieces = countPieces(this.board, next);
    const opponentHasPieces = opponentPieces.men + opponentPieces.kings > 0;

    if (!opponentHasPieces || !hasAnyMoves(this.board, next)) {
      this.gameOver = true;
      this.winner = mover;
      this.score[mover] += 1;
      this.persistScore();
      this.history.push(`Fim de jogo — vencedor: ${this.playerName(mover)}`);
      return;
    }

    const isProgress = move.captured.length > 0 || move.promotes;
    if (isProgress) {
      this.movesSinceProgress = 0;
      this.positionCounts.clear();
    } else {
      this.movesSinceProgress++;
    }

    const key = this.positionKey(next);
    const occurrences = (this.positionCounts.get(key) ?? 0) + 1;
    this.positionCounts.set(key, occurrences);

    if (occurrences >= REPETITION_LIMIT || this.movesSinceProgress >= DRAW_MOVE_LIMIT) {
      this.gameOver = true;
      this.isDraw = true;
      this.winner = null;
      this.score.draws += 1;
      this.persistScore();
      const reason = occurrences >= REPETITION_LIMIT ? "repetição de posição" : "40 lances sem captura ou promoção";
      this.history.push(`Fim de jogo — empate (${reason})`);
      return;
    }

    this.currentPlayer = next;
  }

  /** Applies a move the caller already computed for the AI (see main.ts's worker-backed search). */
  makeAiMove(move: Move | null): boolean {
    if (!this.isAiTurn()) return false;
    if (!move) return false;
    this.executeMove(move);
    return true;
  }

  restart(): void {
    this.board = createInitialBoard();
    this.currentPlayer = "red";
    this.selectedPiece = null;
    this.possibleMoves = [];
    this.lastMove = null;
    this.history = [];
    this.gameOver = false;
    this.winner = null;
    this.isDraw = false;
    this.movesSinceProgress = 0;
    this.positionCounts = new Map();
    this.invalidateCache();
  }

  toggleAI(): void {
    this.vsAI = !this.vsAI;
    this.invalidateCache();
  }

  setDifficulty(difficulty: Difficulty): void {
    this.difficulty = difficulty;
  }

  startVsAI(difficulty: Difficulty): void {
    this.vsAI = true;
    this.aiColor = "black";
    this.difficulty = difficulty;
    this.restart();
  }

  startTwoPlayers(): void {
    this.vsAI = false;
    this.restart();
  }

  rename(redName: string, blackName: string): void {
    this.redName = redName.trim() || "Vermelho";
    this.blackName = blackName.trim() || "Preto";
  }

  private persistScore(): void {
    localStorage.setItem(SCORE_KEY, JSON.stringify(this.score));
  }

  save(): void {
    const payload: SavedGame = {
      board: this.board,
      currentPlayer: this.currentPlayer,
      history: this.history,
      redName: this.redName,
      blackName: this.blackName,
      vsAI: this.vsAI,
      difficulty: this.difficulty,
      aiColor: this.aiColor,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  }

  load(): boolean {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;

    try {
      const data: unknown = JSON.parse(raw);
      if (!isSavedGame(data)) return false;

      this.board = data.board;
      this.currentPlayer = data.currentPlayer;
      this.history = data.history;
      this.redName = data.redName;
      this.blackName = data.blackName;
      this.vsAI = data.vsAI;
      this.difficulty = data.difficulty;
      this.aiColor = data.aiColor;
      this.selectedPiece = null;
      this.possibleMoves = [];
      this.lastMove = null;
      this.gameOver = false;
      this.winner = null;
      this.isDraw = false;
      // The no-progress/repetition counters aren't part of the saved payload,
      // so they restart from this loaded position rather than the original game's history.
      this.movesSinceProgress = 0;
      this.positionCounts = new Map();
      this.invalidateCache();
      return true;
    } catch {
      return false;
    }
  }
}
