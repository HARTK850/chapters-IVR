const express = require('express');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


// =========================
// המרת זמן לשניות
// =========================
function timeToSeconds(timeStr) {

    if (!timeStr.includes(':')) {

        const secs = parseInt(timeStr, 10);

        return isNaN(secs) ? 0 : secs;
    }

    const parts = timeStr.split(':');

    const minutes = parseInt(parts[0], 10) || 0;

    const seconds = parseInt(parts[1], 10) || 0;

    return (minutes * 60) + seconds;
}


// =========================
// פענוח chapters.ini
// =========================
function parseChapters(fileContent, targetFile) {

    if (!fileContent) {

        console.log("[Chapters] תוכן קובץ ריק");

        return [];
    }

    const cleanTarget = targetFile
        .replace(/\\/g, '/')
        .split('/')
        .pop()
        .replace('.wav', '')
        .trim();

    console.log(`[Chapters] מחפש עבור קובץ: ${cleanTarget}`);

    console.log("[Chapters] תוכן הקובץ:");
    console.log(fileContent);

    const lines = fileContent.split(/\r?\n/);

    const chapters = [];

    let currentFile = null;

    for (let line of lines) {

        line = line.trim();

        if (!line || line.startsWith(';')) {
            continue;
        }

        // [000]
        if (line.startsWith('[') && line.endsWith(']')) {

            currentFile = line
                .slice(1, -1)
                .trim();

            continue;
        }

        if (currentFile === cleanTarget) {

            const parts = line.split('=');

            if (parts.length === 2) {

                const seconds = timeToSeconds(parts[0].trim());

                chapters.push({
                    seconds
                });
            }
        }
    }

    return chapters.sort((a, b) => a.seconds - b.seconds);
}


// =========================
// API
// =========================
app.all('/api', (req, res) => {

    const params = {
        ...req.query,
        ...req.body
    };

    console.log("========== REQUEST ==========");
    console.log(params);
    console.log("=============================");

    // זמן נוכחי
    const playStopMs = parseInt(
        params.PlayStop || 0,
        10
    );

    const currentPosition = Math.floor(
        playStopMs / 1000
    );

    // מקש
    const selection = params.PressKey || "";

    // קובץ מנוגן
    const currentFile =
        params.what ||
        "";

    // תוכן chapters.ini
    const fileContent =
        params.ApiReadFile ||
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
    if (!selection || !currentFile) {

        console.log(
            "[Protection] חסר selection או currentFile"
        );

        return res.send(
            `play_from_position^${playStopMs || 1000}`
        );
    }

    // שליפת פרקים
    const chapters = parseChapters(
        fileContent,
        currentFile
    );

    console.log(
        `[Chapters] נמצאו ${chapters.length} פרקים`
    );

    let targetPositionSeconds = currentPosition;

    // =========================
    // הבא
    // =========================
    if (selection === "6") {

        const nextChapter = chapters.find(
            c => c.seconds > currentPosition + 1
        );

        if (nextChapter) {

            targetPositionSeconds =
                nextChapter.seconds;

            console.log(
                `[Navigation] הבא -> ${targetPositionSeconds}`
            );
        }
    }

    // =========================
    // הקודם
    // =========================
    else if (selection === "4") {

        const prevChapters = chapters.filter(
            c => c.seconds < currentPosition - 2
        );

        if (prevChapters.length > 0) {

            targetPositionSeconds =
                prevChapters[
                    prevChapters.length - 1
                ].seconds;

            console.log(
                `[Navigation] קודם -> ${targetPositionSeconds}`
            );

        } else {

            targetPositionSeconds = 0;
        }
    }

    const targetMs =
        targetPositionSeconds * 1000;

    console.log(
        `[Response] play_from_position^${targetMs}`
    );

    return res.send(
        `play_from_position^${targetMs}`
    );
});

module.exports = app;
