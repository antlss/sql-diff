/**
 * SQL Editor Component with Syntax Highlighting & Auto-resize
 * Uses scrollHeight measurement for dynamic height
 */
import { useRef, useEffect, useCallback, useState, useLayoutEffect } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 1200;

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
    const [height, setHeight] = useState(MIN_HEIGHT);

    // Auto-resize based on content
    useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        // Reset to min height to get accurate scrollHeight
        textarea.style.height = `${MIN_HEIGHT}px`;

        // Calculate new height based on scrollHeight
        const scrollHeight = textarea.scrollHeight;
        const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, scrollHeight));

        setHeight(newHeight);
        textarea.style.height = `${newHeight}px`;
    }, [value, fontSize]);

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

    const textStyle = { fontSize: `${fontSize}px` };

    return (
        <div
            ref={containerRef}
            className={`sql-editor-container ${error ? 'sql-editor-container--error' : ''}`}
            style={{ height: `${height}px` }}
        >
            {/* Highlight layer (behind) */}
            <pre
                ref={highlightRef}
                className="sql-editor-highlight"
                aria-hidden="true"
                style={textStyle}
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
                style={{ ...textStyle, height: `${height}px` }}
            />
        </div>
    );
}

/**
 * Parse error message to extract line number if possible
 */
export function parseErrorPosition(errorMsg) {
    if (!errorMsg) return { line: null, column: null, message: '' };

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
