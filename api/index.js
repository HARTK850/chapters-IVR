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

    // אם זה כבר מספר
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
// שליפת פרקים מתוך params
// =========================
function extractChapters(params) {

    // ימות שולח:
    // "00:00": ""
    // "00:27": ""
    // לכן מחפשים מפתחות בפורמט זמן

    const chapterKeys = Object.keys(params)
        .filter(key =>
            /^\d{2}:\d{2}$/.test(key)
        );

    console.log(
        "[Chapters] Keys:",
        chapterKeys
    );

    const chapters = chapterKeys
        .map(time => ({
            raw: time,
            seconds: timeToSeconds(time)
        }))
        .sort(
            (a, b) =>
                a.seconds - b.seconds
        );

    return chapters;
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

    // =========================
    // קובץ נוכחי
    // =========================
    const currentFile =
        params.what || "";

    // =========================
    // מיקום נוכחי
    // =========================
    const playStopMs =
        parseInt(
            params.PlayStop || 0,
            10
        );

    const currentPosition =
        Math.floor(
            playStopMs / 1000
        );

    // =========================
    // מקש שנלחץ
    // =========================
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

    // =========================
    // הגנה בסיסית
    // =========================
    if (
        !currentFile ||
        !selection
    ) {

        console.log(
            "[Protection] Missing required params"
        );

        return res.send(
            `play_from_position^${playStopMs || 1000}`
        );
    }

    // =========================
    // שליפת פרקים
    // =========================
    const chapters =
        extractChapters(params);

    console.log(
        `[Chapters] Count: ${chapters.length}`
    );

    console.log(
        `[Chapters] Data:`,
        chapters
    );

    // =========================
    // אם אין פרקים
    // =========================
    if (chapters.length === 0) {

        console.log(
            "[Protection] No chapters found"
        );

        return res.send(
            `play_from_position^${playStopMs || 1000}`
        );
    }

    // =========================
    // ברירת מחדל
    // =========================
    let targetSeconds =
        currentPosition;

    // =========================
    // פרק הבא
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
                `[NEXT] Jumping to ${targetSeconds}`
            );

        } else {

            console.log(
                "[NEXT] No next chapter"
            );
        }
    }

    // =========================
    // פרק קודם
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
                `[PREV] Jumping to ${targetSeconds}`
            );

        } else {

            targetSeconds = 0;

            console.log(
                "[PREV] Returning to start"
            );
        }
    }

    // =========================
    // המרה למילישניות
    // =========================
    const targetMs =
        targetSeconds * 1000;

    console.log(
        `[RESPONSE] play_from_position^${targetMs}`
    );

    // =========================
    // תשובה לימות
    // =========================
    return res.send(
        `play_from_position^${targetMs}`
    );
});

module.exports = app;
