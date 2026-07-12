import type { Board, Move, Piece, Player } from "./types";

interface RenderOptions {
  board: Board;
  selectedPiece: Piece | null;
  possibleMoves: Move[];
  onSquareClick: (row: number, col: number) => void;
  lastMove?: { row: number; col: number } | null;
  currentPlayer: Player;
  interactive: boolean;
}

interface DragState {
  pointerId: number;
  el: HTMLDivElement;
  originRow: number;
  originCol: number;
  startClientX: number;
  startClientY: number;
  dragging: boolean;
  boardRect: DOMRect;
}

let boardEl: HTMLElement | null = null;
let squareEls: HTMLDivElement[] = [];
let squaresBuilt = false;
const pieceEls = new Map<number, HTMLDivElement>();
let suppressTransitionOnce = false;
let dragState: DragState | null = null;
let lastAnimatedMoveKey: string | null = null;

// Roving tabindex: exactly one square is a tab stop at a time; arrow keys
// move it, Enter/Space activates it. Keeps the whole board keyboard-operable
// without adding 64 stops to the page's tab order.
let focusedRow = 0;
let focusedCol = 1;

function squareNotation(row: number, col: number): string {
  const colLetter = "abcdefgh"[col];
  const rowNumber = 8 - row;
  return `${colLetter}${rowNumber}`;
}

function pieceDescription(piece: Piece): string {
  const color = piece.color === "red" ? "vermelha" : "preta";
  return piece.isKing ? `dama ${color}` : `peça ${color}`;
}

let latestOptions: RenderOptions = {
  board: [],
  selectedPiece: null,
  possibleMoves: [],
  onSquareClick: () => {},
  lastMove: null,
  currentPlayer: "red",
  interactive: false,
};

/** Forces the next renderBoard() call to rebuild instantly, with no slide/fade animation. */
export function resetBoardView(): void {
  squaresBuilt = false;
  pieceEls.clear();
  dragState = null;
  lastAnimatedMoveKey = null;
  if (boardEl) boardEl.innerHTML = "";
  suppressTransitionOnce = true;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function ensureBoardElement(): HTMLElement | null {
  const el = document.getElementById("board");
  if (!el) return null;
  if (el !== boardEl) {
    boardEl = el;
    squaresBuilt = false;
    pieceEls.clear();
    boardEl.innerHTML = "";
  }
  return boardEl;
}

function moveFocus(row: number, col: number): void {
  if (row < 0 || row > 7 || col < 0 || col > 7) return;
  squareEls[focusedRow * 8 + focusedCol].tabIndex = -1;
  focusedRow = row;
  focusedCol = col;
  const next = squareEls[focusedRow * 8 + focusedCol];
  next.tabIndex = 0;
  next.focus();
}

function onSquareKeyDown(event: KeyboardEvent, row: number, col: number): void {
  switch (event.key) {
    case "ArrowUp":
      event.preventDefault();
      moveFocus(row - 1, col);
      break;
    case "ArrowDown":
      event.preventDefault();
      moveFocus(row + 1, col);
      break;
    case "ArrowLeft":
      event.preventDefault();
      moveFocus(row, col - 1);
      break;
    case "ArrowRight":
      event.preventDefault();
      moveFocus(row, col + 1);
      break;
    case "Enter":
    case " ":
      event.preventDefault();
      latestOptions.onSquareClick(row, col);
      break;
  }
}

function buildSquares(container: HTMLElement): void {
  container.innerHTML = "";
  squareEls = [];
  container.setAttribute("role", "grid");
  container.setAttribute("aria-label", "Tabuleiro de dama, 8 por 8");
  container.setAttribute("aria-rowcount", "8");
  container.setAttribute("aria-colcount", "8");

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = document.createElement("div");
      square.classList.add("square", (row + col) % 2 === 0 ? "light" : "dark");
      square.dataset.row = String(row);
      square.dataset.col = String(col);
      square.setAttribute("role", "gridcell");
      square.setAttribute("aria-rowindex", String(row + 1));
      square.setAttribute("aria-colindex", String(col + 1));
      square.tabIndex = row === focusedRow && col === focusedCol ? 0 : -1;
      square.addEventListener("click", () => latestOptions.onSquareClick(row, col));
      square.addEventListener("keydown", event => onSquareKeyDown(event, row, col));
      container.appendChild(square);
      squareEls.push(square);
    }
  }

  squaresBuilt = true;
}

function updateSquareHighlights(): void {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = squareEls[row * 8 + col];
      square.classList.remove("highlight", "highlight-capture");
      const move = latestOptions.possibleMoves.find(m => m.to.row === row && m.to.col === col);
      if (move) {
        square.classList.add("highlight");
        if (move.captured.length > 0) square.classList.add("highlight-capture");
      }

      const piece = latestOptions.board[row]?.[col];
      const parts = [squareNotation(row, col)];
      if (piece) {
        parts.push(pieceDescription(piece));
        if (latestOptions.selectedPiece?.id === piece.id) parts.push("selecionada");
      } else {
        parts.push("vazia");
      }
      if (move) parts.push(move.captured.length > 0 ? "captura disponível" : "lance disponível");
      square.setAttribute("aria-label", parts.join(", "));
    }
  }
}

function setDropHover(row: number | null, col: number | null): void {
  for (const square of squareEls) {
    square.classList.remove("drop-target-active");
  }
  if (row === null || col === null || row < 0 || row > 7 || col < 0 || col > 7) return;
  squareEls[row * 8 + col].classList.add("drop-target-active");
}

function positionPiece(el: HTMLDivElement, row: number, col: number): void {
  el.style.left = `${col * 12.5}%`;
  el.style.top = `${row * 12.5}%`;
  el.dataset.row = String(row);
  el.dataset.col = String(col);
}

function createPieceElement(piece: Piece): HTMLDivElement {
  const slot = document.createElement("div");
  slot.classList.add("piece-slot", piece.color);
  slot.dataset.color = piece.color;
  // The underlying square's aria-label already describes the occupant; hide
  // this purely-visual layer so screen readers don't announce it twice.
  slot.setAttribute("aria-hidden", "true");

  const disc = document.createElement("div");
  disc.classList.add("piece-disc");
  slot.appendChild(disc);

  slot.addEventListener("pointerdown", onPointerDown);
  slot.addEventListener("pointermove", onPointerMove);
  slot.addEventListener("pointerup", onPointerUp);
  slot.addEventListener("pointercancel", onPointerCancel);

  return slot;
}

function updatePieceVisual(slot: HTMLDivElement, piece: Piece): void {
  const disc = slot.firstElementChild as HTMLDivElement;
  disc.textContent = piece.isKing ? "♛" : "";
  slot.classList.toggle("king", piece.isKing);

  const isSelected = latestOptions.selectedPiece?.id === piece.id;
  slot.classList.toggle("selected", isSelected);

  const isLastMoved = !!latestOptions.lastMove && latestOptions.lastMove.row === piece.row && latestOptions.lastMove.col === piece.col;
  slot.classList.toggle("move-pop", isLastMoved);

  const moveKey = latestOptions.lastMove ? `${latestOptions.lastMove.row},${latestOptions.lastMove.col}` : null;
  if (isLastMoved && moveKey !== lastAnimatedMoveKey) {
    disc.classList.remove("pop");
    void disc.offsetWidth;
    disc.classList.add("pop");
    lastAnimatedMoveKey = moveKey;
  }

  const draggable = latestOptions.interactive && piece.color === latestOptions.currentPlayer;
  slot.classList.toggle("draggable", draggable);
}

export function renderBoard(options: RenderOptions): void {
  latestOptions = options;

  const container = ensureBoardElement();
  if (!container) return;
  if (!squaresBuilt) buildSquares(container);

  updateSquareHighlights();

  const seenIds = new Set<number>();

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = options.board[row][col];
      if (!piece) continue;
      seenIds.add(piece.id);

      let slot = pieceEls.get(piece.id);
      const isNew = !slot;

      if (!slot) {
        slot = createPieceElement(piece);
        pieceEls.set(piece.id, slot);
        container.appendChild(slot);
      }

      if (isNew && suppressTransitionOnce) {
        slot.style.transition = "none";
        positionPiece(slot, piece.row, piece.col);
        void slot.offsetWidth;
        slot.style.transition = "";
      } else {
        positionPiece(slot, piece.row, piece.col);
      }

      updatePieceVisual(slot, piece);
    }
  }

  for (const [id, slot] of pieceEls) {
    if (seenIds.has(id)) continue;
    pieceEls.delete(id);

    if (suppressTransitionOnce) {
      slot.remove();
      continue;
    }

    slot.classList.add("capturing");
    slot.addEventListener("transitionend", () => slot.remove(), { once: true });
    window.setTimeout(() => slot.remove(), 400);
  }

  suppressTransitionOnce = false;
}

function onPointerDown(event: PointerEvent): void {
  const slot = event.currentTarget as HTMLDivElement;
  const color = slot.dataset.color as Player;
  if (!latestOptions.interactive || color !== latestOptions.currentPlayer) return;
  if (!boardEl) return;

  const row = Number(slot.dataset.row);
  const col = Number(slot.dataset.col);

  event.preventDefault();
  slot.setPointerCapture(event.pointerId);

  dragState = {
    pointerId: event.pointerId,
    el: slot,
    originRow: row,
    originCol: col,
    startClientX: event.clientX,
    startClientY: event.clientY,
    dragging: false,
    boardRect: boardEl.getBoundingClientRect(),
  };

  latestOptions.onSquareClick(row, col);
}

function onPointerMove(event: PointerEvent): void {
  if (!dragState || event.pointerId !== dragState.pointerId) return;

  const dx = event.clientX - dragState.startClientX;
  const dy = event.clientY - dragState.startClientY;

  if (!dragState.dragging && Math.hypot(dx, dy) > 6) {
    dragState.dragging = true;
    dragState.el.classList.add("dragging");
  }

  if (!dragState.dragging) return;

  const rect = dragState.boardRect;
  const xPct = clamp(((event.clientX - rect.left) / rect.width) * 100 - 6.25, -3, 90.5);
  const yPct = clamp(((event.clientY - rect.top) / rect.height) * 100 - 6.25, -3, 90.5);
  dragState.el.style.left = `${xPct}%`;
  dragState.el.style.top = `${yPct}%`;

  const hoverCol = clamp(Math.floor(((event.clientX - rect.left) / rect.width) * 8), 0, 7);
  const hoverRow = clamp(Math.floor(((event.clientY - rect.top) / rect.height) * 8), 0, 7);
  const isLegalTarget = latestOptions.possibleMoves.some(m => m.to.row === hoverRow && m.to.col === hoverCol);
  setDropHover(isLegalTarget ? hoverRow : null, isLegalTarget ? hoverCol : null);
}

function onPointerUp(event: PointerEvent): void {
  if (!dragState || event.pointerId !== dragState.pointerId) return;

  const { el, dragging, originRow, originCol, boardRect } = dragState;
  el.classList.remove("dragging");
  el.releasePointerCapture(event.pointerId);
  setDropHover(null, null);
  dragState = null;

  if (!dragging) return;

  const targetCol = clamp(Math.floor(((event.clientX - boardRect.left) / boardRect.width) * 8), 0, 7);
  const targetRow = clamp(Math.floor(((event.clientY - boardRect.top) / boardRect.height) * 8), 0, 7);

  if (targetRow !== originRow || targetCol !== originCol) {
    latestOptions.onSquareClick(targetRow, targetCol);
  } else {
    positionPiece(el, originRow, originCol);
  }
}

function onPointerCancel(event: PointerEvent): void {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const { el, originRow, originCol } = dragState;
  el.classList.remove("dragging");
  setDropHover(null, null);
  dragState = null;
  positionPiece(el, originRow, originCol);
}
