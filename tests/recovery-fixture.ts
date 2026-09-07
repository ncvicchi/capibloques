import type { Page } from '@playwright/test';
import type { RecoveryDraft } from '../lib/project-recovery';

export async function recoveryRows(
  page: Page,
  accountId: string,
): Promise<RecoveryDraft[]> {
  return page.evaluate(
    (account) =>
      new Promise<RecoveryDraft[]>((resolve, reject) => {
        const request = indexedDB.open('capibloques-recovery', 1);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction('drafts', 'readonly');
          const rows = tx
            .objectStore('drafts')
            .index('account')
            .getAll(account);
          tx.oncomplete = () => {
            db.close();
            resolve(
              rows.result.sort(
                (a: RecoveryDraft, b: RecoveryDraft) =>
                  b.updatedAt - a.updatedAt,
              ),
            );
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
        request.onerror = () => reject(request.error);
      }),
    accountId,
  );
}

export async function clearRecovery(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase('capibloques-recovery');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
  );
}
