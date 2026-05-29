const express = require('express');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


// =========================
// MM:SS -> Seconds
// =========================
function timeToSeconds(timeStr) {

    if (!timeStr.includes(':')) {

        const secs = parseInt(timeStr, 10);

        return isNaN(secs) ? 0 : secs;
    }

    const parts = timeStr.split(':');

    const minutes =
        parseInt(parts[0], 10) || 0;

    const seconds =
        parseInt(parts[1], 10) || 0;

    return (minutes * 60) + seconds;
}


// =========================
// Parse chapters.ini
// =========================
function parseChapters(
    rawFileContent,
    targetFile
) {

    if (!rawFileContent) {

        console.log(
            "[Chapters] FileContent ריק"
        );

        return [];
    }

    let fileContent = rawFileContent;

    try {

        fileContent = decodeURIComponent(
            rawFileContent.replace(/\+/g, ' ')
        );

    } catch (e) {}

    const cleanTarget = targetFile
        .replace(/\\/g, '/')
        .split('/')
        .pop()
        .replace('.wav', '')
        .trim();

    console.log(
        `[Chapters] מחפש עבור ${cleanTarget}`
    );

    console.log(fileContent);

    const lines =
        fileContent.split(/\r?\n/);

    const chapters = [];

    let currentBlock = null;

    for (let line of lines) {

        line = line.trim();

        if (
            !line ||
            line.startsWith(';')
        ) {
            continue;
        }

        // [000]
        if (
            line.startsWith('[') &&
            line.endsWith(']')
        ) {

            currentBlock = line
                .slice(1, -1)
                .trim();

            continue;
        }

        // בתוך הבלוק המתאים
        if (
            currentBlock === cleanTarget
        ) {

            const parts =
                line.split('=');

            if (parts.length === 2) {

                chapters.push({
                    seconds:
                        timeToSeconds(
                            parts[0].trim()
                        )
                });
            }
        }
    }

    return chapters.sort(
        (a, b) => a.seconds - b.seconds
    );
}


// =========================
// API
// =========================
app.all('/api', (req, res) => {

    const params = {
        ...req.query,
        ...req.body
    };

    console.log(
        "========== REQUEST =========="
    );

    console.log(params);

    console.log(
        "============================="
    );

    const currentFile =
        params.what || "";

    const selection =
        params.PressKey || "";

    const playStopMs =
        parseInt(
            params.PlayStop || 0,
            10
        );

    const currentPosition =
        Math.floor(
            playStopMs / 1000
        );

    const fileContent =
        params.FileContent ||
        "";

    console.log(
        `[API] קובץ: ${currentFile}`
    );

    console.log(
        `[API] מיקום: ${currentPosition}`
    );

    console.log(
        `[API] מקש: ${selection}`
    );

    // הגנה
    if (
        !currentFile ||
        !selection
    ) {

        return res.send(
            `play_from_position^${playStopMs || 1000}`
        );
    }

    // שליפת פרקים
    const chapters =
        parseChapters(
            fileContent,
            currentFile
        );

    console.log(
        `[Chapters] נמצאו ${chapters.length} פרקים`
    );

    // אם אין פרקים
    if (chapters.length === 0) {

        return res.send(
            `play_from_position^${playStopMs || 1000}`
        );
    }

    let targetSeconds =
        currentPosition;

    // הבא
    if (selection === "6") {

        const nextChapter =
            chapters.find(
                c =>
                    c.seconds >
                    currentPosition + 1
            );

        if (nextChapter) {

            targetSeconds =
                nextChapter.seconds;

            console.log(
                `[NEXT] ${targetSeconds}`
            );
        }
    }

    // הקודם
    else if (selection === "4") {

        const prev =
            chapters.filter(
                c =>
                    c.seconds <
                    currentPosition - 2
            );

        if (prev.length > 0) {

            targetSeconds =
                prev[
                    prev.length - 1
                ].seconds;

        } else {

            targetSeconds = 0;
        }
    }

    const targetMs =
        targetSeconds * 1000;

    console.log(
        `[RESPONSE] ${targetMs}`
    );

    return res.send(
        `play_from_position^${targetMs}`
    );
});

module.exports = app;
