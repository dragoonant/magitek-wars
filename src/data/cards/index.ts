// The one place card data is registered. Validation throws at load (no silent fallback).
import type { CardDef } from '../../engine/types';
import { registerCards } from '../../engine/query';
import { validateCards } from '../../engine/validate';
import { prism } from './prism';
import { ember } from './ember';
import { tide } from './tide';
import { coil } from './coil';
import { under } from './under';
import { storm } from './storm';

export const ALL_CARDS: CardDef[] = [...prism, ...ember, ...tide, ...coil, ...under, ...storm];

const errors = validateCards(ALL_CARDS);
if (errors.length) throw new Error(`Card data is invalid:\n${errors.join('\n')}`);
registerCards(ALL_CARDS);
