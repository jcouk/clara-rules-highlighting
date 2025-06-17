import * as vscode from 'vscode';

interface VariableScope {
  variable: string;
  color: string;
  ranges: vscode.Range[];
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Clara Rules Variable Highlighting extension is now active!');

  // Add debug command
  const debugCommand = vscode.commands.registerCommand('claraHighlighting.debug', () => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'clojure') {
      debugHighlighting(editor);
    }
  });
  context.subscriptions.push(debugCommand);

  // Add test decoration command
  const testCommand = vscode.commands.registerCommand('claraHighlighting.test', () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      testDecoration(editor);
    }
  });
  context.subscriptions.push(testCommand);

  // Add ignore comments commands
  const addIgnoreCommand = vscode.commands.registerCommand('claraHighlighting.addIgnoreComments', () => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'clojure') {
      addIgnoreComments(editor);
    }
  });
  context.subscriptions.push(addIgnoreCommand);

  const removeIgnoreCommand = vscode.commands.registerCommand('claraHighlighting.removeIgnoreComments', () => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'clojure') {
      removeIgnoreComments(editor);
    }
  });
  context.subscriptions.push(removeIgnoreCommand);

  const setupCljKondoCommand = vscode.commands.registerCommand('claraHighlighting.setupCljKondo', () => {
    setupCljKondoConfig();
  });
  context.subscriptions.push(setupCljKondoCommand);

  const decorationTypes = new Map<string, vscode.TextEditorDecorationType>();
  const colors = [
    '#2E86C1', // Bright Blue
    '#28B463', // Emerald Green  
    '#F39C12', // Orange
    '#8E44AD', // Purple
    '#E67E22', // Carrot Orange
    '#16A085', // Teal
    '#C0392B', // Dark Red (only one red for important vars)
    '#D68910', // Golden Yellow
    '#7D3C98', // Deep Purple
    '#138D75', // Dark Teal
    '#B7950B', // Dark Gold
    '#A93226'  // Crimson
  ];

  function createDecorationType(color: string): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
      color: color,
      fontWeight: 'bold',
      backgroundColor: color + '20', // Very light background to help with visibility
      border: `1px solid ${color}80`, // Semi-transparent border
      textDecoration: `underline solid ${color}`,
      overviewRulerColor: color,
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });
  }

  function findDefruleBoundaries(document: vscode.TextDocument, text: string): { start: vscode.Position, end: vscode.Position }[] {
    const defruleForms: { start: vscode.Position, end: vscode.Position }[] = [];

    // Look for defrule forms with optional prefixes, avoiding strings and comments
    let offset = 0;
    let inString = false;
    let inComment = false;

    while (offset < text.length) {
      const char = text[offset];

      // Handle string literals
      if (char === '"' && (offset === 0 || text[offset - 1] !== '\\')) {
        inString = !inString;
      }

      // Handle comments
      if (char === ';' && !inString) {
        inComment = true;
      }

      if (char === '\n') {
        inComment = false;
      }

      // Look for opening paren followed by defrule
      if (char === '(' && !inString && !inComment) {
        const startPos = document.positionAt(offset);

        // Check if this is followed by defrule (with optional prefix)
        let checkOffset = offset + 1;

        // Skip whitespace
        while (checkOffset < text.length && /\s/.test(text[checkOffset])) {
          checkOffset++;
        }

        // Check for optional prefix and defrule
        const remainingText = text.substring(checkOffset);
        const defruleMatch = remainingText.match(/^(?:[a-zA-Z-_]+\/)?defrule\b/);

        if (defruleMatch) {
          // Find the matching closing paren for this defrule form
          let parenCount = 0;
          let formOffset = offset;

          while (formOffset < text.length) {
            const formChar = text[formOffset];
            if (formChar === '(') {
              parenCount++;
            } else if (formChar === ')') {
              parenCount--;
              if (parenCount === 0) {
                const endPos = document.positionAt(formOffset + 1);
                defruleForms.push({
                  start: startPos,
                  end: endPos
                });
                break;
              }
            }
            formOffset++;
          }
        }
      }

      offset++;
    }

    return defruleForms;
  }

  function findVariablesInScope(document: vscode.TextDocument, scopeStart: vscode.Position, scopeEnd: vscode.Position): Map<string, vscode.Range[]> {
    const variables = new Map<string, vscode.Range[]>();
    const scopeRange = new vscode.Range(scopeStart, scopeEnd);
    const text = document.getText(scopeRange);

    // Split into lines to handle comments properly
    const lines = text.split('\n');
    let currentOffset = 0;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      let inString = false;
      let inComment = false;

      for (let charIndex = 0; charIndex < line.length; charIndex++) {
        const char = line[charIndex];

        // Handle string literals
        if (char === '"' && (charIndex === 0 || line[charIndex - 1] !== '\\')) {
          inString = !inString;
          continue;
        }

        // Handle comments
        if (char === ';' && !inString) {
          inComment = true;
          break; // Skip rest of line
        }

        // Look for variables starting with ? (not in strings or comments)
        if (char === '?' && !inString && !inComment) {
          // Check if this is the start of a valid variable (must be word boundary before ?)
          const prevChar = charIndex > 0 ? line[charIndex - 1] : ' ';
          const isWordBoundary = /[\s\(\)\[\]\{\},]/.test(prevChar);

          if (isWordBoundary) {
            // Check if this is the start of a valid variable
            let varEnd = charIndex + 1;
            while (varEnd < line.length && /[a-zA-Z0-9-_]/.test(line[varEnd])) {
              varEnd++;
            }

            if (varEnd > charIndex + 1) { // Must have at least one character after ?
              // Check that variable ends at word boundary
              const nextChar = varEnd < line.length ? line[varEnd] : ' ';
              const endsAtBoundary = /[\s\(\)\[\]\{\},]/.test(nextChar);

              if (endsAtBoundary) {
                const variable = line.substring(charIndex, varEnd);
                const absoluteStart = document.offsetAt(scopeStart) + currentOffset + charIndex;
                const absoluteEnd = document.offsetAt(scopeStart) + currentOffset + varEnd;

                const startPos = document.positionAt(absoluteStart);
                const endPos = document.positionAt(absoluteEnd);
                const range = new vscode.Range(startPos, endPos);

                if (!variables.has(variable)) {
                  variables.set(variable, []);
                }
                variables.get(variable)!.push(range);
              }
            }
          }
        }
      }

      // Add line length + 1 for newline character
      currentOffset += line.length + 1;
    }

    return variables;
  }

  function updateDecorations(editor: vscode.TextEditor) {
    if (!editor || editor.document.languageId !== 'clojure') {
      return;
    }

    const config = vscode.workspace.getConfiguration('claraHighlighting');
    if (!config.get('enabled', true)) {
      return;
    }

    console.log('Clara: Updating decorations for', editor.document.fileName);
    const document = editor.document;
    const text = document.getText();

    // Clear existing decorations
    decorationTypes.forEach(decorationType => {
      editor.setDecorations(decorationType, []);
      decorationType.dispose();
    });
    decorationTypes.clear();

    // Find all defrule forms and their variables
    const forms: { start: vscode.Position, end: vscode.Position, variables: Map<string, vscode.Range[]> }[] = [];

    // Find all defrule forms in the document
    const defruleForms = findDefruleBoundaries(document, text);
    console.log('Clara: Found', defruleForms.length, 'defrule forms');

    // For each defrule form, find all variables within it
    defruleForms.forEach(boundaries => {
      const variables = findVariablesInScope(document, boundaries.start, boundaries.end);
      console.log('Clara: Variables in form:', Array.from(variables.keys()));
      if (variables.size > 0) {
        forms.push({
          start: boundaries.start,
          end: boundaries.end,
          variables: variables
        });
      }
    });

    // Apply decorations for each form
    forms.forEach((form, formIndex) => {
      const variableNames = Array.from(form.variables.keys());
      console.log(`Clara: Applying decorations for form ${formIndex + 1}, variables:`, variableNames);

      variableNames.forEach((variable, index) => {
        const color = colors[index % colors.length];
        const decorationType = createDecorationType(color);
        const decorationKey = `${variable}-${form.start.line}-${form.start.character}`;
        decorationTypes.set(decorationKey, decorationType);

        const ranges = form.variables.get(variable) || [];
        console.log(`Clara: Setting decoration for ${variable} with color ${color}, ${ranges.length} ranges`);
        editor.setDecorations(decorationType, ranges);

        // Log each range being decorated
        ranges.forEach((range, rangeIndex) => {
          const text = document.getText(range);
          console.log(`Clara: Range ${rangeIndex + 1}: line ${range.start.line}, chars ${range.start.character}-${range.end.character}, text: "${text}"`);
        });
      });
    });
  }

  function debugHighlighting(editor: vscode.TextEditor) {
    const document = editor.document;
    const text = document.getText();

    console.log('=== CLARA HIGHLIGHTING DEBUG ===');
    console.log('Document language:', document.languageId);
    console.log('Document length:', text.length);

    // Find all defrule forms
    const defruleForms = findDefruleBoundaries(document, text);
    console.log('Found defrule forms:', defruleForms.length);

    defruleForms.forEach((form, index) => {
      console.log(`\nDEFRULE FORM ${index + 1}:`);
      console.log('Start:', form.start.line, form.start.character);
      console.log('End:', form.end.line, form.end.character);

      const formText = document.getText(new vscode.Range(form.start, form.end));
      console.log('Form text preview:', formText.substring(0, 100) + '...');

      const variables = findVariablesInScope(document, form.start, form.end);
      console.log('Variables found:', variables.size);

      variables.forEach((ranges, variable) => {
        console.log(`  ${variable}: ${ranges.length} occurrences`);
        ranges.forEach((range, i) => {
          const varText = document.getText(range);
          console.log(`    ${i + 1}: line ${range.start.line}, chars ${range.start.character}-${range.end.character}, text: "${varText}"`);
        });
      });
    });

    vscode.window.showInformationMessage('Clara highlighting debug info logged to console (View -> Output -> select "Log (Extension Host)")');
  }

  function testDecoration(editor: vscode.TextEditor) {
    console.log('Clara: Testing basic decoration...');

    // Create a simple test decoration
    const testDecorationType = vscode.window.createTextEditorDecorationType({
      color: '#FF0000',
      fontWeight: 'bold',
      backgroundColor: 'yellow'
    });

    // Find the first occurrence of any text starting with ?
    const document = editor.document;
    const text = document.getText();
    const match = text.match(/\?[a-zA-Z][a-zA-Z0-9-_]*/);

    if (match) {
      const startPos = document.positionAt(match.index!);
      const endPos = document.positionAt(match.index! + match[0].length);
      const range = new vscode.Range(startPos, endPos);

      console.log('Clara: Applying test decoration to:', match[0], 'at', startPos.line, startPos.character);
      editor.setDecorations(testDecorationType, [range]);

      vscode.window.showInformationMessage(`Test decoration applied to "${match[0]}" - should be red text on yellow background`);
    } else {
      vscode.window.showInformationMessage('No ? variables found for test');
    }
  }

  function addIgnoreComments(editor: vscode.TextEditor) {
    const document = editor.document;
    const text = document.getText();

    console.log('Clara: Adding clj-kondo ignore comments to defrules...');

    // Find all defrule positions
    const defruleForms = findDefruleBoundaries(document, text);
    const edits: vscode.TextEdit[] = [];

    defruleForms.forEach(form => {
      const startLine = form.start.line;
      const lineText = document.lineAt(startLine).text;

      // Check if ignore comment is already present on the line above
      const prevLine = startLine > 0 ? document.lineAt(startLine - 1).text : '';
      const hasIgnoreComment = prevLine.includes('#_{:clj-kondo/ignore [:unresolved-symbol]}');

      if (!hasIgnoreComment) {
        // Get indentation of the defrule line
        const indent = lineText.match(/^(\s*)/)?.[1] || '';
        const ignoreComment = `${indent}#_{:clj-kondo/ignore [:unresolved-symbol]}\n`;

        // Insert ignore comment before the defrule
        const insertPosition = new vscode.Position(startLine, 0);
        edits.push(vscode.TextEdit.insert(insertPosition, ignoreComment));

        console.log(`Clara: Adding ignore comment at line ${startLine}`);
      }
    });

    if (edits.length > 0) {
      const workspaceEdit = new vscode.WorkspaceEdit();
      workspaceEdit.set(document.uri, edits);

      vscode.workspace.applyEdit(workspaceEdit).then(success => {
        if (success) {
          vscode.window.showInformationMessage(`Added clj-kondo ignore comments to ${edits.length} defrule(s)`);
        } else {
          vscode.window.showErrorMessage('Failed to add ignore comments');
        }
      });
    } else {
      vscode.window.showInformationMessage('All defrules already have ignore comments');
    }
  }

  function removeIgnoreComments(editor: vscode.TextEditor) {
    const document = editor.document;
    const text = document.getText();

    console.log('Clara: Removing clj-kondo ignore comments from defrules...');

    // Find all defrule positions
    const defruleForms = findDefruleBoundaries(document, text);
    const edits: vscode.TextEdit[] = [];

    defruleForms.forEach(form => {
      const startLine = form.start.line;

      // Check if ignore comment is present on the line above
      if (startLine > 0) {
        const prevLineIndex = startLine - 1;
        const prevLine = document.lineAt(prevLineIndex);
        const prevLineText = prevLine.text;

        if (prevLineText.includes('#_{:clj-kondo/ignore [:unresolved-symbol]}')) {
          // Remove the entire line including newline
          const range = new vscode.Range(
            new vscode.Position(prevLineIndex, 0),
            new vscode.Position(startLine, 0)
          );
          edits.push(vscode.TextEdit.delete(range));

          console.log(`Clara: Removing ignore comment at line ${prevLineIndex}`);
        }
      }
    });

    if (edits.length > 0) {
      const workspaceEdit = new vscode.WorkspaceEdit();
      workspaceEdit.set(document.uri, edits);

      vscode.workspace.applyEdit(workspaceEdit).then(success => {
        if (success) {
          vscode.window.showInformationMessage(`Removed clj-kondo ignore comments from ${edits.length} defrule(s)`);
        } else {
          vscode.window.showErrorMessage('Failed to remove ignore comments');
        }
      });
    } else {
      vscode.window.showInformationMessage('No ignore comments found to remove');
    }
  }

  function setupCljKondoConfig() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder found. Open a folder first.');
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cljKondoDir = `${workspaceRoot}/.clj-kondo`;
    const configPath = `${cljKondoDir}/config.edn`;

    // Create .clj-kondo directory if it doesn't exist
    const fs = require('fs');
    if (!fs.existsSync(cljKondoDir)) {
      fs.mkdirSync(cljKondoDir, { recursive: true });
    }

    // Clara Rules clj-kondo configuration
    const config = `{:lint-as {clara.rules/defrule {:ns clojure.core
                                   :name def}
           clara-eav.rules/defrule {:ns clojure.core
                                   :name def}
           clara.rules/defquery {:ns clojure.core
                                :name def}
           clara-eav.rules/defquery {:ns clojure.core
                                    :name def}}
 :linters {:unresolved-symbol {:exclude-patterns ["\\\\?.*" "^[a-z][a-z0-9-]*[a-z0-9]$"]
                               :exclude #{:eav/all <- -> => this _ acc/count}}
           :syntax {:exclude #{:unsupported-binding-form}}}}`;

    try {
      fs.writeFileSync(configPath, config);
      vscode.window.showInformationMessage(
        `Created clj-kondo config at ${configPath}. This will eliminate unresolved symbol warnings for logic variables (?vars), rule names (kebab-case), Clara operators (<-, ->, =>, this), and binding form warnings!`,
        'Open Config'
      ).then(selection => {
        if (selection === 'Open Config') {
          vscode.workspace.openTextDocument(configPath).then(doc => {
            vscode.window.showTextDocument(doc);
          });
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create clj-kondo config: ${error}`);
    }
  }

  // ...existing code...

  // Register event listeners
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    console.log('Clara: Initial editor found, updating decorations');
    updateDecorations(activeEditor);
  } else {
    console.log('Clara: No active editor on activation');
  }

  vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor | undefined) => {
    console.log('Clara: Active text editor changed');
    if (editor) {
      console.log('Clara: New editor language:', editor.document.languageId);
      updateDecorations(editor);
    }
  }, null, context.subscriptions);

  vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
    const editor = vscode.window.activeTextEditor;
    if (editor && event.document === editor.document) {
      updateDecorations(editor);

      // Auto-add ignore comments as you type if enabled
      if (event.document.languageId === 'clojure') {
        const config = vscode.workspace.getConfiguration('claraHighlighting');
        const mode = config.get<string>('autoAddIgnoreComments', 'disabled');
        if (mode === 'onType') {
          // Add a small delay to avoid adding comments while still typing
          setTimeout(() => {
            addIgnoreComments(editor);
          }, 1000);
        }
      }
    }
  }, null, context.subscriptions);

  vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
    if (event.affectsConfiguration('claraHighlighting')) {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        updateDecorations(editor);
      }
    }
  }, null, context.subscriptions);

  // Auto-add ignore comments on save if enabled
  vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    if (document.languageId === 'clojure') {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === document) {
        const config = vscode.workspace.getConfiguration('claraHighlighting');
        const mode = config.get<string>('autoAddIgnoreComments', 'disabled');
        if (mode === 'onSave') {
          addIgnoreComments(editor);
        }
      }
    }
  }, null, context.subscriptions);
}

export function deactivate() {
  // Clean up decorations
}
