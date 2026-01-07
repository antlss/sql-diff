import { useState, useCallback, useEffect, useRef } from 'react';
import { normalizeQuery, compareQueries } from './utils/sqlNormalizer';
import { SqlEditor } from './components/SqlEditor';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';
import './index.css';

// Sample queries for demonstration
const SAMPLE_QUERY_1 = `SELECT o.id, o.amount AS order_amount, c.name
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.status = 'active' AND c.country = 'US'
ORDER BY o.created_at DESC`;

const SAMPLE_QUERY_2 = `SELECT orders.id, customers.name, orders.amount AS order_amount
FROM orders
JOIN customers ON orders.customer_id = customers.id
WHERE customers.country = 'US' AND orders.status = 'active'
ORDER BY orders.created_at DESC`;

const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20];

// SQL Highlight component
function SqlHighlight({ code, fontSize }) {
  const codeRef = useRef(null);

  useEffect(() => {
    if (codeRef.current && code) {
      Prism.highlightElement(codeRef.current);
    }
  }, [code]);

  return (
    <pre className="sql-highlight" style={{ fontSize: `${fontSize}px` }}>
      <code ref={codeRef} className="language-sql">
        {code}
      </code>
    </pre>
  );
}

function App() {
  const [query1, setQuery1] = useState('');
  const [query2, setQuery2] = useState('');
  const [normalized1, setNormalized1] = useState('');
  const [normalized2, setNormalized2] = useState('');
  const [error1, setError1] = useState(null);
  const [error2, setError2] = useState(null);
  const [isEquivalent, setIsEquivalent] = useState(null);
  const [database, setDatabase] = useState('mysql');
  const [copySuccess, setCopySuccess] = useState({ 1: false, 2: false });
  const [fontSize, setFontSize] = useState(13);
  const [showOutput, setShowOutput] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sql-diff-theme');
      if (saved) return saved;
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    }
    return 'light';
  });

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sql-diff-theme', theme);
  }, [theme]);

  // Handle compare
  const handleCompare = useCallback(() => {
    const result = compareQueries(query1, query2, { database });
    setNormalized1(result.normalized1 || '');
    setNormalized2(result.normalized2 || '');
    setError1(result.error1);
    setError2(result.error2);
    setIsEquivalent(result.isEquivalent);
    setShowOutput(true);
  }, [query1, query2, database]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleCompare();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCompare]);

  const loadSamples = () => {
    setQuery1(SAMPLE_QUERY_1);
    setQuery2(SAMPLE_QUERY_2);
    setShowOutput(false);
    setIsEquivalent(null);
  };

  const clearAll = () => {
    setQuery1('');
    setQuery2('');
    setNormalized1('');
    setNormalized2('');
    setError1(null);
    setError2(null);
    setIsEquivalent(null);
    setShowOutput(false);
  };

  const handleCopy = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(prev => ({ ...prev, [id]: true }));
      setTimeout(() => setCopySuccess(prev => ({ ...prev, [id]: false })), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const zoomIn = () => {
    const idx = FONT_SIZES.indexOf(fontSize);
    if (idx < FONT_SIZES.length - 1) setFontSize(FONT_SIZES[idx + 1]);
  };

  const zoomOut = () => {
    const idx = FONT_SIZES.indexOf(fontSize);
    if (idx > 0) setFontSize(FONT_SIZES[idx - 1]);
  };

  // Diff highlighting
  const renderDiff = (text1, text2, which) => {
    if (!text1 && !text2) return null;
    const lines1 = (text1 || '').split('\n');
    const lines2 = (text2 || '').split('\n');
    const targetLines = which === 1 ? lines1 : lines2;
    const otherLines = which === 1 ? lines2 : lines1;

    return targetLines.map((line, i) => {
      const otherLine = otherLines[i];
      let className = 'diff-line';
      if (line !== otherLine) {
        className += which === 1 ? ' diff-line--remove' : ' diff-line--add';
      } else {
        className += ' diff-line--unchanged';
      }
      const highlighted = Prism.highlight(line || ' ', Prism.languages.sql, 'sql');
      return (
        <span
          key={i}
          className={className}
          dangerouslySetInnerHTML={{ __html: highlighted + '\n' }}
        />
      );
    });
  };

  return (
    <div className="app-minimal">
      {/* Floating Toolbar */}
      <div className="floating-toolbar">
        <div className="toolbar-group">
          <button
            className={`toolbar-btn ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
            title="Light mode"
          >
            ☀️
          </button>
          <button
            className={`toolbar-btn ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
            title="Dark mode"
          >
            🌙
          </button>
        </div>

        <div className="toolbar-group">
          <button className="toolbar-btn" onClick={zoomOut} title="Zoom out">
            <span style={{ fontSize: '14px' }}>A</span>
          </button>
          <span className="toolbar-label">{fontSize}px</span>
          <button className="toolbar-btn" onClick={zoomIn} title="Zoom in">
            <span style={{ fontSize: '18px' }}>A</span>
          </button>
        </div>

        <div className="toolbar-group">
          <select
            className="toolbar-select"
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
          >
            <option value="mysql">MySQL</option>
            <option value="postgresql">PostgreSQL</option>
            <option value="mariadb">MariaDB</option>
            <option value="transactsql">MSSQL</option>
          </select>
        </div>

        <div className="toolbar-group">
          <button className="toolbar-btn" onClick={loadSamples} title="Load samples">
            📝
          </button>
          <button className="toolbar-btn" onClick={clearAll} title="Clear all">
            🗑️
          </button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="editor-container">
        {/* Query 1 */}
        <div className={`editor-panel ${error1 ? 'has-error' : ''}`}>
          <div className="editor-label">Query 1</div>
          <SqlEditor
            value={query1}
            onChange={setQuery1}
            placeholder="Paste first SQL query..."
            error={error1}
            fontSize={fontSize}
          />
          {error1 && <div className="inline-error">{error1}</div>}
        </div>

        {/* Query 2 */}
        <div className={`editor-panel ${error2 ? 'has-error' : ''}`}>
          <div className="editor-label">Query 2</div>
          <SqlEditor
            value={query2}
            onChange={setQuery2}
            placeholder="Paste second SQL query..."
            error={error2}
            fontSize={fontSize}
          />
          {error2 && <div className="inline-error">{error2}</div>}
        </div>
      </div>

      {/* Compare Button */}
      <div className="compare-section">
        <button
          className="compare-btn"
          onClick={handleCompare}
          disabled={!query1.trim() || !query2.trim()}
        >
          ⚡ Compare
        </button>
        <span className="shortcut-hint">⌘+Enter</span>

        {isEquivalent !== null && (
          <span className={`result-indicator ${isEquivalent ? 'equivalent' : 'different'}`}>
            {isEquivalent ? '✓ Equivalent' : '✗ Different'}
          </span>
        )}
      </div>

      {/* Output Section (collapsible) */}
      {showOutput && (normalized1 || normalized2) && (
        <div className="output-container">
          <button
            className="output-toggle"
            onClick={() => setShowOutput(!showOutput)}
          >
            Normalized Output {showOutput ? '▼' : '▶'}
          </button>

          <div className="output-panels">
            <div className="output-panel">
              <div className="output-header">
                <span>Normalized 1</span>
                <button
                  className={`copy-btn ${copySuccess[1] ? 'copied' : ''}`}
                  onClick={() => handleCopy(normalized1, 1)}
                >
                  {copySuccess[1] ? '✓' : '📋'}
                </button>
              </div>
              {isEquivalent === false ? (
                <pre className="sql-highlight" style={{ fontSize: `${fontSize}px` }}>
                  <code className="language-sql">
                    {renderDiff(normalized1, normalized2, 1)}
                  </code>
                </pre>
              ) : (
                <SqlHighlight code={normalized1} fontSize={fontSize} />
              )}
            </div>

            <div className="output-panel">
              <div className="output-header">
                <span>Normalized 2</span>
                <button
                  className={`copy-btn ${copySuccess[2] ? 'copied' : ''}`}
                  onClick={() => handleCopy(normalized2, 2)}
                >
                  {copySuccess[2] ? '✓' : '📋'}
                </button>
              </div>
              {isEquivalent === false ? (
                <pre className="sql-highlight" style={{ fontSize: `${fontSize}px` }}>
                  <code className="language-sql">
                    {renderDiff(normalized1, normalized2, 2)}
                  </code>
                </pre>
              ) : (
                <SqlHighlight code={normalized2} fontSize={fontSize} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
