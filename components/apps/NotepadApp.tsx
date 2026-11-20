/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface NotepadAppProps {
    initialContent?: string;
}

export const NotepadApp: React.FC<NotepadAppProps> = ({ initialContent = '' }) => {
    return (
        <div className="h-full w-full bg-[#1e2b2d] text-zinc-100 flex flex-col">
            <textarea 
                className="flex-1 w-full h-full p-4 resize-none border-none focus:outline-none text-[18px] bg-transparent overflow-y-auto overscroll-y-contain leading-tight"
                style={{ fontFamily: "'m6x11plus', monospace" }}
                defaultValue={initialContent}
                spellCheck={false}
            />
        </div>
    );
};