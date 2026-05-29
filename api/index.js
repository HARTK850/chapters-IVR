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
// Yemot response
// =========================
function sendYemotResponse(
    res,
    positionMs
) {

    const responseText =
        `play_from_position^${positionMs}\r\n`;

    console.log(
        `[Yemot Response Raw]`,
        JSON.stringify(responseText)
    );

    res.writeHead(200, {
        'Content-Type':
            'text/plain; charset=utf-8',
        'Content-Length':
            Buffer.byteLength(responseText)
    });

    return res.end(responseText);
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

    // Pressed key
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

        console.log(
            "[Protection] Missing params"
        );

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

        console.log(
            "[Protection] No chapters"
        );

        return sendYemotResponse(
            res,
            playStopMs || 1000
        );
    }

    // Default target
    let targetSeconds =
        currentPosition;

    // =========================
    // Next chapter
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
    // Previous chapter
    // =========================
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

            console.log(
                "[PREV] Start of file"
            );
        }
    }

    // Milliseconds
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
