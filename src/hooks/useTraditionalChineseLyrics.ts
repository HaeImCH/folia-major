import { useEffect } from 'react';
import type { LyricData } from '../types';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { useTypographySettingsStore } from '../stores/useTypographySettingsStore';
import { convertLyricDataToTraditional } from '../utils/lyrics/traditionalChinese';

// src/hooks/useTraditionalChineseLyrics.ts
// Keeps the original lyric data available while the optional OpenCC conversion loads asynchronously.
// The converted copies are published as display overrides on the playback store, so every surface
// reading selectDisplayLyrics picks them up while raw `lyrics` consumers keep the source text.

/** Converts the current and outgoing (automix tail) lyrics when the Traditional setting is on. */
export const useTraditionalChineseLyrics = (): void => {
    const enabled = useTypographySettingsStore(state => state.convertSimplifiedLyricsToTraditional);
    const lyrics = usePlaybackStore(state => state.lyrics);
    const tailLyrics = usePlaybackStore(state => state.transitionDisplay?.lyrics ?? null);
    const setDisplayLyricsOverrides = usePlaybackStore(state => state.setDisplayLyricsOverrides);

    useEffect(() => {
        let active = true;

        if (!enabled) {
            setDisplayLyricsOverrides(null);
            return () => {
                active = false;
            };
        }

        const sources = [lyrics, tailLyrics].filter((entry): entry is LyricData => Boolean(entry));
        // Drop overrides for lyrics that are no longer on screen before converting the new ones.
        setDisplayLyricsOverrides(previous => {
            const next = new Map<LyricData, LyricData>();
            sources.forEach(source => {
                const converted = previous?.get(source);
                if (converted) next.set(source, converted);
            });
            return next;
        });

        sources.forEach(source => {
            if (usePlaybackStore.getState().displayLyricsOverrides?.has(source)) {
                return;
            }
            void convertLyricDataToTraditional(source)
                .then(value => {
                    if (!active || !value) {
                        return;
                    }
                    setDisplayLyricsOverrides(previous => {
                        const next = new Map(previous ?? []);
                        next.set(source, value);
                        return next;
                    });
                })
                .catch(error => {
                    console.error('[useTraditionalChineseLyrics] Failed to convert lyrics:', error);
                });
        });

        return () => {
            active = false;
        };
    }, [enabled, lyrics, setDisplayLyricsOverrides, tailLyrics]);
};
