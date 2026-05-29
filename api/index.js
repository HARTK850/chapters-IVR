const express = require('express');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


// =========================
// המרת זמן MM:SS לשניות
// =========================
function timeToSeconds(timeStr) {
    if (!timeStr.includes(':')) {
        const secs = parseInt(timeStr, 10);
        return isNaN(secs) ? 0 : secs;
    }

    const parts = timeStr.split(':');

    const minutes = parseInt(parts[0].trim(), 10) || 0;
    const seconds = parseInt(parts[1].trim(), 10) || 0;

    return (minutes * 60) + seconds;
}


// =========================
// פענוח קובץ chapters.ini
// =========================
function parseChapters(rawFileContent, targetFile) {

    if (!rawFileContent) {
        console.log("[Chapters Debug] FileContent ריק");
        return [];
    }

    let fileContent = rawFileContent;

    // ניסיון פענוח
    try {
        fileContent = decodeURIComponent(
            rawFileContent.replace(/\+/g, ' ')
        );
    } catch (e) {
        console.log("[Chapters Debug] decodeURIComponent נכשל");
    }

    // ניקוי שם קובץ
    const cleanTarget = targetFile
        .replace(/\\/g, '/')
        .split('/')
        .pop()
        .replace('.wav', '')
        .trim();

    console.log(`[Chapters Debug] מחפש פרקים עבור: ${cleanTarget}`);

    console.log("[Chapters Debug] תוכן chapters.ini:");
    console.log(fileContent);

    const lines = fileContent.split(/\r?\n/);

    const chapters = [];

    let currentFile = null;

    for (let line of lines) {

        line = line.trim();

        if (!line || line.startsWith(';')) {
            continue;
        }

        // זיהוי בלוק [000]
        if (line.startsWith('[') && line.endsWith(']')) {

            currentFile = line
                .slice(1, -1)
                .trim();

            continue;
        }

        // אם זה הבלוק המתאים
        if (currentFile === cleanTarget) {

            const parts = line.split('=');

            if (parts.length === 2) {

                const timeString = parts[0].trim();

                const totalSeconds = timeToSeconds(timeString);

                chapters.push({
                    seconds: totalSeconds
                });
            }
        }
    }

    return chapters.sort((a, b) => a.seconds - b.seconds);
}


// =========================
// API ראשי
// =========================
app.all('/api', (req, res) => {

    // איחוד כל הפרמטרים
    const params = {
        ...req.query,
        ...req.body
    };

    console.log("========== REQUEST ==========");
    console.log(params);
    console.log("=============================");

    // זמן נוכחי במילישניות
    const playStopMs = parseInt(params.PlayStop || 0, 10);

    // זמן נוכחי בשניות
    const currentPosition = Math.floor(playStopMs / 1000);

    // המקש שנלחץ
    const selection = params.PressKey || "";

    // תוכן קובץ chapters.ini
    const fileContent =
        params.FileContent ||
        params.filecontent ||
        "";

    // =========================
    // ניסיון למצוא את שם הקובץ
    // =========================
    const currentFile =
        params.what ||
        params.file ||
        params.File ||
        params.ApiFile ||
        params.FileName ||
        "";

    console.log(
        `[API Request] קובץ: ${currentFile}, מיקום: ${currentPosition}, מקש: ${selection}`
    );

    // הגנה בסיסית
    if (!selection) {

        console.log("[Protection] לא הגיע PressKey");

        return res.send(
            `play_from_position^${playStopMs || 1000}`
        );
    }

    // פענוח פרקים
    const chapters = parseChapters(
        fileContent,
        currentFile
    );

    console.log(
        `[Chapters Debug] נמצאו ${chapters.length} פרקים`,
        chapters
    );

    // ברירת מחדל - להישאר במקום
    let targetPositionSeconds = currentPosition;

    // =========================
    // אם נמצאו פרקים
    // =========================
    if (chapters.length > 0) {

        // מעבר לפרק הבא
        if (selection === "6") {

            const nextChapter = chapters.find(
                c => c.seconds > currentPosition + 1
            );

            if (nextChapter) {

                targetPositionSeconds = nextChapter.seconds;

                console.log(
                    `[Navigation] מעבר לפרק הבא: ${targetPositionSeconds}`
                );

            } else {

                console.log(
                    "[Navigation] אין פרק הבא"
                );
            }
        }

        // חזרה לפרק קודם
        else if (selection === "4") {

            const pastChapters = chapters.filter(
                c => c.seconds < currentPosition - 2
            );

            if (pastChapters.length > 0) {

                targetPositionSeconds =
                    pastChapters[pastChapters.length - 1].seconds;

                console.log(
                    `[Navigation] חזרה לפרק קודם: ${targetPositionSeconds}`
                );

            } else {

                targetPositionSeconds = 0;

                console.log(
                    "[Navigation] אין פרק קודם"
                );
            }
        }
    }

    // =========================
    // אם לא נמצאו פרקים
    // =========================
    else {

        console.log(
            "[Protection] לא נמצאו פרקים - נשאר במקום"
        );

        return res.send(
            `play_from_position^${playStopMs || 1000}`
        );
    }

    // המרה למילישניות
    const targetPositionMs =
        targetPositionSeconds * 1000;

    console.log(
        `[Response] play_from_position^${targetPositionMs}`
    );

    // חשוב מאוד:
    // בימות צריך ^
    // ולא =
    return res.send(
        `play_from_position^${targetPositionMs}`
    );
});

module.exports = app;
