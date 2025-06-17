# Clara Rules Variable Highlighting

A VS Code extension that provides syntax highlighting for Clara Rules logic variables in Clojure files.

## Features

- **Variable Highlighting**: Automatically highlights variables starting with `?` (e.g., `?person`, `?name`, `?age`) with distinct font colors
- **Defrule Scope-Aware**: Variables are highlighted with consistent colors within entire `defrule` forms (supports prefixes like `er/defrule`, `r/defrule`, etc.)
- **Font Color Highlighting**: Changes the font color rather than background highlighting for better readability
- **clj-kondo Integration**: Automatically add/remove `#_{:clj-kondo/ignore [:unresolved-symbol]}` comments for defrule definitions
- **Configurable Colors**: Customize the color palette used for highlighting
- **Clojure Support**: Works with `.clj`, `.cljs`, and `.cljc` files

## How It Works

The extension analyzes Clojure code to identify:
1. `defrule` forms (with any prefix like `er/`, `r/`, etc.)
2. Logic variables within each defrule form (tokens starting with `?`)
3. Applies consistent font coloring to the same variable within its defrule scope

For example, in this Clara Rules code:
```clojure
(er/defrule sample-rule
  [?person [:person/name ?name]]
  [?person [:person/age ?age]]
  =>
  (println ?name ?age))
```

- All instances of `?person` within this defrule will have the same font color
- All instances of `?name` will have the same font color (different from `?person`)
- All instances of `?age` will have the same font color (different from both `?person` and `?name`)
- Variables in other defrule forms will use different colors

## Configuration

You can customize the extension through VS Code settings:

```json
{
  "claraHighlighting.enabled": true,
  "claraHighlighting.autoAddIgnoreComments": false,
  "claraHighlighting.colors": [
    "#2E86C1",
    "#28B463", 
    "#F39C12",
    "#8E44AD",
    "#E67E22",
    "#16A085",
    "#C0392B",
    "#D68910",
    "#7D3C98",
    "#138D75",
    "#B7950B",
    "#A93226"
  ]
}
```

## clj-kondo Integration

### **Best Solution: Global Configuration (Recommended)**
Run the command: `Ctrl+Shift+P` → **"Setup clj-kondo Config for Clara Rules"**

This creates a `.clj-kondo/config.edn` file that tells clj-kondo how to understand Clara Rules macros. **No more ignore comments needed!**

### **Alternative: Automatic Ignore Comments**
If you prefer using ignore comments, you can set:
```json
{
  "claraHighlighting.autoAddIgnoreComments": "onSave"  // or "onType" or "disabled"
}
```

- **"onSave"**: Adds ignore comments when you save the file
- **"onType"**: Adds ignore comments as you type (with 1-second delay)
- **"disabled"**: Manual only

### Settings

- `claraHighlighting.enabled`: Enable/disable the extension (default: `true`)
- `claraHighlighting.autoAddIgnoreComments`: When to add ignore comments - "disabled", "onSave", or "onType" (default: `"disabled"`)
- `claraHighlighting.colors`: Array of colors to cycle through for variable highlighting

## Commands

- **Setup clj-kondo Config for Clara Rules**: `Ctrl+Shift+P` → "Setup clj-kondo Config for Clara Rules" ⭐ **Recommended**
- **Add clj-kondo Ignore Comments to Defrules**: `Ctrl+Shift+P` → "Add clj-kondo Ignore Comments to Defrules"
- **Remove clj-kondo Ignore Comments from Defrules**: `Ctrl+Shift+P` → "Remove clj-kondo Ignore Comments from Defrules"
- **Debug Clara Highlighting**: `Ctrl+Shift+P` → "Debug Clara Highlighting" (for troubleshooting)

## Screenshots

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Clara Rules Variable Highlighting"
4. Click Install

## Development

To work on this extension:

1. Clone the repository
2. Run `npm install` to install dependencies
3. Press F5 to launch the Extension Development Host
4. Open a Clojure file to see the highlighting in action

## Requirements

- VS Code 1.74.0 or higher
- Clojure files (`.clj`, `.cljs`, `.cljc`)

## Release Notes

### 0.0.1

- Initial release
- Basic variable highlighting for Clara Rules
- Configurable color palette
- Scope-aware highlighting

## Contributing

Issues and pull requests welcome on [GitHub](https://github.com/your-repo/clara-highlighting).

## License

MIT
