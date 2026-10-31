import type { Firestore } from 'firebase-admin/firestore';

import type { EmailNotification, EmailNotifier } from '../../application/notifications/notifier.js';

/** Colección que vigila la extensión Trigger Email de Firebase. */
const MAIL_COLLECTION = 'mail';

/** Adaptador de `EmailNotifier`: un documento en `mail`, que la extensión entrega por SMTP. */
export class FirestoreMailNotifier implements EmailNotifier {
  constructor(private readonly firestore: Firestore) {}

  async send(email: EmailNotification): Promise<void> {
    await this.firestore.collection(MAIL_COLLECTION).add({
      to: [email.to],
      message: { subject: email.subject, text: email.text, html: email.html },
    });
  }
}
