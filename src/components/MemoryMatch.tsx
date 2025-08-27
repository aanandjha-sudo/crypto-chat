
"use client";

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserData } from '@/app/chat/page';
import { RefreshCw, Star, Trophy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';

const EMOJIS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼'];

interface CardData {
    id: number;
    value: string;
    isFlipped: boolean;
    isMatched: boolean;
}

interface GameState {
    players: string[];
    board: CardData[];
    currentPlayer: string;
    flippedIndices: number[];
    matchedPairs: number;
    winner: string | null;
}

interface MemoryMatchProps {
    conversationId: string;
    currentUser: UserData;
}

const createShuffledBoard = (): CardData[] => {
    const cards = [...EMOJIS, ...EMOJIS];
    const shuffled = cards
        .map(value => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }, i) => ({ id: i, value, isFlipped: false, isMatched: false }));
    return shuffled;
};

export function MemoryMatch({ conversationId, currentUser }: MemoryMatchProps) {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const gameDocRef = doc(db, 'games-memorymatch', conversationId);
    const { toast } = useToast();
    const [isChecking, setIsChecking] = useState(false);

    useEffect(() => {
        const unsubscribe = onSnapshot(gameDocRef, async (docSnap) => {
            if (docSnap.exists()) {
                setGameState(docSnap.data() as GameState);
            } else {
                const conversationDoc = await getDoc(doc(db, 'conversations', conversationId));
                if (conversationDoc.exists()) {
                    const members = conversationDoc.data().members as string[];
                    if (members.length === 2) {
                        const sortedMembers = [...members].sort();
                        if (currentUser.id === sortedMembers[0]) {
                            const newGameState: GameState = {
                                players: sortedMembers,
                                board: createShuffledBoard(),
                                currentPlayer: sortedMembers[0],
                                flippedIndices: [],
                                matchedPairs: 0,
                                winner: null,
                            };
                            await setDoc(gameDocRef, newGameState);
                        }
                    }
                }
            }
        });
        return () => unsubscribe();
    }, [gameDocRef, conversationId, currentUser.id]);

    const handleCardClick = async (index: number) => {
        if (!gameState || isChecking || gameState.winner) return;

        if (gameState.currentPlayer !== currentUser.id) {
            toast({ title: "Not your turn!", description: "Wait for the other player to move." });
            return;
        }

        const card = gameState.board[index];
        if (card.isFlipped || card.isMatched) return;

        let newFlippedIndices = [...gameState.flippedIndices, index];
        const newBoard = gameState.board.map(c => c.id === card.id ? { ...c, isFlipped: true } : c);

        await updateDoc(gameDocRef, { board: newBoard, flippedIndices: newFlippedIndices });

        if (newFlippedIndices.length === 2) {
            setIsChecking(true);
            const [firstIndex, secondIndex] = newFlippedIndices;
            const firstCard = newBoard[firstIndex];
            const secondCard = newBoard[secondIndex];

            setTimeout(async () => {
                let finalBoard = [...newBoard];
                let matchedPairs = gameState.matchedPairs;
                let nextPlayer = gameState.currentPlayer;

                if (firstCard.value === secondCard.value) {
                    // It's a match!
                    finalBoard[firstIndex].isMatched = true;
                    finalBoard[secondIndex].isMatched = true;
                    matchedPairs++;
                } else {
                    // Not a match
                    finalBoard[firstIndex].isFlipped = false;
                    finalBoard[secondIndex].isFlipped = false;
                    // Switch turns
                    const currentPlayerIndex = gameState.players.indexOf(gameState.currentPlayer);
                    nextPlayer = gameState.players[(currentPlayerIndex + 1) % 2];
                }

                const winner = matchedPairs === EMOJIS.length ? 'collaborative' : null;

                await updateDoc(gameDocRef, {
                    board: finalBoard,
                    flippedIndices: [],
                    matchedPairs,
                    currentPlayer: nextPlayer,
                    winner: winner,
                });
                setIsChecking(false);
            }, 1000);
        }
    };
    
    const handleResetGame = async () => {
        if (!gameState) return;
        const sortedMembers = [...gameState.players].sort();
        const newGameState: GameState = {
            players: sortedMembers,
            board: createShuffledBoard(),
            currentPlayer: sortedMembers[0],
            flippedIndices: [],
            matchedPairs: 0,
            winner: null,
        };
        await setDoc(gameDocRef, newGameState);
    };

    const getStatusMessage = () => {
        if (!gameState) return "Loading game...";
        const { winner, currentPlayer } = gameState;
        
        if (winner) {
            return "Congratulations! You found all pairs!";
        }

        if (currentPlayer === currentUser.id) {
            return "Your turn. Pick a card.";
        }
        
        return "Opponent's turn...";
    };
    
    if (!gameState) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Memory Match</CardTitle>
                    <CardDescription>Loading Game...</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                    <Skeleton className="h-8 w-48" />
                    <div className="grid grid-cols-4 gap-2 md:gap-4">
                        {Array.from({ length: 16 }).map((_, i) => (
                           <Skeleton key={i} className="w-16 h-16 md:w-20 md:h-20" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Memory Match</CardTitle>
                <CardDescription>A cooperative game. Work together to find all the matching pairs!</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
                <div className="text-lg font-semibold p-2 bg-muted rounded-md min-w-[250px] text-center h-12 flex items-center justify-center">
                   {getStatusMessage()}
                </div>

                <div className="grid grid-cols-4 gap-2 md:gap-4">
                    {gameState.board.map((card, index) => (
                        <div
                            key={card.id}
                            className="w-16 h-16 md:w-20 md:h-20 perspective-[1000px]"
                            onClick={() => handleCardClick(index)}
                        >
                             <div className={cn(
                                "relative w-full h-full transition-transform duration-500 transform-style-3d",
                                { "rotate-y-180": card.isFlipped || card.isMatched }
                            )}>
                                <div className="absolute w-full h-full backface-hidden flex items-center justify-center bg-primary rounded-lg cursor-pointer">
                                    <Star className="w-8 h-8 text-primary-foreground" />
                                </div>
                                <div className="absolute w-full h-full backface-hidden rotate-y-180 flex items-center justify-center bg-muted rounded-lg text-4xl">
                                    {card.value}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                 <div className="flex items-center gap-4 text-lg">
                    <span>Pairs Found:</span>
                    <span className="font-bold">{gameState.matchedPairs} / {EMOJIS.length}</span>
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

// Add these styles to your globals.css to enable 3D transform for the card flip effect
/*
.perspective-\[1000px\] {
    perspective: 1000px;
}
.transform-style-3d {
    transform-style: preserve-3d;
}
.backface-hidden {
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
}
.rotate-y-180 {
    transform: rotateY(180deg);
}
*/
