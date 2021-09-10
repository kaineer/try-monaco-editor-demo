//

// Diff.diffChars()

const createEditorBySelector = (selector) => {
  const el = document.querySelector(selector);
  const opts = { value: '', language: 'javascript' };
  return monaco.editor.create(el, opts);
};

const editor = createEditorBySelector('.editor__left');
const rightEditor = createEditorBySelector('.editor__right');

const createBlocker = (editor) => {
  const widget = {
    domNode: null,
    getId() {
      return 'dom.blocker';
    },
    getDomNode() {
      if (!this.domNode) {
        this.domNode = document.createElement('div');
        const style = this.domNode.style;
        const br = editor.getDomNode().getBoundingClientRect();

        Object.assign(style, {
          top: '0px',
          left: '0px',
          width: br.width + 'px',
          height: br.height + 'px',
        });

        ['mousedown', 'mouseup', 'click', 'mousemove'].forEach((name) => {
          this.domNode.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
          }, true);
        });
      }

      return this.domNode;
    },
    getPosition() {
      return {
        position: {
          lineNumber: 0,
          column: 0
        },
        preference: [
          monaco.editor.ContentWidgetPositionPreference.ABOVE,
          monaco.editor.ContentWidgetPositionPreference.BELOW
        ]
      }
    }
  };

  return widget;
};

const runDemoInEditor = async (editor, opts = {}, fn) => {
  if (typeof fn !== "function") {
    return;
  }

  const defaultInterval = opts.interval || 100;

  let selection = null;

  /**
   * Run fn after interval ms
   *
   * @param {number} interval - time in ms before next fn call
   * @param {function} fn - action to peform
   */
  const delay = async (interval, fn) => {
    return new Promise((resolve) => {
      setTimeout(async () => {
        await fn();
        resolve();
      }, interval);
    });
  };

  /**
   * Type one character
   *
   * @param {string} char - char to output
   */
  const typeOneChar = (char) => {
    const edit = {
      range: editor.getSelection(),
      text: char,
      forceMoveMarkers: true
    };

    editor.getModel().pushEditOperations(
      editor.getSelections(),
      [edit],
      () => null
    );

    selection = editor.getSelection();
  };

  /**
   * Type all characters from string
   *
   * @param {string} value - value to type
   * @param {number} interval - time in ms to pause between chars
   */
  const typeChars = async (value, interval = defaultInterval) => {
    if (value === "") {
      return;
    }

    typeOneChar(value[0]);

    await delay(
      interval,
      () => typeChars(value.slice(1), interval)
    );
  };

  const runInBlockingContext = async (fn) => {
    editor.focus();
    editor.updateOptions({readonly: true});
    const blocker = createBlocker(editor);
    editor.addOverlayWidget(blocker);
    const unsubscribe = editor.onDidBlurEditorText(() => {
      editor.focus();
    });

    await fn();

    unsubscribe.dispose();
    editor.removeOverlayWidget(blocker);
    editor.updateOptions({readOnly: false});
  };

  const getSelectionFromAction = (action, editor) => {
    if (typeof action.from === 'number') {
      const { from, to } = action;
      const model = editor.getModel();
      const start = model.getPositionAt(from);
      const end = model.getPositionAt(to);

      return {
        selectionStartLineNumber: start.lineNumber,
        selectionStartColumn: start.column,
        positionLineNumber: end.lineNumber,
        positionColumn: end.column
      };
    } else if (typeof action.position === "number") {
      const { position } = action;
      const model = editor.getModel();
      const start = model.getPositionAt(position);

      return {
        selectionStartLineNumber: start.lineNumber,
        selectionStartColumn: start.column,
        positionLineNumber: start.lineNumber,
        positionColumn: start.column
      };
    } else if (action.type === "position") {
      const { line, column } = action;

      return {
        selectionStartLineNumber: line,
        selectionStartColumn: column,
        positionLineNumber: line,
        positionColumn: column
      };
    } else {
      const { line, column, endLine, endColumn } = action;

      return {
        selectionStartLineNumber: line,
        selectionStartColumn: column,
        positionLineNumber: endLine,
        positionColumn: endColumn
      };
    }
  };

  const createEditorContext = () => {
    const actions = [];

    const at = (line, column) => {
      if (typeof column !== "number") {
        actions.push({type: 'position', position: line});
      } else {
        actions.push({type: 'position', line, column});
      }
      return context;
    };

    const insert = (text) => {
      actions.push({type: 'insert', text});
      return context;
    };

    const remove = (line, column, endLine, endColumn) => {
      if (typeof endLine === "undefined") {
        actions.push({type: 'remove', from: line, to: column});
      } else {
        actions.push({type: 'remove', line, column, endLine, endColumn});
      }
      return context;
    };

    const select = (line, column, endLine, endColumn) => {
      actions.push({type: 'select', line, column, endLine, endColumn});
      return context;
    };

    const run = async (editor) => {
      const select = (action) => {
        const selection = getSelectionFromAction(action, editor);
        editor.setSelection(selection);
      };

      const handlers = {
        position: select,
        select,
        remove(action) {
          select(action);
          typeOneChar("");
        },
        insert: async (action) => {
          const { text } = action;
          await typeChars(text);
        }
      };

      for (const action of actions) {
        const { type } = action;

        const handler = handlers[type];

        await handler(action);
      }
    };

    const context = {
      at,
      insert,
      remove,
      select,
      run
    };

    return context;
  };

  const ctx = createEditorContext();
  fn(ctx);
  await runInBlockingContext(async () => {
    await ctx.run(editor);
  });
}

(async () => {
  await runDemoInEditor(editor, {interval: 10}, ({
    at,
    insert,
  }) => {
    at(1, 1);

    insert("// Let's do some magic.\n");
    insert("// Change code in left editor then press «Merge» button\n");
    insert("// It is down below editors.");
  });
})();

const button = document.querySelector('.button__merge');

button.addEventListener('click', (e) => {
  e.preventDefault();
  const left = editor.getValue();
  const right = rightEditor.getValue();
  const difference = Diff.diffChars(right, left);

  const selections = editor.getSelections();

  const fn = ({at, insert, remove}) => {
    let position = 0;
    at(0, 0);
    difference.forEach((diff, i) => {
      if (diff.added) {
        insert(diff.value);
        position += diff.count;
      } else if (diff.removed) {
        const from = position;
        const to = position + diff.count;
        remove(from, to);
      } else {
        position += diff.count;
        if (i < difference.length - 1) {
          at(position);
        }
      }
    });
  };

  const isSelectionEmpty = (selections) => {
    if (selections.length === 0) {
      return true;
    }

    const [s] = selections;

    return (
      selections.length === 1 &&
      s.selectionStartColumn === s.positionColumn &&
      s.selectionStartLineNumber === s.positionLineNumber
    );
  };

  (async () => {
    await runDemoInEditor(rightEditor, {interval: 33}, fn);

    if (!isSelectionEmpty(selections)) {
      rightEditor.setSelections(selections);
    }
  })();
});
