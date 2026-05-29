const express = require('express');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


// =========================
// MM:SS -> seconds
// =========================
function timeToSeconds(timeStr) {

    if (!timeStr.includes(':')) {

        const secs = parseInt(timeStr, 10);

        return isNaN(secs)
            ? 0
            : secs;
    }

    const parts = timeStr.split(':');

    const minutes =
        parseInt(parts[0], 10) || 0;

    const seconds =
        parseInt(parts[1], 10) || 0;

    return (minutes * 60) + seconds;
}


// =========================
// Parse chapters
// =========================
function parseChapters(chaptersStr) {

    if (!chaptersStr) {

        console.log(
            "[Chapters] chapters ריק"
        );

        return [];
    }

    console.log(
        `[Chapters] RAW: ${chaptersStr}`
    );

    return chaptersStr
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
        .map(t => ({
            seconds:
                timeToSeconds(t)
        }))
        .sort(
            (a, b) =>
                a.seconds - b.seconds
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

    // קובץ נוכחי
    const currentFile =
        params.what || "";

    // מיקום נוכחי
    const playStopMs =
        parseInt(
            params.PlayStop || 0,
            10
        );

    const currentPosition =
        Math.floor(
            playStopMs / 1000
        );

    // מקש
    const selection =
        params.PressKey || "";

    // פרקים
    const chaptersStr =
        params.chapters || "";

    console.log(
        `[API] קובץ: ${currentFile}`
    );

    console.log(
        `[API] מיקום: ${currentPosition}`
    );

    console.log(
        `[API] מקש: ${selection}`
    );

    console.log(
        `[API] פרקים: ${chaptersStr}`
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
        parseChapters(chaptersStr);

    console.log(
        `[Chapters] נמצאו ${chapters.length} פרקים`
    );

    // אין פרקים
    if (chapters.length === 0) {

        return res.send(
            `play_from_position^${playStopMs || 1000}`
        );
    }

    let targetSeconds =
        currentPosition;

    // =========================
    // הבא
    // =========================
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

    // =========================
    // הקודם
    // =========================
    else if (selection === "4") {

        const prevChapters =
            chapters.filter(
                c =>
                    c.seconds <
                    currentPosition - 2
            );

        if (prevChapters.length > 0) {

            targetSeconds =
                prevChapters[
                    prevChapters.length - 1
                ].seconds;

            console.log(
                `[PREV] ${targetSeconds}`
            );

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
