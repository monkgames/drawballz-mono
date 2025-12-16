
import { simulateBattle } from './src/battle_logic';
import { Ball } from './src/types';

// Left: Green 6, Orange 3, Yellow 3, Blue 1
const leftBalls: Ball[] = [
    { color: 1, number: 6 }, // Green
    { color: 3, number: 3 }, // Orange
    { color: 4, number: 3 }, // Yellow
    { color: 5, number: 1 }, // Blue
];

// Right: Blue 8, Green 3, Yellow 1, Orange 1
const rightBalls: Ball[] = [
    { color: 5, number: 8 }, // Blue
    { color: 1, number: 3 }, // Green
    { color: 4, number: 1 }, // Yellow
    { color: 3, number: 1 }, // Orange
];

const weights = {
    green: 1,
    pink: 2,
    orange: 3,
    yellow: 4,
    blue: 5
};

const result = simulateBattle(leftBalls, rightBalls, weights);

console.log(JSON.stringify(result, null, 2));
