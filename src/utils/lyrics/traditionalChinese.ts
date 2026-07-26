import type { ConverterFunction } from 'opencc-js/core';
import type { LyricAlternateText, LyricBackgroundVocal, LyricData, LyricSyllable, Word } from '../../types';

// src/utils/lyrics/traditionalChinese.ts
// Converts displayed lyric text to Taiwan Traditional Chinese without changing timing metadata.

let converterPromise: Promise<ConverterFunction> | null = null;

// Loads the sizeable OpenCC dictionaries only after the setting is enabled.
const loadTraditionalChineseConverter = (): Promise<ConverterFunction> => {
    if (!converterPromise) {
        converterPromise = Promise.all([
            import('opencc-js/core'),
            import('opencc-js/preset/cn2t'),
        ]).then(([{ ConverterBuilder }, preset]) => ConverterBuilder(preset)({ from: 'cn', to: 'tw' }));
    }

    return converterPromise;
};

const convertSyllables = (syllables: LyricSyllable[] | undefined, convertToTraditional: ConverterFunction): LyricSyllable[] | undefined => (
    syllables?.map(syllable => ({
        ...syllable,
        text: convertToTraditional(syllable.text),
        ruby: syllable.ruby?.map(ruby => ({
            ...ruby,
            text: convertToTraditional(ruby.text),
        })),
    }))
);

const convertWords = (words: Word[], convertToTraditional: ConverterFunction): Word[] => words.map(word => ({
    ...word,
    text: convertToTraditional(word.text),
    syllables: convertSyllables(word.syllables, convertToTraditional),
}));

const convertAlternateTexts = (alternateTexts: LyricAlternateText[] | undefined, convertToTraditional: ConverterFunction): LyricAlternateText[] | undefined => (
    alternateTexts?.map(alternateText => {
        if (alternateText.role.toLowerCase() === 'romanization') {
            return alternateText;
        }

        return {
            ...alternateText,
            text: convertToTraditional(alternateText.text),
            syllables: convertSyllables(alternateText.syllables, convertToTraditional),
        };
    })
);

const convertBackgroundVocal = (
    vocal: LyricBackgroundVocal,
    convertToTraditional: ConverterFunction,
): LyricBackgroundVocal => ({
    ...vocal,
    text: convertToTraditional(vocal.text),
    translation: vocal.translation ? convertToTraditional(vocal.translation) : vocal.translation,
    words: convertWords(vocal.words, convertToTraditional),
    alternateTexts: convertAlternateTexts(vocal.alternateTexts, convertToTraditional),
});

export const convertLyricDataToTraditional = async (lyrics: LyricData | null): Promise<LyricData | null> => {
    if (!lyrics) {
        return null;
    }

    const convertToTraditional = await loadTraditionalChineseConverter();

    return {
        ...lyrics,
        title: lyrics.title ? convertToTraditional(lyrics.title) : lyrics.title,
        artist: lyrics.artist ? convertToTraditional(lyrics.artist) : lyrics.artist,
        lines: lyrics.lines.map(line => ({
            ...line,
            fullText: convertToTraditional(line.fullText),
            translation: line.translation ? convertToTraditional(line.translation) : line.translation,
            words: convertWords(line.words, convertToTraditional),
            alternateTexts: convertAlternateTexts(line.alternateTexts, convertToTraditional),
            backgroundVocal: line.backgroundVocal
                ? convertBackgroundVocal(line.backgroundVocal, convertToTraditional)
                : line.backgroundVocal,
            backgroundVocals: line.backgroundVocals?.map(vocal => (
                convertBackgroundVocal(vocal, convertToTraditional)
            )),
        })),
        ttml: lyrics.ttml ? {
            ...lyrics.ttml,
            agents: lyrics.ttml.agents
                ? Object.fromEntries(Object.entries(lyrics.ttml.agents).map(([id, agent]) => [id, {
                    ...agent,
                    name: agent.name ? convertToTraditional(agent.name) : agent.name,
                }]))
                : lyrics.ttml.agents,
        } : lyrics.ttml,
    };
};
