import type { Board, Difficulty, Move, Piece, Player } from "./types";
import { applyMove, createInitialBoard } from "./board";
import { countPieces, getAllValidMoves, getValidMovesForSquare, hasAnyMoves, opponent } from "./rules";
import { getBestMove } from "./ai";

const SAVE_KEY = "checkers-save-v1";
const SCORE_KEY = "checkers-score-v1";

export interface Score {
  red: number;
  black: number;
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

function loadScore(): Score {
  try {
    const raw = localStorage.getItem(SCORE_KEY);
    if (!raw) return { red: 0, black: 0 };
    return JSON.parse(raw) as Score;
  } catch {
    return { red: 0, black: 0 };
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

  private pendingMoveEvent: { captured: number; promotes: boolean } | null = null;
  private legalMovesCache: Move[] | null = null;

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

    this.currentPlayer = next;
  }

  makeAiMove(): boolean {
    if (!this.isAiTurn()) return false;
    const move = getBestMove(this.board, this.aiColor, this.difficulty);
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
      const data = JSON.parse(raw) as SavedGame;
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
      this.invalidateCache();
      return true;
    } catch {
      return false;
    }
  }
}
