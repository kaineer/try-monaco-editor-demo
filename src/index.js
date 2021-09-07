//
var el = document.querySelector("#container");
var opts = {
  value: '',
  language: 'javascript'
};

var editor = monaco.editor.create(el, opts);

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
 * @param {string} value - value to type
 * @param {number} interval - time in ms to pause between chars
 */
const typeChars = async (value, interval = 100) => {
  if (value === "") {
    return;
  }

  typeOneChar(value[0]);
  await delay(
    interval,
    () => typeChars(value.slice(1), interval)
  );
};

const typeOneChar = (char) => {
  const edit = {
    range: selection || editor.getSelection(),
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

editor.focus();
(async () => {
  editor.updateOptions({readOnly: true});

  const blocker = createBlocker(editor);
  editor.addOverlayWidget(blocker);

  const unsubscribe = editor.onDidBlurEditorText(() => {
    editor.focus();
  });

  await typeChars('// * Adding some code\n\n', 50);
  await typeChars('const answer = 42;');

  editor.setPosition({lineNumber: 2, column: 1});
  selection = editor.getSelection();

  await typeChars('// * Removing some code', 50);

  editor.setSelection({
    startColumn: 1,
    endColumn: 19,
    startLineNumber: 3,
    endLineNumber: 3
  });
  selection = {
    lineNumber: 3,
    column: 1
  };

  typeOneChar('');

  await typeChars('// * Setting selection\n\n// Select me!\n');
  editor.setSelection({
    startColumn: 1,
    endColumn: 14,
    startLineNumber: 5,
    endLineNumber: 5
  });
  selection = {
    lineNumber: 5,
    column: 1
  };

  unsubscribe.dispose();

  editor.removeOverlayWidget(blocker);

  editor.updateOptions({readOnly: false});
})();

