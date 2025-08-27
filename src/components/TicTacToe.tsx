
"use client";

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserData } from '@/app/chat/page';
import { RefreshCw, X, Circle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from './ui/skeleton';

type PlayerSymbol = 'X' | 'O';
type Board = (PlayerSymbol | null)[];

interface GameState {
    board: Board;
    nextPlayer: PlayerSymbol;
    winner: PlayerSymbol | 'draw' | null;
    players: {
        X: string;
        O: string;
    };
    scores: {
        X: number;
        O: number;
    };
}

interface TicTacToeProps {
    conversationId: string;
    currentUser: UserData;
}

export function TicTacToe({ conversationId, currentUser }: TicTacToeProps) {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const gameDocRef = doc(db, 'games', conversationId);
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
                            board: Array(9).fill(null),
                            nextPlayer: 'X',
                            winner: null,
                            players: {
                                X: sortedMembers[0],
                                O: sortedMembers[1]
                            },
                            scores: { X: 0, O: 0 }
                        };
                        await setDoc(gameDocRef, newGameState);
                        setGameState(newGameState);
                    }
                }
            }
        });
        return () => unsubscribe();
    }, [gameDocRef, conversationId]);
    
    const calculateWinner = (board: Board): PlayerSymbol | null => {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
        for (let i = 0; i < lines.length; i++) {
            const [a, b, c] = lines[i];
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return board[a];
            }
        }
        return null;
    };

    const handleCellClick = async (index: number) => {
        if (!gameState || gameState.board[index] || gameState.winner) {
            return;
        }

        const mySymbol = (Object.keys(gameState.players) as PlayerSymbol[]).find(key => gameState.players[key] === currentUser.id);

        if (!mySymbol) {
            toast({ variant: 'destructive', title: "Spectator Mode", description: "You can't make a move in this game."});
            return;
        }

        if (gameState.nextPlayer !== mySymbol) {
            toast({ variant: 'destructive', title: "Not your turn!", description: "Wait for the other player to move."});
            return;
        }

        const newBoard = [...gameState.board];
        newBoard[index] = gameState.nextPlayer;

        const winner = calculateWinner(newBoard);
        const isDraw = !winner && newBoard.every(cell => cell !== null);
        
        let newScores = { ...gameState.scores };
        if (winner) {
            newScores[winner]++;
        }

        const newGameState: Partial<GameState> = {
            board: newBoard,
            nextPlayer: gameState.nextPlayer === 'X' ? 'O' : 'X',
            winner: winner || (isDraw ? 'draw' : null),
            scores: newScores
        };

        await updateDoc(gameDocRef, newGameState);
    };

    const handleResetGame = async () => {
         if (!gameState) return;
        
         const newGameState: Partial<GameState> = {
            board: Array(9).fill(null),
            nextPlayer: 'X',
            winner: null,
         };
         await updateDoc(gameDocRef, newGameState);
    };
    
    const getStatusMessage = () => {
        if (!gameState) return "Loading game...";
        
        const { winner, nextPlayer, players } = gameState;
        const mySymbol = (Object.keys(players) as PlayerSymbol[]).find(key => players[key] === currentUser.id);
        
        if (winner) {
            if (winner === 'draw') return "It's a draw!";
            if (!mySymbol) return `Player ${winner} won!`;
            const winnerName = winner === mySymbol ? "You" : "Opponent";
            return `${winnerName} won!`;
        }

        if (!mySymbol) return `Spectating... It's Player ${nextPlayer}'s turn.`;

        return players[nextPlayer] === currentUser.id ? "Your turn" : "Opponent's turn";
    };

    if (!gameState) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>Tic-Tac-Toe</CardTitle>
                    <CardDescription>Loading Game...</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center items-center p-6 flex-col space-y-4">
                     <Skeleton className="h-8 w-40" />
                     <div className="grid grid-cols-3 gap-2">
                        {Array.from({length: 9}).map((_, i) => (
                           <Skeleton key={i} className="w-20 h-20 md:w-24 md:h-24" />
                        ))}
                     </div>
                     <Skeleton className="h-8 w-60" />
                </CardContent>
            </Card>
        )
    }
    
    const mySymbol = (Object.keys(gameState.players) as PlayerSymbol[]).find(key => gameState.players[key] === currentUser.id);
    const opponentSymbol = mySymbol === 'X' ? 'O' : 'X';
    const amIPlayer = !!mySymbol;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tic-Tac-Toe</CardTitle>
                 {amIPlayer ? (
                    <CardDescription>You are playing as '{mySymbol}'. First to get 3 in a row wins.</CardDescription>
                 ) : (
                    <CardDescription>You are spectating this game.</CardDescription>
                 )}
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
                 <div className="text-lg font-semibold p-2 bg-muted rounded-md min-w-[200px] text-center">{getStatusMessage()}</div>
                 <div className="grid grid-cols-3 gap-2">
                    {gameState.board.map((cell, index) => (
                        <Button
                            key={index}
                            onClick={() => handleCellClick(index)}
                            variant="outline"
                            className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center text-4xl font-bold"
                            disabled={!!cell || !!gameState.winner || !amIPlayer}
                        >
                            {cell === 'X' && <X className="w-12 h-12" />}
                            {cell === 'O' && <Circle className="w-12 h-12" />}
                        </Button>
                    ))}
                </div>
                 <div className="flex items-center gap-4 text-lg">
                    <span>Scores:</span>
                    <span>You ({amIPlayer ? gameState.scores[mySymbol] : 0})</span>
                    <span>-</span>
                    <span>Opponent ({amIPlayer ? gameState.scores[opponentSymbol] : 0})</span>
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
