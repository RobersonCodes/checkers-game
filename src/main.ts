import "../style.css";
import type { Difficulty, Move } from "./types";
import { countPieces } from "./rules";
import { renderBoard, resetBoardView } from "./render";
import { Game } from "./game";
import { isMuted, playCapture, playInvalid, playKing, playMove, playWin, setMuted, vibrate } from "./sound";
import type { AiRequest, AiResponse } from "./ai.worker";

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil",
};

const LEVEL_TO_DIFFICULTY: Record<string, Difficulty> = {
  "1": "easy",
  "2": "medium",
  "3": "hard",
};

const DIFFICULTY_CYCLE: Difficulty[] = ["easy", "medium", "hard"];

// Minimum wall-clock time an AI turn takes before its move is applied — keeps
// the "thinking" beat even when the worker resolves almost instantly (e.g.
// easy difficulty on a near-empty board), without ever blocking the UI thread.
const AI_THINK_DELAY_MS = 550;

/**
 * AI search runs in a dedicated worker so "difícil" (depth 6) can never
 * freeze rendering or input on the main thread. Requests are tagged with an
 * incrementing id; a response whose id doesn't match the currently pending
 * request is a stale reply from a game that was reset/toggled/loaded away
 * in the meantime, and is discarded instead of being applied.
 */
const aiWorker = new Worker(new URL("./ai.worker.ts", import.meta.url), { type: "module" });

interface PendingAiRequest {
  id: number;
  startedAt: number;
  paceTimer: ReturnType<typeof window.setTimeout> | null;
}

let nextAiRequestId = 0;
let pendingAiRequest: PendingAiRequest | null = null;

function cancelPendingAiRequest(): void {
  if (pendingAiRequest && pendingAiRequest.paceTimer !== null) {
    window.clearTimeout(pendingAiRequest.paceTimer);
  }
  pendingAiRequest = null;
}

function el<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elemento #${id} não encontrado`);
  return element as T;
}

const game = new Game();
let modalDismissedForThisGame = false;
let winSoundPlayedForThisGame = false;

// How long a transient status message (e.g. "Captura obrigatória...") stays
// on screen. Previously the message was cleared inside the very render()
// call that displayed it, so a second render() triggered in the same tick
// (or shortly after) could wipe it before the browser ever painted it.
const FLASH_MESSAGE_DURATION_MS = 2200;
let flashMessage: string | null = null;
let flashMessageTimer: ReturnType<typeof window.setTimeout> | null = null;

function showFlashMessage(text: string): void {
  flashMessage = text;
  if (flashMessageTimer !== null) window.clearTimeout(flashMessageTimer);
  flashMessageTimer = window.setTimeout(() => {
    flashMessage = null;
    flashMessageTimer = null;
    render();
  }, FLASH_MESSAGE_DURATION_MS);
}

function clearFlashMessage(): void {
  if (flashMessageTimer !== null) {
    window.clearTimeout(flashMessageTimer);
    flashMessageTimer = null;
  }
  flashMessage = null;
}

const startScreen = el<HTMLDivElement>("startScreen");
const redNameEl = el<HTMLParagraphElement>("redName");
const blackNameEl = el<HTMLParagraphElement>("blackName");
const statusEl = el<HTMLParagraphElement>("status");
const counterEl = el<HTMLParagraphElement>("counter");
const modeInfoEl = el<HTMLParagraphElement>("modeInfo");
const scoreEl = el<HTMLParagraphElement>("score");
const historyEl = el<HTMLUListElement>("history");
const winnerModal = el<HTMLDivElement>("winnerModal");
const winnerText = el<HTMLParagraphElement>("winnerText");
const muteBtn = el<HTMLButtonElement>("muteBtn");
const renameModal = el<HTMLDivElement>("renameModal");
const renameForm = el<HTMLFormElement>("renameForm");
const redNameInput = el<HTMLInputElement>("redNameInput");
const blackNameInput = el<HTMLInputElement>("blackNameInput");

function updateMuteButton(): void {
  muteBtn.textContent = isMuted() ? "🔇 Som" : "🔊 Som";
}

/** Plays the sound/haptics for whatever the game just did (move, capture, promotion, win). */
function reactToMoveEvents(): void {
  const event = game.consumeMoveEvent();
  if (event) {
    if (event.captured > 0) {
      playCapture();
      vibrate(35);
    } else {
      playMove();
    }
    if (event.promotes) {
      window.setTimeout(playKing, 160);
    }
  }

  if (game.gameOver && !winSoundPlayedForThisGame) {
    winSoundPlayedForThisGame = true;
    window.setTimeout(playWin, event?.promotes ? 500 : 200);
  }
}

function render(): void {
  redNameEl.textContent = game.redName;
  blackNameEl.textContent = game.blackName;

  if (game.gameOver && game.winner) {
    statusEl.textContent = `Fim de jogo — vencedor: ${game.playerName(game.winner)}`;
  } else if (game.gameOver && game.isDraw) {
    statusEl.textContent = "Fim de jogo — empate";
  } else if (flashMessage) {
    statusEl.textContent = flashMessage;
  } else {
    const thinking = game.isAiTurn() ? " (IA pensando...)" : "";
    statusEl.textContent = `Turno: ${game.playerName(game.currentPlayer)}${thinking}`;
  }

  const red = countPieces(game.board, "red");
  const black = countPieces(game.board, "black");
  counterEl.textContent = `Peças — Vermelho: ${red.men + red.kings} | Preto: ${black.men + black.kings}`;

  modeInfoEl.textContent = game.vsAI
    ? `Modo: vs IA (${DIFFICULTY_LABEL[game.difficulty]})`
    : "Modo: 2 jogadores";

  const drawsSuffix = game.score.draws > 0 ? ` (empates: ${game.score.draws})` : "";
  scoreEl.textContent = `Placar: ${game.score.red} x ${game.score.black}${drawsSuffix}`;

  historyEl.innerHTML = "";
  for (const entry of [...game.history].reverse()) {
    const li = document.createElement("li");
    li.textContent = entry;
    historyEl.appendChild(li);
  }

  renderBoard({
    board: game.board,
    selectedPiece: game.selectedPiece,
    possibleMoves: game.possibleMoves,
    onSquareClick: handleSquareClick,
    lastMove: game.lastMove,
    currentPlayer: game.currentPlayer,
    interactive: !game.isAiTurn() && !game.gameOver,
  });

  if (game.gameOver && !modalDismissedForThisGame) {
    winnerText.textContent = game.winner ? `Vencedor: ${game.playerName(game.winner)}` : "Empate";
    winnerModal.classList.remove("hidden");
  } else {
    winnerModal.classList.add("hidden");
  }
}

function applyAiMove(request: PendingAiRequest, move: Move | null): void {
  if (pendingAiRequest !== request) return; // superseded by a reset/toggle/load in the meantime
  pendingAiRequest = null;
  game.makeAiMove(move);
  reactToMoveEvents();
  render();
  requestAiMoveIfNeeded();
}

function requestAiMoveIfNeeded(): void {
  if (!game.isAiTurn()) return;
  render();

  const request: PendingAiRequest = { id: ++nextAiRequestId, startedAt: performance.now(), paceTimer: null };
  pendingAiRequest = request;

  const message: AiRequest = {
    requestId: request.id,
    board: game.board,
    aiColor: game.aiColor,
    difficulty: game.difficulty,
  };
  aiWorker.postMessage(message);
}

aiWorker.addEventListener("message", (event: MessageEvent) => {
  const { requestId, move } = event.data as AiResponse;
  if (!pendingAiRequest || pendingAiRequest.id !== requestId) return;

  const request = pendingAiRequest;
  const elapsed = performance.now() - request.startedAt;
  const remaining = Math.max(0, AI_THINK_DELAY_MS - elapsed);
  request.paceTimer = window.setTimeout(() => applyAiMove(request, move), remaining);
});

function handleSquareClick(row: number, col: number): void {
  if (game.isAiTurn()) return;
  const result = game.selectSquare(row, col);
  if (result.blockedByMandatoryCapture) {
    showFlashMessage("Captura obrigatória — jogue com a peça que pode capturar.");
    playInvalid();
  }
  reactToMoveEvents();
  render();
  requestAiMoveIfNeeded();
}

function hideStartScreen(): void {
  startScreen.classList.add("hidden");
}

function openRenameModal(): void {
  redNameInput.value = game.redName;
  blackNameInput.value = game.blackName;
  renameModal.classList.remove("hidden");
  redNameInput.focus();
}

function closeRenameModal(): void {
  renameModal.classList.add("hidden");
}

/** The DOM-refresh tail shared by every full board reset (new game, restart, load). */
function refreshBoardView(): void {
  resetBoardView();
  hideStartScreen();
  render();
  requestAiMoveIfNeeded();
}

function startNewGame(): void {
  cancelPendingAiRequest();
  modalDismissedForThisGame = false;
  winSoundPlayedForThisGame = false;
  clearFlashMessage();
  refreshBoardView();
}

document.querySelectorAll<HTMLButtonElement>(".difficulty-buttons button[data-level]").forEach(button => {
  button.addEventListener("click", () => {
    const level = button.dataset.level ?? "2";
    game.startVsAI(LEVEL_TO_DIFFICULTY[level] ?? "medium");
    startNewGame();
  });
});

el<HTMLButtonElement>("startTwoPlayersBtn").addEventListener("click", () => {
  game.startTwoPlayers();
  startNewGame();
});

el<HTMLButtonElement>("renameBtn").addEventListener("click", () => {
  openRenameModal();
});

el<HTMLButtonElement>("toggleAIBtn").addEventListener("click", () => {
  cancelPendingAiRequest();
  game.toggleAI();
  render();
  requestAiMoveIfNeeded();
});

el<HTMLButtonElement>("restartBtn").addEventListener("click", () => {
  game.restart();
  startNewGame();
});

el<HTMLButtonElement>("saveBtn").addEventListener("click", () => {
  game.save();
  showFlashMessage("Partida salva.");
  render();
});

el<HTMLButtonElement>("loadBtn").addEventListener("click", () => {
  cancelPendingAiRequest();
  const loaded = game.load();
  showFlashMessage(loaded ? "Partida carregada." : "Nenhuma partida salva encontrada.");
  modalDismissedForThisGame = !game.gameOver;
  winSoundPlayedForThisGame = game.gameOver;
  refreshBoardView();
});

el<HTMLButtonElement>("changeDifficultyBtn").addEventListener("click", () => {
  const currentIndex = DIFFICULTY_CYCLE.indexOf(game.difficulty);
  const next = DIFFICULTY_CYCLE[(currentIndex + 1) % DIFFICULTY_CYCLE.length];
  game.setDifficulty(next);
  showFlashMessage(`Dificuldade da IA: ${DIFFICULTY_LABEL[next]}`);
  render();
});

el<HTMLButtonElement>("closeModalBtn").addEventListener("click", () => {
  modalDismissedForThisGame = true;
  winnerModal.classList.add("hidden");
});

renameForm.addEventListener("submit", event => {
  event.preventDefault();
  game.rename(redNameInput.value, blackNameInput.value);
  closeRenameModal();
  render();
});

el<HTMLButtonElement>("cancelRenameBtn").addEventListener("click", () => {
  closeRenameModal();
});

muteBtn.addEventListener("click", () => {
  setMuted(!isMuted());
  updateMuteButton();
});

updateMuteButton();
render();
