
const ADJECTIVES = [
  'blue', 'happy', 'fast', 'silent', 'bright', 'dark', 'calm', 'brave', 'clever', 'eager',
  'gentle', 'green', 'jolly', 'kind', 'lively', 'nice', 'proud', 'silly', 'witty', 'zany'
];

const NOUNS = [
  'tree', 'sun', 'moon', 'river', 'ocean', 'cat', 'dog', 'bird', 'fish', 'lion',
  'house', 'car', 'book', 'pen', 'cup', 'star', 'cloud', 'rock', 'leaf', 'ship'
];

export function generateSimpleContactCode(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj}-${noun}-${num}`;
}

export function generateSimpleLoginCode(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
