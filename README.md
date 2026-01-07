# SQL Diff

A web-based tool for comparing SQL queries by their **semantic meaning**, not just syntax. It normalizes queries by resolving aliases, sorting conditions, and formatting output so you can easily identify if two queries are logically equivalent.

![SQL Diff Screenshot](https://raw.githubusercontent.com/YOUR_USERNAME/sql-diff/main/docs/screenshot.png)

## ✨ Features

- **Semantic Comparison** - Detects if two queries are logically equivalent regardless of:
  - Different table aliases (`o` vs `orders`)
  - Different column order in SELECT
  - Different WHERE condition order
  - Different JOIN order

- **SQL Normalization** - Automatically:
  - Resolves and removes table aliases
  - Sorts SELECT columns alphabetically
  - Sorts WHERE conditions consistently
  - Sorts JOIN clauses by type and table name
  - Preserves ORDER BY (affects results)

- **Syntax Highlighting** - Uses Prism.js for colorful SQL display

- **Diff View** - When queries differ, highlights the differences

- **Modern UI**
  - Light/Dark theme toggle
  - Font size zoom (10px - 20px)
  - Minimalist, focused layout
  - Keyboard shortcut: `⌘/Ctrl + Enter`

- **Multi-Dialect Support**
  - MySQL
  - PostgreSQL
  - MariaDB
  - SQL Server (T-SQL)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/sql-diff.git
cd sql-diff

# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173 in your browser.

### Build for Production

```bash
npm run build
npm run preview
```

## 📖 Usage

1. Paste your first SQL query in the left editor
2. Paste your second SQL query in the right editor
3. Click **Compare** or press `⌘/Ctrl + Enter`
4. See the result: **Equivalent** ✓ or **Different** ✗

### Example

**Query 1 (with aliases)**
```sql
SELECT o.id, o.amount AS order_amount, c.name
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.status = 'active' AND c.country = 'US'
```

**Query 2 (without aliases, different order)**
```sql
SELECT orders.id, customers.name, orders.amount AS order_amount
FROM orders
JOIN customers ON orders.customer_id = customers.id
WHERE customers.country = 'US' AND orders.status = 'active'
```

**Result:** ✓ Semantically Equivalent

## 🛠️ Tech Stack

- **Frontend:** React 19
- **Build Tool:** Vite
- **SQL Parsing:** node-sql-parser
- **Syntax Highlighting:** Prism.js
- **Styling:** Vanilla CSS with CSS Variables

## 📁 Project Structure

```
sql-diff/
├── src/
│   ├── components/
│   │   └── SqlEditor.jsx    # Highlighted SQL editor
│   ├── utils/
│   │   ├── sqlNormalizer.js # Main orchestration
│   │   ├── aliasResolver.js # Alias detection & resolution
│   │   ├── elementSorter.js # Sorting algorithms
│   │   └── sqlPrettifier.js # Multi-line formatting
│   ├── App.jsx              # Main application
│   ├── index.css            # Styling
│   └── main.jsx             # Entry point
├── index.html
├── package.json
└── vite.config.js
```

## ⚠️ Limitations

- Complex subqueries may not normalize perfectly
- Window functions sorting not fully supported
- CTEs (WITH clauses) have limited support
- Parser errors don't show exact line numbers

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [node-sql-parser](https://github.com/nicksheerin/node-sql-parser) - SQL parsing
- [Prism.js](https://prismjs.com/) - Syntax highlighting
