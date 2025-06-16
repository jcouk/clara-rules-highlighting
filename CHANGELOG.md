# Change Log

All notable changes to the "Clara Rules Variable Highlighting" extension will be documented in this file.

## [0.1.0]

- Added clj-kondo integration for defrule definitions
- New command: "Add clj-kondo Ignore Comments to Defrules"
- New command: "Remove clj-kondo Ignore Comments from Defrules"
- New setting: `claraHighlighting.autoAddIgnoreComments` for automatic ignore comment insertion on save
- Automatically adds `#_{:clj-kondo/ignore [:unresolved-symbol]}` comments before defrule definitions
- Preserves proper indentation when adding ignore comments

## [0.0.1]

- Initial release
- Highlight variables starting with `?` in Clojure files with font colors (not background)
- Defrule-specific scope awareness - entire `defrule` forms treated as single scope
- Support for prefixed defrule forms (e.g., `er/defrule`, `r/defrule`)
- Configurable color palette
- Support for .clj, .cljs, .cljc, and .edn files
- Proper handling of strings and comments to avoid false positives

## Planned Features

- [ ] Better nested form detection
- [ ] Configuration for variable pattern matching
- [ ] Integration with Clojure LSP for better symbol recognition
- [ ] Support for other Clojure logic programming libraries
