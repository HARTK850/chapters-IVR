const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// המרת פורמט MM:SS לשניות
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
function parseChapters(rawFileContent, targetFile) {
    if (!rawFileContent) {
        console.log("[Chapters Debug] שגיאה: פרמטר FileContent ריק או לא הגיע מהשלוחה!");
        return [];
    }
    
    let fileContent = rawFileContent;
    
    // פיענוח במידה והטקסט הגיע מקודד (URL Encoded) מימות המשיח
    if (rawFileContent.includes('%') || rawFileContent.includes('+')) {
        try {
            fileContent = decodeURIComponent(rawFileContent.replace(/\+/g, ' '));
        } catch (e) {
            console.log("[Chapters Debug] שגיאה בפיענוח decodeURIComponent, מנסה לעבוד עם הטקסט הגולמי");
        }
    }

    // ניקוי נתיב הקובץ (למשל ivr2:/4/000.wav יהפוך ל-000)
    const cleanTarget = targetFile.replace(/\\/g, '/').split('/').pop().replace('.wav', '').trim();
    console.log(`[Chapters Debug] מחפש התאמה לקובץ נקי: "${cleanTarget}"`);
    console.log(`[Chapters Debug] תוכן הקובץ המפוענח שנקרא:\n${fileContent}`);

    const lines = fileContent.split(/\r?\n/);
    const chapters = [];
    let currentFile = null;

    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith(';')) continue;

        // זיהוי תחילת בלוק קובץ [000]
        if (line.startsWith('[') && line.endsWith(']')) {
            currentFile = line.slice(1, -1).trim();
            continue;
        }

        // אם אנחנו בבלוק המתאים, נשלוף את זמני הפרקים
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
    // איחוד כל הפרמטרים מכל סוגי הבקשות (Query ו-Body) לקבלת תאימות מלאה
    const params = { ...req.query, ...req.body };
    
    const playStopMs = parseInt(params.PlayStop || 0, 10);
    const currentPosition = Math.floor(playStopMs / 1000); // המרה לשניות
    const currentFile = params.what || ""; 
    const selection = params.PressKey || ""; 
    
    // קבלת תוכן הקובץ (תומך באותיות קטנות וגדולות)
    const fileContent = params.FileContent || params.filecontent || ""; 

    console.log(`[API Request] קובץ: ${currentFile}, מיקום בשניות: ${currentPosition}, מקש: ${selection}`);

    if (!currentFile || !selection) {
        return res.send(`play_from_position=${playStopMs}\n`);
    }

    const chapters = parseChapters(fileContent, currentFile);
    console.log(`[Chapters Debug] סך הכל נמצאו ${chapters.length} פרקים תואמים עבור קובץ זה.`, chapters);

    let targetPositionSeconds = currentPosition;

    if (chapters.length > 0) {
        if (selection === "6") { // מעבר לפרק הבא
            const nextChapter = chapters.find(c => c.seconds > currentPosition + 1);
            if (nextChapter) {
                targetPositionSeconds = nextChapter.seconds;
                console.log(`[Navigation] מבצע מעבר לפרק הבא בשנייה: ${targetPositionSeconds}`);
            } else {
                console.log(`[Navigation] לא נמצא פרק הבא בקובץ.`);
            }
        } else if (selection === "4") { // חזרה לפרק הקודם
            const pastChapters = chapters.filter(c => c.seconds < currentPosition - 2);
            if (pastChapters.length > 0) {
                targetPositionSeconds = pastChapters[pastChapters.length - 1].seconds;
                console.log(`[Navigation] מבצע חזרה לפרק הקודם בשנייה: ${targetPositionSeconds}`);
            } else {
                targetPositionSeconds = 0;
                console.log(`[Navigation] אין פרק קודם, חוזר לתחילת השיר.`);
            }
        }
    } else {
        // הגנה קריטית: אם לא נמצאו פרקים (או שהקובץ לא הגיע), נחזיר את המיקום הנוכחי
        // בשניות כפול 1000 מדויק, כדי למנוע מימות המשיח לקרוס או לזרוק לתפריט הראשי!
        const safeMs = currentPosition * 1000 || playStopMs || 1000;
        console.log(`[Protection] לא נמצאו פרקים, מחזיר מיקום בטוח כדי למנוע ניתוק/חזרה לתפריט: ${safeMs}`);
        return res.send(`play_from_position=${safeMs}\n`);
    }

    const targetPositionMs = targetPositionSeconds * 1000;
    res.send(`play_from_position=${targetPositionMs}\n`);
});

module.exports = app;
