import type { Board, Difficulty, Move, Player } from "./types";
import { getBestMove } from "./ai";

export interface AiRequest {
  requestId: number;
  board: Board;
  aiColor: Player;
  difficulty: Difficulty;
}

export interface AiResponse {
  requestId: number;
  move: Move | null;
}

addEventListener("message", (event: MessageEvent) => {
  const { requestId, board, aiColor, difficulty } = event.data as AiRequest;
  const move = getBestMove(board, aiColor, difficulty);
  const response: AiResponse = { requestId, move };
  postMessage(response);
});
