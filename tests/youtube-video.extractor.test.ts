import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getYoutubeData,
  readInnertubeClientVersion,
} from '../src/content/content-extractor/youtube-video.extractor';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readInnertubeClientVersion', () => {
  it('reads the version from escaped ytcfg script text', () => {
    vi.stubGlobal('document', {
      scripts: [
        {
          textContent:
            "window.ytcfg.set('EMERGENCY_BASE_URL', '\\/error_204?t\\x3djserror\\x26client.version\\x3d2.20260731.00.00');",
        },
      ],
    });

    expect(readInnertubeClientVersion()).toBe('2.20260731.00.00');
  });

  it('falls back to the plain marker when available', () => {
    vi.stubGlobal('document', {
      scripts: [
        {
          textContent: 'var config = { client.version=2.20260731.00.00 };',
        },
      ],
    });

    expect(readInnertubeClientVersion()).toBe('2.20260731.00.00');
  });

  it('returns null when the version is absent', () => {
    vi.stubGlobal('document', {
      scripts: [{ textContent: 'console.log("no config here");' }],
    });

    expect(readInnertubeClientVersion()).toBeNull();
  });
});

describe('getYoutubeData', () => {
  it('keeps metadata when the player response is unplayable', async () => {
    vi.stubGlobal('document', {
      scripts: [
        {
          textContent:
            "window.ytcfg.set('EMERGENCY_BASE_URL', '\\/error_204?t\\x3djserror\\x26client.version\\x3d2.20260731.00.00');",
        },
      ],
    });

    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            playabilityStatus: {
              status: 'UNPLAYABLE',
              reason: '视频无法播放',
            },
            videoDetails: {
              videoId: 'dQw4w9WgXcQ',
              title:
                'Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)',
              author: 'Rick Astley',
              shortDescription: 'desc',
              lengthSeconds: '213',
            },
          }),
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    await expect(getYoutubeData('dQw4w9WgXcQ')).resolves.toEqual({
      videoId: 'dQw4w9WgXcQ',
      title:
        'Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)',
      author: 'Rick Astley',
      description: 'desc',
      duration: 213,
      subtitle: [],
      selectedTrack: null,
      availableTracks: [],
    });
  });
});
