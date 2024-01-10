<script lang="ts">
    import { Label } from '@nativescript-community/ui-label';
    import { NativeViewElementNode } from 'svelte-native/dom';
    let textview: NativeViewElementNode<Label>;
    export let jsonText;
    let htmlStr;
    $: updateHtml(jsonText);

    const colors = {
        number: '#870cfe',
        string: '#83cc72',
        boolean: '#870cfe',
        null: '#870cfe',
        key: '#ff9f81'
    };

    function syntaxHighlight(json: string) {
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            let cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key';
                } else {
                    cls = 'string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean';
            } else if (/null/.test(match)) {
                cls = 'null';
            }
            return '<span style="color:' + colors[cls] + '">' + match + '</span>';
        });
    }

    function updateHtml(text) {
        htmlStr = syntaxHighlight(text);
    }
</script>

<label bind:this={textview} {...$$restProps} html={htmlStr} selectable={true} />
