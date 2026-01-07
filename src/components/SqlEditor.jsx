/**
 * SQL Editor Component with Syntax Highlighting
 * Uses overlay approach: transparent textarea over highlighted pre
 */
import { useRef, useEffect, useCallback } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';

export function SqlEditor({
    value,
    onChange,
    onFocus,
    onBlur,
    placeholder,
    error = null,
    errorLine = null,
    fontSize = 13
}) {
    const textareaRef = useRef(null);
    const highlightRef = useRef(null);
    const containerRef = useRef(null);

    // Sync scroll between textarea and highlight layer
    const handleScroll = useCallback(() => {
        if (highlightRef.current && textareaRef.current) {
            highlightRef.current.scrollTop = textareaRef.current.scrollTop;
            highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    }, []);

    // Highlight code
    const getHighlightedCode = useCallback(() => {
        if (!value) return '';

        try {
            const highlighted = Prism.highlight(value, Prism.languages.sql, 'sql');

            // If there's an error line, add error highlighting
            if (errorLine !== null && errorLine > 0) {
                const lines = highlighted.split('\n');
                const errorIdx = errorLine - 1;
                if (lines[errorIdx] !== undefined) {
                    lines[errorIdx] = `<span class="sql-error-line">${lines[errorIdx]}</span>`;
                }
                return lines.join('\n');
            }

            return highlighted;
        } catch {
            return value;
        }
    }, [value, errorLine]);

    const style = { fontSize: `${fontSize}px` };

    return (
        <div
            ref={containerRef}
            className={`sql-editor-container ${error ? 'sql-editor-container--error' : ''}`}
        >
            {/* Highlight layer (behind) */}
            <pre
                ref={highlightRef}
                className="sql-editor-highlight"
                aria-hidden="true"
                style={style}
            >
                <code
                    className="language-sql"
                    dangerouslySetInnerHTML={{ __html: getHighlightedCode() || placeholder || '' }}
                />
            </pre>

            {/* Textarea layer (front, transparent) */}
            <textarea
                ref={textareaRef}
                className="sql-editor-textarea"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={onFocus}
                onBlur={onBlur}
                onScroll={handleScroll}
                placeholder={placeholder}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                style={style}
            />
        </div>
    );
}

/**
 * Parse error message to extract line number if possible
 * @param {string} errorMsg - Error message from parser
 * @returns {{ line: number|null, column: number|null, message: string }}
 */
export function parseErrorPosition(errorMsg) {
    if (!errorMsg) return { line: null, column: null, message: '' };

    // Try to match patterns like "line 5" or "at position 123"
    const lineMatch = errorMsg.match(/line\s+(\d+)/i);
    const colMatch = errorMsg.match(/column\s+(\d+)/i);
    const posMatch = errorMsg.match(/position\s+(\d+)/i);

    return {
        line: lineMatch ? parseInt(lineMatch[1], 10) : null,
        column: colMatch ? parseInt(colMatch[1], 10) : null,
        position: posMatch ? parseInt(posMatch[1], 10) : null,
        message: errorMsg
    };
}

export default SqlEditor;
