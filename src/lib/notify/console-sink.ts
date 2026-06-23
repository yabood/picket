import type { Notification, NotificationSink } from './index';
import { toMarkdown } from './markdown';

export function createConsoleSink(): NotificationSink {
  return {
    id: 'console',
    async send(n: Notification) {
      console.log('\n----- BRIEF -----');
      console.log(toMarkdown(n));
      console.log('----- /BRIEF -----\n');
      return { delivered: true, destination: 'stdout' };
    },
  };
}
