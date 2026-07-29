import React from 'react';
import { Copy, Maximize2, Minimize2, Minus, Radio, Square, X } from 'lucide-react';

export default function WindowControls({
    revealed,
    isExpanded,
    expandMode,
    isDaylight = false,
    isMainWindowClickThroughEnabled = false,
}: {
    revealed: boolean;
    isExpanded: boolean;
    expandMode: ElectronMainWindowState['expandMode'];
    isDaylight?: boolean;
    isMainWindowClickThroughEnabled?: boolean;
}) {
    const electron = window.electron;

    if (!electron) return null;

    const expandLabel = expandMode === 'fullscreen'
        ? (isExpanded ? 'Exit fullscreen' : 'Enter fullscreen')
        : (isExpanded ? 'Restore window' : 'Maximize window');
    const remoteControlVisible = revealed && !isMainWindowClickThroughEnabled;
    const standardControlsVisible = revealed && !isMainWindowClickThroughEnabled;
    const remoteBtnClass = `flex items-center justify-center w-11 h-full transition-all duration-200 ${
        remoteControlVisible
            ? isDaylight
                ? 'pointer-events-auto opacity-85 translate-y-0 hover:opacity-100 hover:bg-black/[0.05]'
                : 'pointer-events-auto opacity-75 translate-y-0 hover:opacity-100 hover:bg-white/10'
            : 'pointer-events-none opacity-0 -translate-y-1'
    }`;
    const btnClass = `flex items-center justify-center w-11 h-full transition-all duration-200 ${
        standardControlsVisible
            ? isDaylight
                ? 'pointer-events-auto opacity-85 translate-y-0 hover:opacity-100 hover:bg-black/[0.05]'
                : 'pointer-events-auto opacity-75 translate-y-0 hover:opacity-100 hover:bg-white/10'
            : 'pointer-events-none opacity-0 -translate-y-1'
    }`;
    const closeBtnClass = `flex items-center justify-center w-11 h-full transition-all duration-200 ${
        standardControlsVisible
            ? isDaylight
                ? 'pointer-events-auto opacity-85 translate-y-0 hover:opacity-100 hover:bg-red-500 hover:text-white'
                : 'pointer-events-auto opacity-75 translate-y-0 hover:opacity-100 hover:bg-red-500 hover:text-white'
            : 'pointer-events-none opacity-0 -translate-y-1'
    }`;

    return (
        <div
            className={`flex h-full ${isDaylight ? 'text-zinc-800' : 'text-[var(--text-primary)]'}`}
            style={{
                WebkitAppRegion: 'no-drag',
                pointerEvents: 'none',
            } as React.CSSProperties}
        >
            <button
                className={remoteBtnClass}
                title="Remote control"
                tabIndex={remoteControlVisible ? 0 : -1}
                onClick={() => void electron.openRemoteControl?.()}
            >
                <Radio size={15} />
            </button>
            <button
                className={btnClass}
                tabIndex={standardControlsVisible ? 0 : -1}
                onClick={() => electron.minimizeWindow()}
            >
                <Minus size={16} />
            </button>
            <button
                className={btnClass}
                tabIndex={standardControlsVisible ? 0 : -1}
                aria-label={expandLabel}
                title={expandLabel}
                onClick={() => void electron.toggleMaximizeWindow()}
            >
                {expandMode === 'fullscreen'
                    ? isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />
                    : isExpanded ? <Copy size={13} /> : <Square size={13} />}
            </button>
            <button
                className={closeBtnClass}
                tabIndex={standardControlsVisible ? 0 : -1}
                onClick={() => electron.closeWindow()}
            >
                <X size={16} />
            </button>
        </div>
    );
}
