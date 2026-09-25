import { beforeEach, describe } from 'vitest';
import { InMemoryFamilyStore } from '../../../src/server/family/memory-store.js';
import { registerFamilyStoreContract, type StoreContractContext } from './store-contract.js';

describe('in-memory family store', () => {
  let context: StoreContractContext;
  let tick = Date.parse('2026-09-25T12:00:00.000Z');
  beforeEach(() => {
    context = {
      // Strictly increasing timestamps keep creation order deterministic.
      store: new InMemoryFamilyStore(() => new Date((tick += 1_000))),
      actors: ['30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002'],
    };
  });
  registerFamilyStoreContract('Memory', () => context);
});
