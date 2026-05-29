const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// המרת פורמט MM:SS או מספר שניות נקי למספר
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

// פענוח קובץ ה-ini של הפרקים
function parseChapters(fileContent, targetFile) {
    if (!fileContent) return [];
    
    // ניקוי נתיב הקובץ (למשל ivr2:/4/000.wav יהפוך ל-000)
    const cleanTarget = targetFile.replace(/\\/g, '/').split('/').pop().replace('.wav', '').trim();
    console.log(`[Chapters Debug] מחפש התאמה עבור הקובץ הנקי: "${cleanTarget}"`);

    const lines = fileContent.split(/\r?\n/);
    const chapters = [];
    let currentFile = null;

    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith(';')) continue;

        if (line.startsWith('[') && line.endsWith(']')) {
            currentFile = line.slice(1, -1).trim();
            continue;
        }

        if (currentFile && currentFile === cleanTarget) {
            const parts = line.split('=');
            if (parts.length === 2) {
                const timeString = parts[0].trim();
                const totalSeconds = timeToSeconds(timeString);
                chapters.push({ seconds: totalSeconds });
            }
        }
    }
    return chapters.sort((a, b) => a.seconds - b.seconds);
}

app.all('/api', (req, res) => {
    const params = Object.keys(req.query).length > 0 ? req.query : req.body;
    
    // ימות המשיח שולחת את שם הקובץ בפרמטר what ואת המיקום ב-PlayStop (באלפיות שנייה)
    const playStopMs = parseInt(params.PlayStop || 0, 10);
    const currentPosition = Math.floor(playStopMs / 1000); // המרה לשניות עגולות
    const currentFile = params.what || ""; 
    const selection = params.PressKey || ""; 
    const fileContent = params.FileContent || ""; 

    console.log(`[API Request] קובץ: ${currentFile}, מיקום בשניות: ${currentPosition}, מקש: ${selection}`);

    if (!currentFile || !selection) {
        return res.send(`play_from_position=${playStopMs}\n`);
    }

    const chapters = parseChapters(fileContent, currentFile);
    console.log(`[Chapters Debug] נמצאו ${chapters.length} פרקים עבור קובץ זה.`, chapters);

    let targetPositionSeconds = currentPosition;

    if (chapters.length > 0) {
        if (selection === "6") { // מעבר לפרק הבא
            const nextChapter = chapters.find(c => c.seconds > currentPosition + 1);
            if (nextChapter) {
                targetPositionSeconds = nextChapter.seconds;
                console.log(`[Navigation] נמצא פרק הבא בשנייה: ${targetPositionSeconds}`);
            } else {
                console.log(`[Navigation] לא נמצא פרק הבא, נשארים במיקום הנוכחי.`);
            }
        } else if (selection === "4") { // חזרה לפרק הקודם
            const pastChapters = chapters.filter(c => c.seconds < currentPosition - 2);
            if (pastChapters.length > 0) {
                targetPositionSeconds = pastChapters[pastChapters.length - 1].seconds;
                console.log(`[Navigation] נמצא פרק קודם בשנייה: ${targetPositionSeconds}`);
            } else {
                targetPositionSeconds = 0;
                console.log(`[Navigation] אין פרק קודם, חוזרים לתחילת הקובץ.`);
            }
        }
    }

    const targetPositionMs = targetPositionSeconds * 1000;

    // פתרון בעיית החזרה לתפריט הראשי:
    // נחזיר פקודה משולבת שמכריחה את המערכת לרענן את השלוחה ולנגן מהמיקום המבוקש
    res.send(`play_from_position=${targetPositionMs}\n`);
});

module.exports = app;
