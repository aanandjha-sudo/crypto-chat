
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserData } from '@/app/chat/page';
import { RefreshCw, Hand, HandMetal, Handshake } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';

type Choice = 'rock' | 'paper' | 'scissors';
type Player = 'P1' | 'P2';

interface GameState {
    players: { P1: string; P2: string };
    choices: { P1: Choice | null; P2: Choice | null };
    scores: { P1: number; P2: number };
    roundWinner: Player | 'draw' | null;
    gameWinner: Player | null;
}

interface RockPaperScissorsProps {
    conversationId: string;
    currentUser: UserData;
}

const WINS_NEEDED = 3;

export function RockPaperScissors({ conversationId, currentUser }: RockPaperScissorsProps) {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const gameDocRef = doc(db, 'games-rockpaperscissors', conversationId);
    const { toast } = useToast();

    const createInitialState = (p1: string, p2: string): GameState => ({
        players: { P1: p1, P2: p2 },
        choices: { P1: null, P2: null },
        scores: { P1: 0, P2: 0 },
        roundWinner: null,
        gameWinner: null,
    });

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
                            const newState = createInitialState(sortedMembers[0], sortedMembers[1]);
                            await setDoc(gameDocRef, newState);
                        }
                    }
                }
            }
        });
        return () => unsubscribe();
    }, [gameDocRef, conversationId, currentUser.id]);
    
    const getPlayer = (): Player | null => {
        if (!gameState) return null;
        if (gameState.players.P1 === currentUser.id) return 'P1';
        if (gameState.players.P2 === currentUser.id) return 'P2';
        return null;
    }

    const handleChoice = async (choice: Choice) => {
        if (!gameState || gameState.gameWinner) return;
        const me = getPlayer();
        if (!me) return;

        if (gameState.choices[me]) {
            toast({ title: "You've already chosen!", description: "Wait for your opponent."});
            return;
        }

        const newChoices = { ...gameState.choices, [me]: choice };
        
        if (newChoices.P1 && newChoices.P2) {
            // Both players have chosen, determine winner
            const p1Choice = newChoices.P1;
            const p2Choice = newChoices.P2;
            let roundWinner: GameState['roundWinner'] = null;

            if (p1Choice === p2Choice) {
                roundWinner = 'draw';
            } else if (
                (p1Choice === 'rock' && p2Choice === 'scissors') ||
                (p1Choice === 'scissors' && p2Choice === 'paper') ||
                (p1Choice === 'paper' && p2Choice === 'rock')
            ) {
                roundWinner = 'P1';
            } else {
                roundWinner = 'P2';
            }
            
            let newScores = {...gameState.scores};
            if(roundWinner !== 'draw') {
                newScores[roundWinner]++;
            }
            
            let gameWinner: GameState['gameWinner'] = null;
            if(newScores.P1 === WINS_NEEDED) gameWinner = 'P1';
            if(newScores.P2 === WINS_NEEDED) gameWinner = 'P2';

            await updateDoc(gameDocRef, { 
                choices: newChoices, 
                roundWinner, 
                scores: newScores,
                gameWinner,
            });

            // Reset for next round after a delay
            setTimeout(async () => {
                if(!gameWinner) {
                    await updateDoc(gameDocRef, {
                        choices: { P1: null, P2: null },
                        roundWinner: null,
                    });
                }
            }, 2500);

        } else {
            // Only one player has chosen, just update choices
            await updateDoc(gameDocRef, { choices: newChoices });
        }
    };
    
    const handleResetGame = async () => {
        if(!gameState) return;
        const newState = createInitialState(gameState.players.P1, gameState.players.P2);
        await setDoc(gameDocRef, newState);
    };

    const getStatusMessage = () => {
        if (!gameState) return "Loading game...";
        const { gameWinner, players, roundWinner, choices } = gameState;
        const me = getPlayer();
        if(!me) return "Spectating...";

        if(gameWinner) {
            return players[gameWinner] === currentUser.id ? "You won the game!" : "You lost the game!";
        }
        
        const myChoice = choices[me];
        const opponentPlayer = me === 'P1' ? 'P2' : 'P1';
        const opponentChoice = choices[opponentPlayer];

        if(roundWinner) {
             if(roundWinner === 'draw') return "Round is a draw!";
             return players[roundWinner] === currentUser.id ? "You win the round!" : "You lose the round!";
        }

        if(myChoice && opponentChoice) {
             return "Determining winner...";
        }

        if (myChoice) {
            return "Waiting for opponent...";
        }

        return "Choose your hand!";
    };

    if (!gameState) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Rock, Paper, Scissors</CardTitle>
                    <CardDescription>Loading Game...</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center items-center p-6 space-y-4 flex-col">
                    <Skeleton className="h-8 w-48" />
                    <div className="flex gap-4">
                        <Skeleton className="h-24 w-24" />
                        <Skeleton className="h-24 w-24" />
                        <Skeleton className="h-24 w-24" />
                    </div>
                     <Skeleton className="h-8 w-60" />
                </CardContent>
            </Card>
        );
    }
    
    const me = getPlayer();
    const amIPlayer = !!me;
    const opponent = me ? (me === 'P1' ? 'P2' : 'P1') : null;
    const myChoice = me ? gameState.choices[me] : null;
    const opponentChoice = opponent ? gameState.choices[opponent] : null;
    const bothChosen = myChoice && opponentChoice;

    const renderChoiceIcon = (choice: Choice | null, isOpponent: boolean) => {
        const revealed = !isOpponent || bothChosen;
        if(!choice) return <span className={cn("text-muted-foreground", {"animate-pulse": amIPlayer && !myChoice})}>?</span>;
        if(!revealed) return <span className="text-muted-foreground animate-pulse">?</span>;

        if(choice === 'rock') return <HandMetal className="w-16 h-16 transform -rotate-90" />;
        if(choice === 'paper') return <Hand className="w-16 h-16" />;
        if(choice === 'scissors') return <HandMetal className="w-16 h-16 transform scale-x-[-1]" />;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Rock, Paper, Scissors</CardTitle>
                <CardDescription>First to win {WINS_NEEDED} rounds is the winner!</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6">
                <div className="text-xl font-semibold p-2 bg-muted rounded-md min-w-[250px] text-center h-12 flex items-center justify-center">
                    {getStatusMessage()}
                </div>

                <div className="flex items-center justify-around w-full">
                    <div className="flex flex-col items-center gap-2">
                        <div className="text-lg font-bold">You</div>
                        <div className="w-32 h-32 rounded-lg bg-muted flex items-center justify-center text-4xl">
                            {renderChoiceIcon(myChoice, false)}
                        </div>
                        <div className="text-2xl font-bold">{me ? gameState.scores[me] : 0}</div>
                    </div>
                    <div className="text-4xl font-bold text-muted-foreground">VS</div>
                     <div className="flex flex-col items-center gap-2">
                        <div className="text-lg font-bold">Opponent</div>
                        <div className="w-32 h-32 rounded-lg bg-muted flex items-center justify-center text-4xl">
                             {renderChoiceIcon(opponentChoice, true)}
                        </div>
                         <div className="text-2xl font-bold">{opponent ? gameState.scores[opponent] : 0}</div>
                    </div>
                </div>

                {amIPlayer && !gameState.gameWinner && (
                    <div className="flex items-center gap-4">
                        <Button size="lg" onClick={() => handleChoice('rock')} disabled={!!myChoice}>
                            <HandMetal className="mr-2 transform -rotate-90" /> Rock
                        </Button>
                        <Button size="lg" onClick={() => handleChoice('paper')} disabled={!!myChoice}>
                            <Hand className="mr-2" /> Paper
                        </Button>
                        <Button size="lg" onClick={() => handleChoice('scissors')} disabled={!!myChoice}>
                             <HandMetal className="mr-2 transform scale-x-[-1]" /> Scissors
                        </Button>
                    </div>
                )}
                 
                {amIPlayer && gameState.gameWinner && (
                     <Button onClick={handleResetGame}>
                        <RefreshCw className="mr-2 h-4 w-4"/>
                        Play Again
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

