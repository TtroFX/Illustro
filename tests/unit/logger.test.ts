import { describe, expect, it, vi } from 'vitest';
import { createLogger, getRecentLogRecords } from '../../src/shared/logger.js';

describe('structured logger', () => {
  it('records scope, event, level, and build identity', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const logger = createLogger('m0-unit');

    logger.info('foundation.ready', { ok: true });

    const record = getRecentLogRecords().at(-1);
    expect(record).toMatchObject({
      level: 'info',
      scope: 'm0-unit',
      event: 'foundation.ready',
      data: { ok: true },
    });
    expect(record?.buildSha.length).toBeGreaterThan(0);
    info.mockRestore();
  });
});
