//
var el = document.querySelector("#container");
var opts = {
  value: '',
  language: 'javascript'
};

var editor = monaco.editor.create(el, opts);

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
    range: editor.getSelection(),
    text: char,
    forceMoveMarkers: true
  };
  editor.executeEdits(null, [edit]);
};

editor.focus();
(async () => {
  await typeChars('// * Adding some code\n\n', 50);
  await typeChars('const answer = 42;');

  editor.setPosition({lineNumber: 2, column: 1});
  await typeChars('// * Removing some code', 50);
  editor.setSelection({
    startColumn: 1,
    endColumn: 19,
    startLineNumber: 3,
    endLineNumber: 3
  });

  typeOneChar('');

  await typeChars('// * Setting selection\n\n// Select me!\n');
  editor.setSelection({
    startColumn: 1,
    endColumn: 14,
    startLineNumber: 5,
    endLineNumber: 5
  });
})();

