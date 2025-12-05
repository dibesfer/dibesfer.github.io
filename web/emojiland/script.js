// Este script usa fetch + Node o navegador + soporte fetch
async function getAllEmojis() {

    /*
    origin url
    https://www.unicode.org/Public/emoji/16.0/emoji-test.txt
    */
    const url = '/web/emojiland/emoji-test.txt';
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Error al bajar emoji-test.txt');
    const txt = await resp.text();

    const emojis = [];
    for (let line of txt.split('\n')) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        // Las líneas válidas tienen forma:
        // “1F600                                      ; fully-qualified     # 😀 grinning face”
        const parts = line.split('#');
        if (parts.length < 2) continue;
        const afterHash = parts[1].trim();
        const match = afterHash.match(/^(\S+)/);
        if (match) {
            emojis.push(match[1]);
        }
    }

    return emojis.join('');
}


