import { v7 as uuidv7 } from 'uuid';

import type { Clock } from '../application/clock.js';
import type { IdGenerator } from '../application/id-generator.js';

export const systemClock: Clock = { now: () => new Date() };

export const uuidV7Generator: IdGenerator = { next: () => uuidv7() };
