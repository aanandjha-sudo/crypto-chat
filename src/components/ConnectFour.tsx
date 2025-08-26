
"use client";

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserData } from '@/app/chat/page';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type PlayerSymbol = 'R' | 'Y'; // Red or Yellow
type Board = (PlayerSymbol | null)[][]; // 6 rows, 7 columns

interface GameState {
    board: Board;
    nextPlayer: PlayerSymbol;
    winner: PlayerSymbol | 'draw' | null;
    players: {
        R: string | null; // Red player
        Y: string | null; // Yellow player
    };
    scores: {
        R: number;
        Y: number;
    };
}

interface ConnectFourProps {
    conversationId: string;
    currentUser: UserData;
}

const ROWS = 6;
const COLS = 7;

export function ConnectFour({ conversationId, currentUser }: ConnectFourProps) {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const gameDocRef = doc(db, 'games-connectfour', conversationId);
    const { toast } = useToast();

    const createEmptyBoard = (): Board => Array.from({ length: ROWS }, () => Array(COLS).fill(null));

    useEffect(() => {
        const unsubscribe = onSnapshot(gameDocRef, async (docSnap) => {
            if (docSnap.exists()) {
                setGameState(docSnap.data() as GameState);
            } else {
                const conversationDoc = await getDoc(doc(db, 'conversations', conversationId));
                if(conversationDoc.exists()) {
                    const members = conversationDoc.data().members as string[];
                    if (members.length === 2) {
                        const newGameState: GameState = {
                            board: createEmptyBoard(),
                            nextPlayer: 'R',
                            winner: null,
                            players: { R: members[0], Y: members[1] },
                            scores: { R: 0, Y: 0 }
                        };
                        await setDoc(gameDocRef, newGameState);
                        setGameState(newGameState);
                    }
                }
            }
        });
        return () => unsubscribe();
    }, [gameDocRef, conversationId]);

    const checkWin = (board: Board): PlayerSymbol | null => {
        // Check horizontal
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c <= COLS - 4; c++) {
                if (board[r][c] && board[r][c] === board[r][c+1] && board[r][c] === board[r][c+2] && board[r][c] === board[r][c+3]) {
                    return board[r][c];
                }
            }
        }
        // Check vertical
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r <= ROWS - 4; r++) {
                if (board[r][c] && board[r][c] === board[r+1][c] && board[r][c] === board[r+2][c] && board[r][c] === board[r+3][c]) {
                    return board[r][c];
                }
            }
        }
        // Check diagonal (down-right)
        for (let r = 0; r <= ROWS - 4; r++) {
            for (let c = 0; c <= COLS - 4; c++) {
                if (board[r][c] && board[r][c] === board[r+1][c+1] && board[r][c] === board[r+2][c+2] && board[r][c] === board[r+3][c+3]) {
                    return board[r][c];
                }
            }
        }
        // Check diagonal (up-right)
        for (let r = 3; r < ROWS; r++) {
            for (let c = 0; c <= COLS - 4; c++) {
                if (board[r][c] && board[r][c] === board[r-1][c+1] && board[r][c] === board[r-2][c+2] && board[r][c] === board[r-3][c+3]) {
                    return board[r][c];
                }
            }
        }
        return null;
    };

    const handleColumnClick = async (colIndex: number) => {
        if (!gameState || gameState.winner) return;

        const mySymbol = Object.keys(gameState.players).find(key => gameState.players[key as PlayerSymbol] === currentUser.id) as PlayerSymbol | undefined;

        if (gameState.nextPlayer !== mySymbol) {
            toast({ variant: 'destructive', title: "Not your turn!", description: "Wait for the other player to move."});
            return;
        }

        // Find the first empty row in the column
        let rowIndex = -1;
        for (let i = ROWS - 1; i >= 0; i--) {
            if (gameState.board[i][colIndex] === null) {
                rowIndex = i;
                break;
            }
        }

        if (rowIndex === -1) {
            toast({ variant: 'destructive', title: "Column Full!", description: "Please choose another column."});
            return; // Column is full
        }

        const newBoard = gameState.board.map(row => [...row]);
        newBoard[rowIndex][colIndex] = gameState.nextPlayer;

        const winner = checkWin(newBoard);
        const isDraw = !winner && newBoard.flat().every(cell => cell !== null);

        let newScores = { ...gameState.scores };
        if (winner) {
            newScores[winner]++;
        }
        
        const newGameState: Partial<GameState> = {
            board: newBoard,
            nextPlayer: gameState.nextPlayer === 'R' ? 'Y' : 'R',
            winner: winner || (isDraw ? 'draw' : null),
            scores: newScores,
        };

        await updateDoc(gameDocRef, newGameState);
    };
    
    const handleResetGame = async () => {
         if (!gameState) return;
         const newGameState: Partial<GameState> = {
            board: createEmptyBoard(),
            nextPlayer: 'R', // Red always starts
            winner: null,
         };
         await updateDoc(gameDocRef, newGameState);
    };

    const getStatusMessage = () => {
        if (!gameState) return "Loading game...";
        const { winner, nextPlayer, players } = gameState;
        
        const mySymbol = Object.keys(players).find(key => players[key as PlayerSymbol] === currentUser.id) as PlayerSymbol;
        
        if (winner) {
            if (winner === 'draw') return "It's a draw!";
            const winnerName = players[winner] === currentUser.id ? "You" : "Opponent";
            return `${winnerName} won!`;
        }

        return nextPlayer === mySymbol ? "Your turn" : "Opponent's turn";
    };

     if (!gameState) {
        return (
             <Card>
                <CardHeader><CardTitle>Loading Game...</CardTitle></CardHeader>
                <CardContent className="flex justify-center items-center p-6">
                    <RefreshCw className="h-8 w-8 animate-spin" />
                </CardContent>
            </Card>
        )
    }

    const mySymbol = Object.keys(gameState.players).find(key => gameState.players[key as PlayerSymbol] === currentUser.id) as PlayerSymbol | undefined;
    if (!mySymbol) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Error</CardTitle>
                    <CardDescription>Could not join game. You may not be a member of this conversation.</CardDescription>
                </CardHeader>
            </Card>
        )
    }
    const opponentSymbol = mySymbol === 'R' ? 'Y' : 'R';


    return (
        <Card>
            <CardHeader>
                <CardTitle>Connect Four</CardTitle>
                <CardDescription>You are playing as <span className={cn('font-bold', mySymbol === 'R' ? 'text-red-500' : 'text-yellow-400')}>{mySymbol === 'R' ? 'Red' : 'Yellow'}</span>. First to get 4 in a row wins.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
                 <div className="text-lg font-semibold p-2 bg-muted rounded-md">{getStatusMessage()}</div>
                 <div className="p-2 bg-blue-700 rounded-lg inline-block">
                    <div className="grid gap-1" style={{gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`}}>
                        {gameState.board.map((row, r) => 
                            row.map((cell, c) => (
                                <div key={`${r}-${c}`} className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center cursor-pointer" onClick={() => handleColumnClick(c)}>
                                    <div className={cn("w-full h-full rounded-full bg-blue-900 transition-colors", {
                                        "bg-red-500": cell === 'R',
                                        "bg-yellow-400": cell === 'Y',
                                    })}></div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                 <div className="flex items-center gap-4 text-lg">
                    <span>Scores:</span>
                    <span>You ({gameState.scores[mySymbol] || 0})</span>
                    <span>-</span>
                    <span>Opponent ({gameState.scores[opponentSymbol] || 0})</span>
                </div>
                {gameState.winner && (
                     <Button onClick={handleResetGame}>
                        <RefreshCw className="mr-2 h-4 w-4"/>
                        Play Again
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
