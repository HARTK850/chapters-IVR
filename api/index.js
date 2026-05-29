const express = require('express');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


// =========================
// MM:SS -> Seconds
// =========================
function timeToSeconds(timeStr) {

    if (!timeStr) {
        return 0;
    }

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
// Extract chapters
// =========================
function extractChapters(params) {

    const chapterKeys = Object.keys(params)
        .filter(key =>
            /^\d{2}:\d{2}$/.test(key)
        );

    console.log(
        "[Chapters] Keys:",
        chapterKeys
    );

    return chapterKeys
        .map(time => ({
            raw: time,
            seconds: timeToSeconds(time)
        }))
        .sort(
            (a, b) =>
                a.seconds - b.seconds
        );
}


// =========================
// Send Yemot response
// =========================
function sendYemotResponse(
    res,
    positionMs
) {

    const responseText =
`play_from_position=${positionMs}
response=ok
`;

    console.log(
        `[Yemot Response]\n${responseText}`
    );

    res.set(
        'Content-Type',
        'text/plain'
    );

    return res
        .status(200)
        .send(responseText);
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

    // Current file
    const currentFile =
        params.what || "";

    // Current position
    const playStopMs =
        parseInt(
            params.PlayStop || 0,
            10
        );

    const currentPosition =
        Math.floor(
            playStopMs / 1000
        );

    // Key
    const selection =
        params.PressKey || "";

    console.log(
        `[API] File: ${currentFile}`
    );

    console.log(
        `[API] Position: ${currentPosition}`
    );

    console.log(
        `[API] Key: ${selection}`
    );

    // Protection
    if (
        !currentFile ||
        !selection
    ) {

        return sendYemotResponse(
            res,
            playStopMs || 1000
        );
    }

    // Chapters
    const chapters =
        extractChapters(params);

    console.log(
        `[Chapters] Count: ${chapters.length}`
    );

    console.log(
        `[Chapters] Data:`,
        chapters
    );

    // No chapters
    if (chapters.length === 0) {

        return sendYemotResponse(
            res,
            playStopMs || 1000
        );
    }

    let targetSeconds =
        currentPosition;

    // NEXT
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

    // PREVIOUS
    else if (selection === "4") {

        const previousChapters =
            chapters.filter(
                c =>
                    c.seconds <
                    currentPosition - 2
            );

        if (
            previousChapters.length > 0
        ) {

            targetSeconds =
                previousChapters[
                    previousChapters.length - 1
                ].seconds;

            console.log(
                `[PREV] ${targetSeconds}`
            );

        } else {

            targetSeconds = 0;
        }
    }

    // milliseconds
    const targetMs =
        targetSeconds * 1000;

    console.log(
        `[FINAL POSITION] ${targetMs}`
    );

    return sendYemotResponse(
        res,
        targetMs
    );
});

module.exports = app;
