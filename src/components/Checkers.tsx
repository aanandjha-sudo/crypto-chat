
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserData } from '@/app/chat/page';
import { RefreshCw, Crown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';

type Player = 'R' | 'B';
type Piece = { player: Player, isKing: boolean };
type Board = (Piece | null)[][];

interface GameState {
    board: Board;
    currentPlayer: Player;
    winner: Player | 'draw' | null;
    players: { R: string; B: string };
    scores: { R: number; B: number };
    blackPieces: number;
    redPieces: number;
}

interface CheckersProps {
    conversationId: string;
    currentUser: UserData;
}

const BOARD_SIZE = 8;

const createInitialBoard = (): Board => {
    const board: Board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if ((row + col) % 2 === 1) { // Dark squares
                if (row < 3) {
                    board[row][col] = { player: 'B', isKing: false };
                } else if (row > 4) {
                    board[row][col] = { player: 'R', isKing: false };
                }
            }
        }
    }
    return board;
};

export function Checkers({ conversationId, currentUser }: CheckersProps) {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [selectedPiece, setSelectedPiece] = useState<{ row: number, col: number } | null>(null);
    const [possibleMoves, setPossibleMoves] = useState<{ row: number, col: number, captured: {row: number, col: number} | null }[]>([]);
    
    const gameDocRef = doc(db, 'games-checkers', conversationId);
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribe = onSnapshot(gameDocRef, async (docSnap) => {
            if (docSnap.exists()) {
                setGameState(docSnap.data() as GameState);
            } else {
                const conversationDoc = await getDoc(doc(db, 'conversations', conversationId));
                if(conversationDoc.exists()) {
                    const members = conversationDoc.data().members as string[];
                    if (members.length === 2) {
                        const sortedMembers = [...members].sort();
                        const newGameState: GameState = {
                            board: createInitialBoard(),
                            currentPlayer: 'R',
                            winner: null,
                            players: { R: sortedMembers[0], B: sortedMembers[1] },
                            scores: { R: 0, B: 0 },
                            redPieces: 12,
                            blackPieces: 12,
                        };
                        await setDoc(gameDocRef, newGameState);
                        setGameState(newGameState);
                    }
                }
            }
        });
        return () => unsubscribe();
    }, [gameDocRef, conversationId]);

    const getPlayerSymbol = (): Player | null => {
        if (!gameState || !currentUser) return null;
        if (gameState.players.R === currentUser.id) return 'R';
        if (gameState.players.B === currentUser.id) return 'B';
        return null;
    }
    
    const calculateMoves = (board: Board, player: Player, row: number, col: number): { row: number, col: number, captured: {row: number, col: number} | null }[] => {
        const moves = [];
        const piece = board[row][col];
        if (!piece) return [];
        
        const opponent = player === 'R' ? 'B' : 'R';
        const directions = [];
        if (piece.player === 'R' || piece.isKing) {
            directions.push({ r: -1, c: -1 }, { r: -1, c: 1 }); // Up-left, Up-right
        }
        if (piece.player === 'B' || piece.isKing) {
            directions.push({ r: 1, c: -1 }, { r: 1, c: 1 }); // Down-left, Down-right
        }
        
        // Jumps
        for (const dir of directions) {
            const jumpRow = row + dir.r * 2;
            const jumpCol = col + dir.c * 2;
            const captureRow = row + dir.r;
            const captureCol = col + dir.c;

            if (jumpRow >= 0 && jumpRow < BOARD_SIZE && jumpCol >= 0 && jumpCol < BOARD_SIZE &&
                board[jumpRow][jumpCol] === null &&
                board[captureRow][captureCol] && board[captureRow][captureCol]?.player === opponent) {
                moves.push({ row: jumpRow, col: jumpCol, captured: { row: captureRow, col: captureCol }});
            }
        }
        
        // If jumps are available, they are mandatory
        if (moves.length > 0) return moves;

        // Regular moves
        for (const dir of directions) {
             const moveRow = row + dir.r;
             const moveCol = col + dir.c;
             if(moveRow >= 0 && moveRow < BOARD_SIZE && moveCol >= 0 && moveCol < BOARD_SIZE && board[moveRow][moveCol] === null) {
                 moves.push({row: moveRow, col: moveCol, captured: null });
             }
        }

        return moves;
    }
    
    const handlePieceClick = (row: number, col: number) => {
        if (!gameState || gameState.winner) return;

        const mySymbol = getPlayerSymbol();
        if (mySymbol !== gameState.currentPlayer) return;

        const piece = gameState.board[row][col];
        if (piece && piece.player === mySymbol) {
             const mandatoryJumps = [];
             for(let r=0; r<BOARD_SIZE; r++) {
                 for(let c=0; c<BOARD_SIZE; c++) {
                     const p = gameState.board[r][c];
                     if(p && p.player === mySymbol) {
                        const moves = calculateMoves(gameState.board, mySymbol, r, c);
                        const jumps = moves.filter(m => m.captured);
                        if(jumps.length > 0) {
                            mandatoryJumps.push(...jumps);
                        }
                     }
                 }
             }

            setSelectedPiece({ row, col });
            let moves = calculateMoves(gameState.board, mySymbol, row, col);
            if(mandatoryJumps.length > 0) {
                moves = moves.filter(m => m.captured);
            }
            setPossibleMoves(moves);
        }
    };
    
    const handleMove = async (row: number, col: number) => {
        if (!gameState || !selectedPiece || !possibleMoves.some(m => m.row === row && m.col === col)) return;
        
        const newBoard = gameState.board.map(r => r.map(p => p ? {...p} : null));
        const move = possibleMoves.find(m => m.row === row && m.col === col)!;
        const piece = newBoard[selectedPiece.row][selectedPiece.col]!;
        
        newBoard[row][col] = piece;
        newBoard[selectedPiece.row][selectedPiece.col] = null;
        
        let redPieces = gameState.redPieces;
        let blackPieces = gameState.blackPieces;

        if(move.captured) {
            const capturedPiece = newBoard[move.captured.row][move.captured.col];
            if (capturedPiece?.player === 'R') redPieces--;
            else blackPieces--;
            newBoard[move.captured.row][move.captured.col] = null;
        }
        
        // Kinging
        if((piece.player === 'R' && row === 0) || (piece.player === 'B' && row === BOARD_SIZE - 1)) {
            piece.isKing = true;
        }

        let winner: GameState['winner'] = null;
        if (redPieces === 0) winner = 'B';
        if (blackPieces === 0) winner = 'R';
        
        let newScores = {...gameState.scores};
        if(winner && winner !== 'draw') {
            newScores[winner]++;
        }
        
        const newGameState: Partial<GameState> = {
            board: newBoard,
            currentPlayer: gameState.currentPlayer === 'R' ? 'B' : 'R',
            winner,
            scores: newScores,
            redPieces,
            blackPieces,
        };

        await updateDoc(gameDocRef, newGameState);
        setSelectedPiece(null);
        setPossibleMoves([]);
    };
    
    const handleResetGame = async () => {
         if (!gameState) return;
         const newGameState: Partial<GameState> = {
            board: createInitialBoard(),
            currentPlayer: 'R',
            winner: null,
            redPieces: 12,
            blackPieces: 12,
         };
         await updateDoc(gameDocRef, newGameState);
    };
    
    const getStatusMessage = () => {
        if (!gameState) return "Loading game...";
        const { winner, currentPlayer, players } = gameState;
        const mySymbol = getPlayerSymbol();
        
        if (winner) {
            if (winner === 'draw') return "It's a draw!";
            if (!mySymbol) return `Player ${winner} won!`;
            const winnerName = winner === mySymbol ? "You" : "Opponent";
            return `${winnerName} won!`;
        }

        const currentName = players[currentPlayer] === currentUser.id ? "Your" : "Opponent's"
        if (!mySymbol) return `Spectating... It's Player ${currentPlayer}'s turn.`;

        return `${currentName} turn`;
    };
    
    if (!gameState) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Checkers</CardTitle>
                    <CardDescription>Loading Game...</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center items-center p-6 space-y-4 flex-col">
                    <Skeleton className="h-8 w-40" />
                    <Skeleton className="w-[320px] h-[320px] md:w-[400px] md:h-[400px]" />
                    <Skeleton className="h-8 w-60" />
                </CardContent>
            </Card>
        );
    }
    
    const mySymbol = getPlayerSymbol();
    const amIPlayer = !!mySymbol;
    const isMyTurn = amIPlayer && gameState.currentPlayer === mySymbol;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Checkers</CardTitle>
                 {amIPlayer ? (
                    <CardDescription>You are <span className={cn("font-bold", mySymbol === 'R' ? 'text-red-500' : 'text-zinc-800 dark:text-zinc-300')}>{mySymbol === 'R' ? 'Red' : 'Black'}</span>. Capture all your opponent's pieces.</CardDescription>
                 ) : (
                    <CardDescription>You are spectating this game.</CardDescription>
                 )}
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
                <div className="text-lg font-semibold p-2 bg-muted rounded-md min-w-[200px] text-center">{getStatusMessage()}</div>
                <div className="grid grid-cols-8 border-2 border-stone-800">
                   {gameState.board.map((row, r) =>
                        row.map((piece, c) => (
                            <div
                                key={`${r}-${c}`}
                                className={cn(
                                    "w-10 h-10 md:w-12 md:h-12 flex items-center justify-center",
                                    (r + c) % 2 === 0 ? 'bg-stone-200 dark:bg-stone-500' : 'bg-stone-500 dark:bg-stone-800',
                                    isMyTurn && "cursor-pointer",
                                    selectedPiece?.row === r && selectedPiece?.col === c && "bg-yellow-400/50",
                                )}
                                onClick={() => {
                                    if(possibleMoves.some(m => m.row === r && m.col === c)) {
                                        handleMove(r, c)
                                    } else if(isMyTurn) {
                                        handlePieceClick(r,c)
                                    }
                                }}
                            >
                               {piece && (
                                   <div className={cn(
                                       "relative w-4/5 h-4/5 rounded-full flex items-center justify-center transition-all duration-200",
                                       piece.player === 'B' ? 'bg-zinc-800 dark:bg-zinc-900' : 'bg-red-600',
                                       selectedPiece?.row === r && selectedPiece?.col === c && 'ring-2 ring-yellow-400'
                                   )}>
                                       {piece.isKing && <Crown className="w-1/2 h-1/2 text-yellow-400" />}
                                   </div>
                               )}
                               {possibleMoves.some(m => m.row === r && m.col === c) && (
                                    <div className="w-1/3 h-1/3 rounded-full bg-green-500/70" />
                               )}
                            </div>
                        ))
                    )}
                </div>
                 <div className="flex items-center gap-4 text-lg">
                    <span>Pieces Left:</span>
                    <span className="font-bold text-red-500">Red: {gameState.redPieces}</span>
                    <span>-</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-300">Black: {gameState.blackPieces}</span>
                </div>
                {gameState.winner && amIPlayer && (
                     <Button onClick={handleResetGame}>
                        <RefreshCw className="mr-2 h-4 w-4"/>
                        Play Again
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

