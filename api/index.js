const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// פונקציית עזר לפענוח קובץ ההגדרות מהשלוחה (פורמט קל למנהל המערכת)
function parseChapters(fileContent, targetFile) {
    if (!fileContent) return [];
    
    const lines = fileContent.split(/\r?\n/);
    const chapters = [];
    let currentFile = null;

    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith(';')) continue; // דילוג על שורות ריקות או הערות

        // זיהוי בלוק של קובץ שמע, למשל [031] או [001.wav]
        if (line.startsWith('[') && line.endsWith(']')) {
            currentFile = line.slice(1, -1).trim();
            continue;
        }

        // אם הגענו לשורת הגדרת זמן והקובץ מתאים לקובץ שמושמע כעת
        if (currentFile && (currentFile === targetFile || `${currentFile}.wav` === targetFile || currentFile === targetFile.replace('.wav', ''))) {
            const parts = line.split('=');
            if (parts.length === 2) {
                const seconds = parseInt(parts[0].trim(), 10);
                const title = parts[1].trim();
                if (!isNaN(seconds)) {
                    chapters.push({ seconds, title });
                }
            }
        }
    }
    // מיון הזמנים מההתחלה לסוף ליתר ביטחון
    return chapters.sort((a, b) => a.seconds - b.seconds);
}

app.all('/api', (req, res) => {
    // קבלת הפרמטרים מימות המשיח (תומך ב-GET וב-POST)
    const params = Object.keys(req.query).length > 0 ? req.query : req.body;
    
    const currentPosition = parseInt(params.Position || params.current_position || 0, 10); // מיקום נוכחי בשניות
    const currentFile = params.current_file || ""; // שם הקובץ המתנגן (למשל 031.wav)
    const fileContent = params.FileContent || ""; // תוכן קובץ ההגדרות שהתקבל מהשלוחה
    const selection = params.selection; // המקש שהוקש (למשל 6 או 4)

    // אם המשתמש רק נכנס לשלוחה או שאין קובץ מוגדר, ננגן כרגיל מתחילת הקובץ
    if (!selection || !currentFile) {
        return res.send("type=playfile\n");
    }

    // שליפת הפרקים הרלוונטיים לקובץ הנוכחי מתוך הקובץ שהמנהל יצר בשלוחה
    const chapters = parseChapters(fileContent, currentFile);

    if (chapters.length === 0) {
        // אם אין הגדרות פרקים לקובץ הזה, המערכת תמשיך לנגן כרגיל בלי לעשות כלום
        return res.send(`play_from_position=${currentPosition}\n`);
    }

    let targetPosition = currentPosition;

    if (selection === "6") { // מעבר לפרק הבא
        const nextChapter = chapters.find(c => c.seconds > currentPosition + 2); // פלוס 2 שניות לביטחון מפני כפילויות לחיצה
        if (nextChapter) {
            targetPosition = nextChapter.seconds;
        }
    } else if (selection === "4") { // חזרה לפרק הקודם
        // מחפשים את הפרק האחרון שקטן מהמיקום הנוכחי באופן משמעותי
        const pastChapters = chapters.filter(c => c.seconds < currentPosition - 3);
        if (pastChapters.length > 0) {
            targetPosition = pastChapters[pastChapters.length - 1].seconds;
        } else {
            targetPosition = 0; // אם אנחנו בפרק הראשון, נחזור לתחילת הקובץ
        }
    }

    // החזרת פקודה לימות המשיח לקפוץ ישירות לזמן המבוקש
    res.send(`play_from_position=${targetPosition}\n`);
});

module.exports = app;
