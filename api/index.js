const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// הפיכת MM:SS לשניות
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

// פענוח קובץ ה-ini
function parseChapters(fileContent, targetFile) {
    if (!fileContent) return [];
    
    // ניקוי שם קובץ מנתיב מלא (למשל ivr2:/4/000.wav יהפוך ל-000)
    const cleanTarget = targetFile.replace(/\\/g, '/').split('/').pop().replace('.wav', '').trim();

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
    
    // 1. קבלת המיקום הנוכחי מתוך פרמטר PlayStop (בימות המשיח זה מגיע באלפיות שנייה)
    const playStopMs = parseInt(params.PlayStop || 0, 10);
    const currentPosition = Math.floor(playStopMs / 1000); // המרה לשניות עגולות

    // 2. קבלת שם הקובץ מתוך פרמטר what
    const currentFile = params.what || ""; 

    // 3. קבלת המקש שנלחץ בפועל מתוך פרמטר PressKey
    const selection = params.PressKey || params.selection || ""; 

    // 4. קבלת תוכן קובץ ההגדרות
    const fileContent = params.FileContent || ""; 

    if (!currentFile || !selection) {
        return res.send(`play_from_position=${playStopMs}\n`);
    }

    const chapters = parseChapters(fileContent, currentFile);

    if (chapters.length === 0) {
        // אם לא נמצאו פרקים, נחזיר את המערכת להמשיך לנגן בדיוק מאותה נקודה (באלפיות שנייה)
        return res.send(`play_from_position=${playStopMs}\n`);
    }

    let targetPositionSeconds = currentPosition;

    if (selection === "6") { // מעבר לפרק הבא
        const nextChapter = chapters.find(c => c.seconds > currentPosition + 1);
        if (nextChapter) {
            targetPositionSeconds = nextChapter.seconds;
        }
    } else if (selection === "4") { // חזרה לפרק הקודם
        const pastChapters = chapters.filter(c => c.seconds < currentPosition - 2);
        if (pastChapters.length > 0) {
            targetPositionSeconds = pastChapters[pastChapters.length - 1].seconds;
        } else {
            targetPositionSeconds = 0;
        }
    }

    // המרה חזרה לאלפיות שנייה עבור פקודת play_from_position של ימות המשיח
    const targetPositionMs = targetPositionSeconds * 1000;

    // החזרת הפקודה הנכונה
    res.send(`play_from_position=${targetPositionMs}\n`);
});

module.exports = app;
