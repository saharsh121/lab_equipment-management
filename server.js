const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mysql = require('mysql2');

const app = express();
const PORT = 3000;

// -------------------- MIDDLEWARE --------------------
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // CSS, images
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

app.use(session({
    secret: 'mysecretkey',
    resave: false,
    saveUninitialized: true
}));

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));


// -------------------- DATABASE --------------------
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Saharsh@121',
    database: 'lab_management'
});

db.connect((err) => {
    if (err) console.log('DB connection failed:', err);
    else console.log('Connected to MySQL database!');
});

// -------------------- ROUTES --------------------

// Home page
app.get('/', (req, res) => {
    res.render('index', { successMessage: null });
});

// Student login page
app.get('/student-login', (req, res) => {
    res.render('student', { error: null });
});

// Admin login page
app.get('/admin-login', (req, res) => {
    res.render('admin', { error: null });
});

// -------------------- LOGIN POST ROUTES --------------------

// Student login POST
app.post('/student-login', (req, res) => {
    const { email, password } = req.body;
    db.query('SELECT * FROM students WHERE email = ? AND password = ?', [email, password], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            // Store student info in session
            req.session.user = {
                id: results[0].id,
                name: results[0].name,
                role: 'student'
            };
            res.redirect('/main-student');
        } else {
            res.render('student', { error: 'Invalid email or password' });
        }
    });
});

// Admin login POST
app.post('/admin-login', (req, res) => {
    const { email, password } = req.body;
    db.query('SELECT * FROM admins WHERE email = ? AND password = ?', [email, password], (err, results) => {
        if (err) throw err;
        if (results.length > 0) {
            req.session.user = { id: results[0].id, name: results[0].name, role: 'admin' };
            res.redirect('/main-admin');
        } else {
            res.render('admin', { error: 'Invalid email or password' });
        }
    });
});

// -------------------- DASHBOARDS --------------------

// Main Student Dashboard
app.get('/main-student', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.redirect('/student-login');
    res.render('main_student', { studentName: req.session.user.name });
});

// Main Admin Dashboard
app.get('/main-admin', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/admin-login');
    res.render('main_admin', { adminName: req.session.user.name });
});

// -------------------- PHYSICS LAB ROUTES --------------------
// GET Physics Lab Page
app.get('/physics-lab', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.redirect('/student-login');

    const studentId = req.session.user.id;
    const studentName = req.session.user.name;

    const equipmentQuery = "SELECT * FROM physics_lab WHERE quantity > 0";
    const recordsQuery = "SELECT * FROM physics_lab_records WHERE student_id = ? AND returned_at IS NULL";

    db.query(equipmentQuery, (err, equipment) => {
        if (err) throw err;
        db.query(recordsQuery, [studentId], (err2, records) => {
            if (err2) throw err2;
            res.render('student_physics', { equipment, records, studentId, studentName });
        });
    });
});
// POST Take Equipment
app.post('/take-physics-equipment', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') 
        return res.send("Session expired. Please log in again.");

    const studentId = req.session.user.id;
    const studentName = req.session.user.name;

    const { equipment_id, quantity, return_expected } = req.body;

    if (!equipment_id || !quantity || !return_expected) {
        return res.send("Please fill all fields.");
    }

    const qty = parseInt(quantity); // convert to number

    // Fetch equipment from DB
    db.query("SELECT * FROM physics_lab WHERE id = ?", [equipment_id], (err, results) => {
        if (err) throw err;

        if (results.length === 0) return res.send("Invalid equipment selected.");

        const availableQty = results[0].quantity;
        if (availableQty < qty) return res.send("Not enough quantity available.");

        const newQty = availableQty - qty;

        // Update physics_lab quantity
        db.query("UPDATE physics_lab SET quantity = ? WHERE id = ?", [newQty, equipment_id], (err2) => {
            if (err2) throw err2;

            // Insert record into physics_lab_records
            db.query(
                `INSERT INTO physics_lab_records 
                (student_id, student_name, equipment_id, equipment_name, quantity, issued_at, return_expected) 
                VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
                [studentId, studentName, equipment_id, results[0].equipment_name, qty, return_expected],
                (err3) => {
                    if (err3) throw err3;
                    console.log(`Equipment taken: ${results[0].equipment_name}, Quantity: ${qty}`);
                    res.redirect('/physics-lab');
                }
            );
        });
    });
});

// POST Return Equipment
app.post('/return-physics-equipment', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.send("Session expired. Please log in again.");

    const { record_id } = req.body;

    db.query("SELECT * FROM physics_lab_records WHERE id = ?", [record_id], (err, results) => {
        if (err) throw err;
        if (results.length === 0) return res.send("Record not found.");

        const equipment_id = results[0].equipment_id;
        const quantityReturned = results[0].quantity || 1;

        db.query("UPDATE physics_lab SET quantity = quantity + ? WHERE id = ?", [quantityReturned, equipment_id], (err2) => {
            if (err2) throw err2;

            db.query("UPDATE physics_lab_records SET returned_at = NOW() WHERE id = ?", [record_id], (err3) => {
                if (err3) throw err3;
                res.redirect('/physics-lab');
            });
        });
    });
});

// -------------------- CHEMISTRY LAB ROUTES --------------------

// GET Chemistry Lab Page
app.get('/chemistry-lab', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') 
        return res.redirect('/student-login');

    const studentId = req.session.user.id;
    const studentName = req.session.user.name;

    const equipmentQuery = "SELECT * FROM chemistry_lab WHERE quantity > 0";
    const recordsQuery = "SELECT * FROM chemistry_lab_records WHERE student_id = ? AND returned_at IS NULL";

    db.query(equipmentQuery, (err, equipment) => {
        if (err) throw err;
        db.query(recordsQuery, [studentId], (err2, records) => {
            if (err2) throw err2;
            res.render('student_chemistry', { equipment, records, studentId, studentName });
        });
    });
});


// POST Take Chemistry Equipment
app.post('/take-chemistry-equipment', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') 
        return res.send("Session expired. Please log in again.");

    const studentId = req.session.user.id;
    const studentName = req.session.user.name;
    const { equipment_id, quantity, return_expected } = req.body;

    if (!equipment_id || !quantity || !return_expected) return res.send("Please fill all fields.");

    const qty = parseInt(quantity);

    db.query("SELECT * FROM chemistry_lab WHERE id = ?", [equipment_id], (err, results) => {
        if (err) throw err;
        if (results.length === 0) return res.send("Invalid equipment selected.");

        const availableQty = results[0].quantity;
        if (availableQty < qty) return res.send("Not enough quantity available.");

        const newQty = availableQty - qty;

        db.query("UPDATE chemistry_lab SET quantity = ? WHERE id = ?", [newQty, equipment_id], (err2) => {
            if (err2) throw err2;

            db.query(
                `INSERT INTO chemistry_lab_records 
                (student_id, student_name, equipment_id, equipment_name, quantity, issued_at, return_expected) 
                VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
                [studentId, studentName, equipment_id, results[0].equipment_name, qty, return_expected],
                (err3) => {
                    if (err3) throw err3;
                    console.log(`Chemistry Equipment taken: ${results[0].equipment_name}, Quantity: ${qty}`);
                    res.redirect('/chemistry-lab');
                }
            );
        });
    });
});

// POST Return Chemistry Equipment
app.post('/return-chemistry-equipment', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.send("Session expired. Please log in again.");

    const { record_id } = req.body;

    db.query("SELECT * FROM chemistry_lab_records WHERE id = ?", [record_id], (err, results) => {
        if (err) throw err;
        if (results.length === 0) return res.send("Record not found.");

        const equipment_id = results[0].equipment_id;
        const quantityReturned = results[0].quantity || 1;

        db.query("UPDATE chemistry_lab SET quantity = quantity + ? WHERE id = ?", [quantityReturned, equipment_id], (err2) => {
            if (err2) throw err2;

            db.query("UPDATE chemistry_lab_records SET returned_at = NOW() WHERE id = ?", [record_id], (err3) => {
                if (err3) throw err3;
                res.redirect('/chemistry-lab');
            });
        });
    });
});


// -------------------- BIOLOGY LAB ROUTES --------------------

// GET Biology Lab Page
app.get('/biology-lab', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') 
        return res.redirect('/student-login');

    const studentId = req.session.user.id;
    const studentName = req.session.user.name;

    const equipmentQuery = "SELECT * FROM biology_lab WHERE quantity > 0";
    const recordsQuery = "SELECT * FROM biology_lab_records WHERE student_id = ? AND returned_at IS NULL";

    db.query(equipmentQuery, (err, equipment) => {
        if (err) throw err;
        db.query(recordsQuery, [studentId], (err2, records) => {
            if (err2) throw err2;
            res.render('student_biology', { equipment, records, studentId, studentName });
        });
    });
});

// POST Take Biology Equipment
app.post('/take-biology-equipment', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') 
        return res.send("Session expired. Please log in again.");

    const studentId = req.session.user.id;
    const studentName = req.session.user.name;
    const { equipment_id, quantity, return_expected } = req.body;

    if (!equipment_id || !quantity || !return_expected) return res.send("Please fill all fields.");

    const qty = parseInt(quantity);

    db.query("SELECT * FROM biology_lab WHERE id = ?", [equipment_id], (err, results) => {
        if (err) throw err;
        if (results.length === 0) return res.send("Invalid equipment selected.");

        const availableQty = results[0].quantity;
        if (availableQty < qty) return res.send("Not enough quantity available.");

        const newQty = availableQty - qty;

        db.query("UPDATE biology_lab SET quantity = ? WHERE id = ?", [newQty, equipment_id], (err2) => {
            if (err2) throw err2;

            db.query(
                `INSERT INTO biology_lab_records 
                (student_id, student_name, equipment_id, equipment_name, quantity, issued_at, return_expected) 
                VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
                [studentId, studentName, equipment_id, results[0].equipment_name, qty, return_expected],
                (err3) => {
                    if (err3) throw err3;
                    console.log(`Biology Equipment taken: ${results[0].equipment_name}, Quantity: ${qty}`);
                    res.redirect('/biology-lab');
                }
            );
        });
    });
});

// POST Return Biology Equipment
app.post('/return-biology-equipment', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') 
        return res.send("Session expired. Please log in again.");

    const { record_id } = req.body;

    db.query("SELECT * FROM biology_lab_records WHERE id = ?", [record_id], (err, results) => {
        if (err) throw err;
        if (results.length === 0) return res.send("Record not found.");

        const equipment_id = results[0].equipment_id;
        const quantityReturned = results[0].quantity || 1;

        db.query("UPDATE biology_lab SET quantity = quantity + ? WHERE id = ?", [quantityReturned, equipment_id], (err2) => {
            if (err2) throw err2;

            db.query("UPDATE biology_lab_records SET returned_at = NOW() WHERE id = ?", [record_id], (err3) => {
                if (err3) throw err3;
                res.redirect('/biology-lab');
            });
        });
    });
});

// -------------------- ELECTRONICS LAB ROUTES --------------------

// GET Electronics Lab Page
app.get('/electronics-lab', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') 
        return res.redirect('/student-login');

    const studentId = req.session.user.id;
    const studentName = req.session.user.name;

    const equipmentQuery = "SELECT * FROM electronics_lab WHERE quantity > 0";
    const recordsQuery = "SELECT * FROM electronics_lab_records WHERE student_id = ? AND returned_at IS NULL";

    db.query(equipmentQuery, (err, equipment) => {
        if (err) throw err;
        db.query(recordsQuery, [studentId], (err2, records) => {
            if (err2) throw err2;
            res.render('student_electronics', { equipment, records, studentId, studentName });
        });
    });
});

// POST Take Electronics Equipment
app.post('/take-electronics-equipment', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') 
        return res.send("Session expired. Please log in again.");

    const studentId = req.session.user.id;
    const studentName = req.session.user.name;
    const { equipment_id, quantity, return_expected } = req.body;

    if (!equipment_id || !quantity || !return_expected) return res.send("Please fill all fields.");

    const qty = parseInt(quantity);

    db.query("SELECT * FROM electronics_lab WHERE id = ?", [equipment_id], (err, results) => {
        if (err) throw err;
        if (results.length === 0) return res.send("Invalid equipment selected.");

        const availableQty = results[0].quantity;
        if (availableQty < qty) return res.send("Not enough quantity available.");

        const newQty = availableQty - qty;

        db.query("UPDATE electronics_lab SET quantity = ? WHERE id = ?", [newQty, equipment_id], (err2) => {
            if (err2) throw err2;

            db.query(
                `INSERT INTO electronics_lab_records 
                (student_id, student_name, equipment_id, equipment_name, quantity, issued_at, return_expected) 
                VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
                [studentId, studentName, equipment_id, results[0].equipment_name, qty, return_expected],
                (err3) => {
                    if (err3) throw err3;
                    console.log(`Electronics Equipment taken: ${results[0].equipment_name}, Quantity: ${qty}`);
                    res.redirect('/electronics-lab');
                }
            );
        });
    });
});

// POST Return Electronics Equipment
app.post('/return-electronics-equipment', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') 
        return res.send("Session expired. Please log in again.");

    const { record_id } = req.body;

    db.query("SELECT * FROM electronics_lab_records WHERE id = ?", [record_id], (err, results) => {
        if (err) throw err;
        if (results.length === 0) return res.send("Record not found.");

        const equipment_id = results[0].equipment_id;
        const quantityReturned = results[0].quantity || 1;

        db.query("UPDATE electronics_lab SET quantity = quantity + ? WHERE id = ?", [quantityReturned, equipment_id], (err2) => {
            if (err2) throw err2;

            db.query("UPDATE electronics_lab_records SET returned_at = NOW() WHERE id = ?", [record_id], (err3) => {
                if (err3) throw err3;
                res.redirect('/electronics-lab');
            });
        });
    });
});


// -------------------- FEEDBACK --------------------
app.post('/submit-feedback', (req, res) => {
    const { name, email, comment } = req.body;
    db.query('INSERT INTO feedback (name, email, comment) VALUES (?, ?, ?)', [name, email, comment], (err) => {
        if (err) return res.send('Error saving feedback.');
        res.render('index', { successMessage: 'Thank you for your feedback!' });
    });
});

// -------------------- ADMIN FEEDBACK --------------------
app.get('/admin/feedback', (req, res) => {
    // Query feedback table (columns: name, email, comment)
    const sql = "SELECT name, email, comment FROM feedback ORDER BY id DESC";
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.send("Error fetching feedback");
        }
        // Render the feedback page and pass the results
        res.render('feedback', { feedbacks: results });
    });
});


app.get('/admin/physics', (req, res) => {
    // Fetch equipment (assuming you have a physics_lab table for equipment list)
    db.query("SELECT * FROM physics_lab ORDER BY id ASC", (err, equipmentResults) => {
        if (err) throw err;

        // Fetch student records from physics_lab_records
        const sqlRecords = `
            SELECT id, student_id, student_name, equipment_id, equipment_name, issued_at, return_expected, returned_at
            FROM physics_lab_records
            ORDER BY issued_at DESC
        `;
        db.query(sqlRecords, (err2, studentRecords) => {
            if (err2) throw err2;

            res.render('admin_physics', { 
                equipment: equipmentResults, 
                studentsRecords: studentRecords 
            });
        });
    });
});


app.get('/admin/chemistry', (req, res) => {
    // Fetch equipment list from chemistry_lab table
    db.query("SELECT * FROM chemistry_lab ORDER BY id ASC", (err, equipmentResults) => {
        if (err) throw err;

        // Fetch student records from chemistry_lab_records
        const sqlRecords = `
            SELECT id, student_id, student_name, equipment_id, equipment_name, issued_at, return_expected, returned_at
            FROM chemistry_lab_records
            ORDER BY issued_at DESC
        `;
        db.query(sqlRecords, (err2, studentRecords) => {
            if (err2) throw err2;

            res.render('admin_chemistry', { 
                equipment: equipmentResults, 
                studentsRecords: studentRecords 
            });
        });
    });
});


app.get('/admin/biology', (req, res) => {
    // Fetch equipment list from biology_lab table
    db.query("SELECT * FROM biology_lab ORDER BY id ASC", (err, equipmentResults) => {
        if (err) throw err;

        // Fetch student records from biology_lab_records
        const sqlRecords = `
            SELECT id, student_id, student_name, equipment_id, equipment_name, issued_at, return_expected, returned_at
            FROM biology_lab_records
            ORDER BY issued_at DESC
        `;
        db.query(sqlRecords, (err2, studentRecords) => {
            if (err2) throw err2;

            res.render('admin_biology', { 
                equipment: equipmentResults, 
                studentsRecords: studentRecords 
            });
        });
    });
});


app.get('/admin/electronics', (req, res) => {
    // Fetch equipment list from electronics_lab table
    db.query("SELECT * FROM electronics_lab ORDER BY id ASC", (err, equipmentResults) => {
        if (err) throw err;

        // Fetch student records from electronics_lab_records
        const sqlRecords = `
            SELECT id, student_id, student_name, equipment_id, equipment_name, issued_at, return_expected, returned_at
            FROM electronics_lab_records
            ORDER BY issued_at DESC
        `;
        db.query(sqlRecords, (err2, studentRecords) => {
            if (err2) throw err2;

            res.render('admin_electronics', { 
                equipment: equipmentResults, 
                studentsRecords: studentRecords 
            });
        });
    });
});



app.get('/admin', (req, res) => {
    // Pass admin name if you want
    res.render('main_admin', { adminName: "Admin" });
});

app.get('/venue', (req, res) => {
    const sql = "SELECT * FROM venue ORDER BY id ASC";
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.render('venue', { venues: results });
    });
});

app.get('/student-home', (req, res) => {
    // You can pass the logged-in student's name if available
    const studentName = req.session ? req.session.studentName : "Student";
    res.render('main_student', { studentName });
});


app.get('/admin/venue', (req, res) => {
    const sql = "SELECT * FROM venue ORDER BY id ASC";
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.render('admin_venue', { venues: results });
    });
});

app.get('/admin-home', (req, res) => {
    // You can fetch admin info if needed
    const adminName = req.session.adminName || 'Admin';
    res.render('main_admin', { adminName });
});



// -------------------- LOGOUT --------------------
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// -------------------- START SERVER --------------------
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

