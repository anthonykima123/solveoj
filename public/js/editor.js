document.addEventListener('DOMContentLoaded', function () {
  const textarea = document.getElementById('code-editor');
  if (!textarea) return;

  const isReadonly = typeof readonlyMode !== 'undefined' && readonlyMode;
  const initLang = (typeof lang !== 'undefined' ? lang : 'cpp');
  const mode = initLang === 'python' ? 'python' : 'text/x-c++src';

  const TEMPLATES = {
    cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n\n    \n\n    return 0;\n}`,
    python: `import sys\ninput = sys.stdin.readline\n\n`,
    java: `import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        \n    }\n}`
  };

  window.codeEditor = CodeMirror.fromTextArea(textarea, {
    mode: mode,
    theme: 'dracula',
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false,
    autoCloseBrackets: true,
    matchBrackets: true,
    lineWrapping: false,
    readOnly: isReadonly,
    extraKeys: {
      'Tab': function (cm) {
        if (cm.somethingSelected()) cm.indentSelection('add');
        else cm.replaceSelection('    ', 'end');
      }
    }
  });

  if (!isReadonly && !textarea.value.trim()) {
    window.codeEditor.setValue(TEMPLATES[initLang] || '');
  }

  if (isReadonly) {
    document.querySelector('.CodeMirror').style.height = '350px';
  }
});
