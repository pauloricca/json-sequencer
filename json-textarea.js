document.addEventListener('DOMContentLoaded', function() {
    const textarea = document.getElementById('source-textarea');
    const lineNumbers = document.getElementById('source-line-numbers');

    textarea.addEventListener('input', updatetextAreaHeight, false);
    textarea.addEventListener('keyup', updatetextAreaHeight, false);
    textarea.addEventListener('input', updateLineNumbers, false);
    textarea.addEventListener('keyup', updateLineNumbers, false);

    textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;

            // Set textarea value to: text before caret + tab + text after caret
            this.value = this.value.substring(0, start) + '\t' + this.value.substring(end);

            // Put caret at right position again
            this.selectionStart = this.selectionEnd = start + 1;
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            const value = this.value;
            const before = value.substring(0, start);
            const after = value.substring(end);
            const lastLine = before.split('\n').pop();
            const indent = lastLine.match(/^\s*/)[0];
            let additionalIndent = '';

            // Check if the last character before the caret is an open curly bracket or square bracket
            if (before.trim().endsWith('{') || before.trim().endsWith('[')) {
                additionalIndent = '\t';
            }

            // Set textarea value to: text before caret + newline + indent + additional indent + text after caret
            this.value = before + '\n' + indent + additionalIndent + after;

            // Put caret at right position again
            this.selectionStart = this.selectionEnd = start + indent.length + additionalIndent.length + 1;
        } else if (e.key === '}' || e.key === ']') {
            const start = this.selectionStart;
            const before = this.value.substring(0, start);
            const lastLine = before.split('\n').pop();
            const indent = lastLine.match(/^\s*/)[0];

            if (lastLine.trim() === '') {
                e.preventDefault();
                const newIndent = indent.substring(1); // Remove one level of indentation

                // Set textarea value to: text before caret + new indent + closing bracket + text after caret
                this.value = before.substring(0, before.length - indent.length) + newIndent + e.key + this.value.substring(start);

                // Put caret at right position again
                this.selectionStart = this.selectionEnd = start - indent.length + newIndent.length + 1;
            }
        }
        updatetextAreaHeight();
        updateLineNumbers();
    });

    function updateLineNumbers() {
        const lines = textarea.value.split('\n').length;
        lineNumbers.innerHTML = Array(lines).fill(0).map((_, i) => i + 1).join('<br>');
    }

    function updatetextAreaHeight() {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight - 2 + 'px';
        lineNumbers.style.height = 'auto';
        lineNumbers.style.height = textarea.scrollHeight - 20 + 'px';
        textarea.scrollTo(0, 0);
    }
    
    updateLineNumbers();
    updatetextAreaHeight();
});