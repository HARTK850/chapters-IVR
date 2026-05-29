const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// פונקציית עזר שהופכת פורמט של MM:SS (דקות:שניות) למספר שניות כולל
function timeToSeconds(timeStr) {
    if (!timeStr.includes(':')) {
        // אם המנהל בכל זאת רשם רק מספר, נתייחס אליו כשניות
        const secs = parseInt(timeStr, 10);
        return isNaN(secs) ? 0 : secs;
    }
    const parts = timeStr.split(':');
    const minutes = parseInt(parts[0].trim(), 10) || 0;
    const seconds = parseInt(parts[1].trim(), 10) || 0;
    return (minutes * 60) + seconds;
}

// פונקציית עזר לפענוח קובץ ההגדרות מהשלוחה
function parseChapters(fileContent, targetFile) {
    if (!fileContent) return [];
    
    const lines = fileContent.split(/\r?\n/);
    const chapters = [];
    let currentFile = null;

    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith(';')) continue; // דילוג על שורות ריקות או הערות

        // זיהוי בלוק של קובץ שמע, למשל [031]
        if (line.startsWith('[') && line.endsWith(']')) {
            currentFile = line.slice(1, -1).trim();
            continue;
        }

        // אם הגענו לשורת הגדרת זמן והקובץ מתאים לקובץ שמושמע כעת
        if (currentFile && (currentFile === targetFile || `${currentFile}.wav` === targetFile || currentFile === targetFile.replace('.wav', ''))) {
            const parts = line.split('=');
            if (parts.length === 2) {
                const timeString = parts[0].trim(); // למשל "03:07"
                const title = parts[1].trim();
                const totalSeconds = timeToSeconds(timeString);
                
                chapters.push({ seconds: totalSeconds, title });
            }
        }
    }
    // מיון הזמנים מההתחלה לסוף
    return chapters.sort((a, b) => a.seconds - b.seconds);
}

app.all('/api', (req, res) => {
    // קבלת הפרמטרים מימות המשיח (תומך ב-GET וב-POST)
    const params = Object.keys(req.query).length > 0 ? req.query : req.body;
    
    // ימות המשיח שולחת בשלוחת השמעת קבצים את המיקום הנוכחי בשניות בפרמטר Position
    const currentPosition = parseInt(params.Position || 0, 10); 
    const currentFile = params.current_file || ""; // שם הקובץ המתנגן (למשל 031.wav)
    const fileContent = params.FileContent || ""; // תוכן קובץ ההגדרות מהשלוחה

    // זיהוי איזה מקש נלחץ (נשלח בפרמטר הבקשה בהתאם להגדרת המקש)
    const selection = params.selection; 

    // הגנה: אם אין קובץ מוגדר או שלא נשלח מקש, נגיד למערכת להמשיך לנגן כרגיל
    if (!currentFile || !selection) {
        return res.send(`play_from_position=${currentPosition}\n`);
    }

    // שליפת הפרקים הרלוונטיים ופענוחם
    const chapters = parseChapters(fileContent, currentFile);

    if (chapters.length === 0) {
        // אם אין הגדרות פרקים לקובץ הזה, נמשיך לנגן כרגיל מאותו המיקום
        return res.send(`play_from_position=${currentPosition}\n`);
    }

    let targetPosition = currentPosition;

    if (selection === "6") { // מעבר לפרק הבא
        const nextChapter = chapters.find(c => c.seconds > currentPosition + 2); // פלוס 2 שניות לביטחון
        if (nextChapter) {
            targetPosition = nextChapter.seconds;
        }
    } else if (selection === "4") { // חזרה לפרק הקודם
        const pastChapters = chapters.filter(c => c.seconds < currentPosition - 3);
        if (pastChapters.length > 0) {
            targetPosition = pastChapters[pastChapters.length - 1].seconds;
        } else {
            targetPosition = 0; // חזרה לתחילת הקובץ
        }
    }

    // פקודת ההחזרה הייעודית לשלוחת תפריט/השמעה: מעבר מידי למיקום החדש בקובץ
    res.send(`play_from_position=${targetPosition}\n`);
});

module.exports = app;
