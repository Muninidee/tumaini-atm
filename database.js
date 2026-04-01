const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Use the same folder as this file (__dirname)
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            email TEXT,
            balance REAL DEFAULT 5000,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Transactions table
    db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            username TEXT,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            status TEXT DEFAULT 'Success',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // ATM Network table
    db.run(`
        CREATE TABLE IF NOT EXISTS atm_network (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            location TEXT NOT NULL,
            cash_level REAL DEFAULT 250000,
            status TEXT DEFAULT 'online',
            error_message TEXT,
            last_maintenance DATE
        )
    `);

    // Cash Inventory table
    db.run(`
        CREATE TABLE IF NOT EXISTS cash_inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            denomination INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Insert default admin user if not exists
    const adminPassword = bcrypt.hashSync('admin123', 10);
    db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, row) => {
        if (!row) {
            db.run(`
                INSERT INTO users (username, password, full_name, email, balance, role)
                VALUES (?, ?, ?, ?, ?, ?)
            `, ['admin', adminPassword, 'System Administrator', 'admin@tumaini.com', 0, 'admin']);
        }
    });

    // Insert default ATM network data if empty
    db.get('SELECT COUNT(*) as count FROM atm_network', (err, row) => {
        if (row.count === 0) {
            const atms = [
                ['Tumaini HQ - Nairobi', 'CBD, Nairobi', 780000, 'online', null, '2026-03-30'],
                ['Westlands Branch', 'Westlands, Nairobi', 245000, 'online', null, '2026-03-28'],
                ['Mombasa Road', 'Industrial Area', 89000, 'online', 'Low Cash Warning', '2026-03-25'],
                ['Kisumu City', 'Kisumu CBD', 0, 'offline', 'Network Connection Lost', '2026-03-20'],
                ['Eldoret Hub', 'Eldoret Town', 125000, 'error', 'Card Reader Malfunction', '2026-03-29'],
                ['Thika Road Mall', 'Thika Road', 432000, 'online', null, '2026-03-31'],
                ['Nakuru Branch', 'Nakuru CBD', 67000, 'online', 'Low Cash Alert', '2026-03-27']
            ];
            
            atms.forEach(atm => {
                db.run(`
                    INSERT INTO atm_network (name, location, cash_level, status, error_message, last_maintenance)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, atm);
            });
        }
    });

    // Insert default cash inventory if empty
    db.get('SELECT COUNT(*) as count FROM cash_inventory', (err, row) => {
        if (row.count === 0) {
            const inventory = [
                [1000, 500],
                [500, 400],
                [200, 300]
            ];
            
            inventory.forEach(item => {
                db.run(`
                    INSERT INTO cash_inventory (denomination, quantity)
                    VALUES (?, ?)
                `, item);
            });
        }
    });
});

module.exports = db;