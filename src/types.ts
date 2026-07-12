export type Player = "red" | "black";

export interface Piece {
  id: number;
  row: number;
  col: number;
  color: Player;
  isKing: boolean;
}

export type Board = (Piece | null)[][];

export interface Position {
  row: number;
  col: number;
}

/**
 * A single legal move a player can make on their turn.
 * `captured` lists every enemy square cleared along the way (length > 1
 * for a multi-jump chain). `promotes` is true when the moving piece
 * becomes a king by landing on `to`.
 */
export interface Move {
  from: Position;
  to: Position;
  captured: Position[];
  promotes: boolean;
}

export type Difficulty = "easy" | "medium" | "hard";
