import type { Firestore } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';

import { FirestoreMailNotifier } from './firestore-mail-notifier.js';

describe('FirestoreMailNotifier', () => {
  it('escribe en la colección mail el documento que procesa la extensión Trigger Email', async () => {
    const added: { collection: string; document: unknown }[] = [];
    const firestore = {
      collection: (collection: string) => ({
        add: (document: unknown) => {
          added.push({ collection, document });
          return Promise.resolve({ id: 'doc-1' });
        },
      }),
    } as unknown as Firestore;

    await new FirestoreMailNotifier(firestore).send({
      to: 'ana@example.com',
      subject: 'Tienes un match en ChangeHouse',
      text: 'texto',
      html: '<p>html</p>',
    });

    expect(added).toEqual([
      {
        collection: 'mail',
        document: {
          to: ['ana@example.com'],
          message: {
            subject: 'Tienes un match en ChangeHouse',
            text: 'texto',
            html: '<p>html</p>',
          },
        },
      },
    ]);
  });
});
