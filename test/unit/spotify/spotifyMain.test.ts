import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// test/unit/spotify/spotifyMain.test.ts
// Verifies the main-process Spotify PKCE and playback normalization boundaries.

const require = createRequire(import.meta.url);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');
const readRepoFile = (relativePath: string) => readFile(path.join(repoRoot, relativePath), 'utf8');
const {
    buildCodeChallenge,
    buildSpotifyPlaybackControlRequest,
    isValidSpotifyClientId,
    normalizeSpotifyPlayback,
} = require('../../../electron/spotify.cjs') as {
    buildCodeChallenge: (verifier: string) => string;
    buildSpotifyPlaybackControlRequest: (command: ElectronSpotifyPlaybackControlCommand) => { method: string; pathname: string };
    isValidSpotifyClientId: (clientId: string) => boolean;
    normalizeSpotifyPlayback: (payload: unknown) => ElectronSpotifyPlayback | null;
};

describe('Spotify main-process helpers', () => {
    it('keeps the Spotify controller wired through the trusted Electron bridge', async () => {
        const [mainSource, preloadSource, stageApiSource] = await Promise.all([
            readRepoFile('electron/main.cjs'),
            readRepoFile('electron/preload.cjs'),
            readRepoFile('electron/stageApi.cjs'),
        ]);

        expect(mainSource).toContain("const { createSpotifyController } = require('./spotify.cjs');");
        expect(mainSource).toContain("name: 'spotify-auth'");
        expect(mainSource).toContain("ipcMain.handle('spotify-get-status'");
        expect(mainSource).toContain("ipcMain.handle('spotify-connect'");
        expect(mainSource).toContain("ipcMain.handle('spotify-control-playback'");
        expect(mainSource).toContain('isTrustedMainWindowContents(event.sender)');
        expect(mainSource).toContain('spotify.stop();');

        expect(preloadSource).toContain("getSpotifyStatus: () => ipcRenderer.invoke('spotify-get-status')");
        expect(preloadSource).toContain("controlSpotifyPlayback: (command) => ipcRenderer.invoke('spotify-control-playback', command)");
        expect(preloadSource).toContain("ipcRenderer.on('spotify-status-changed', listener)");

        expect(stageApiSource).toContain("configuredSource === 'spotify'");
        expect(stageApiSource).toContain("configuredSource === 'playercap'");
    });

    it('builds the RFC 7636 S256 challenge', () => {
        expect(buildCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
            'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        );
    });

    it('accepts client IDs without accepting arbitrary text', () => {
        expect(isValidSpotifyClientId('0123456789abcdef0123456789abcdef')).toBe(true);
        expect(isValidSpotifyClientId('too short')).toBe(false);
        expect(isValidSpotifyClientId('0123456789abcdef0123456789abcde!')).toBe(false);
    });

    it('normalizes a Spotify playback response for the renderer', () => {
        const playback = normalizeSpotifyPlayback({
            progress_ms: 12_345,
            is_playing: true,
            device: { id: 'device-1', name: 'Desktop', type: 'Computer', is_restricted: false },
            item: {
                id: 'track-1',
                uri: 'spotify:track:track-1',
                type: 'track',
                name: 'Test Track',
                duration_ms: 180_000,
                artists: [{ name: 'Test Artist' }],
                album: { name: 'Test Album', images: [{ url: 'https://image.test/cover.jpg' }] },
            },
        });

        expect(playback).toMatchObject({
            id: 'track-1',
            title: 'Test Track',
            artist: 'Test Artist',
            album: 'Test Album',
            coverUrl: 'https://image.test/cover.jpg',
            durationMs: 180_000,
            progressMs: 12_345,
            isPlaying: true,
        });
    });

    it('maps the supported player controls to fixed Web API requests', () => {
        expect(buildSpotifyPlaybackControlRequest({ action: 'resume' })).toEqual({ method: 'PUT', pathname: '/me/player/play' });
        expect(buildSpotifyPlaybackControlRequest({ action: 'pause' })).toEqual({ method: 'PUT', pathname: '/me/player/pause' });
        expect(buildSpotifyPlaybackControlRequest({ action: 'seek', positionMs: 12_345.9 })).toEqual({
            method: 'PUT',
            pathname: '/me/player/seek?position_ms=12345',
        });
        expect(buildSpotifyPlaybackControlRequest({ action: 'next' })).toEqual({ method: 'POST', pathname: '/me/player/next' });
        expect(buildSpotifyPlaybackControlRequest({ action: 'previous' })).toEqual({ method: 'POST', pathname: '/me/player/previous' });
        expect(buildSpotifyPlaybackControlRequest({ action: 'repeat', state: 'track' })).toEqual({
            method: 'PUT',
            pathname: '/me/player/repeat?state=track',
        });
    });

    it('rejects malformed playback controls before they reach Spotify', () => {
        expect(() => buildSpotifyPlaybackControlRequest({ action: 'seek', positionMs: -1 })).toThrow(/non-negative/i);
        expect(() => buildSpotifyPlaybackControlRequest({ action: 'repeat', state: 'bad' } as any)).toThrow(/repeat state/i);
    });
});
