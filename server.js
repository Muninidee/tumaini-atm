const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');  // database.js is in same folder

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Serve static files from the "public" folder (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// ============ AUTHENTICATION APIs ============
app.post('/api/signup', (req, res) => {
    const { fullName, username, email, password } = req.body;
    if (!fullName || !username || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.run(`
        INSERT INTO users (username, password, full_name, email, balance, role)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [username, hashedPassword, fullName, email || '', 5000, 'user'], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                return res.status(400).json({ error: 'Username already exists' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, userId: this.lastID, message: 'Account created successfully!' });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password, role } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        if (role === 'admin' && user.role !== 'admin') {
            return res.status(401).json({ error: 'Invalid role' });
        }
        if (role === 'user' && user.role === 'admin') {
            return res.status(401).json({ error: 'Admin cannot login as user' });
        }
        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.full_name,
                email: user.email,
                balance: user.balance,
                role: user.role
            }
        });
    });
});

// ============ USER APIs ============
app.get('/api/users', (req, res) => {
    db.all('SELECT id, username, full_name, email, balance, role, created_at FROM users WHERE role != ?', ['admin'], (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(users);
    });
});

app.put('/api/users/:id/balance', (req, res) => {
    const { balance } = req.body;
    db.run('UPDATE users SET balance = ? WHERE id = ?', [balance, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/users/:id', (req, res) => {
    db.run('DELETE FROM users WHERE id = ? AND role != ?', [req.params.id, 'admin'], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/api/users', (req, res) => {
    const { fullName, username, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.run(`
        INSERT INTO users (username, password, full_name, balance, role)
        VALUES (?, ?, ?, ?, ?)
    `, [username, hashedPassword, fullName, 5000, 'user'], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                return res.status(400).json({ error: 'Username already exists' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, userId: this.lastID });
    });
});

// ============ TRANSACTION APIs ============
app.post('/api/transactions', (req, res) => {
    const { userId, username, type, amount } = req.body;
    db.run(`
        INSERT INTO transactions (user_id, username, type, amount)
        VALUES (?, ?, ?, ?)
    `, [userId, username, type, amount], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.get('/api/transactions', (req, res) => {
    db.all(`
        SELECT * FROM transactions 
        ORDER BY created_at DESC 
        LIMIT 50
    `, (err, transactions) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(transactions);
    });
});

app.delete('/api/transactions', (req, res) => {
    db.run('DELETE FROM transactions', function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ============ ATM NETWORK APIs ============
app.get('/api/atm-network', (req, res) => {
    db.all('SELECT * FROM atm_network', (err, atms) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(atms);
    });
});

app.post('/api/atm-network', (req, res) => {
    const { name, location } = req.body;
    db.run(`
        INSERT INTO atm_network (name, location, cash_level, status, last_maintenance)
        VALUES (?, ?, ?, ?, ?)
    `, [name, location, 250000, 'online', new Date().toISOString().split('T')[0]], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

app.put('/api/atm-network/:id/refill', (req, res) => {
    const { amount } = req.body;
    db.run(`
        UPDATE atm_network 
        SET cash_level = cash_level + ?,
            error_message = CASE WHEN cash_level + ? < 100000 THEN 'Low Cash Warning' ELSE NULL END
        WHERE id = ?
    `, [amount, amount, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.put('/api/atm-network/:id/fix', (req, res) => {
    db.run(`
        UPDATE atm_network 
        SET status = 'online', 
            error_message = NULL,
            last_maintenance = ?
        WHERE id = ?
    `, [new Date().toISOString().split('T')[0], req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ============ CASH INVENTORY APIs ============
app.get('/api/cash-inventory', (req, res) => {
    db.all('SELECT denomination, quantity FROM cash_inventory', (err, inventory) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(inventory);
    });
});

app.post('/api/cash-inventory/refill', (req, res) => {
    db.run('UPDATE cash_inventory SET quantity = ? WHERE denomination = 1000', [500]);
    db.run('UPDATE cash_inventory SET quantity = ? WHERE denomination = 500', [400]);
    db.run('UPDATE cash_inventory SET quantity = ? WHERE denomination = 200', [300]);
    res.json({ success: true });
});

app.put('/api/cash-inventory/withdraw', (req, res) => {
    const { notes1000, notes500, notes200 } = req.body;
    db.run('UPDATE cash_inventory SET quantity = quantity - ? WHERE denomination = 1000', [notes1000]);
    db.run('UPDATE cash_inventory SET quantity = quantity - ? WHERE denomination = 500', [notes500]);
    db.run('UPDATE cash_inventory SET quantity = quantity - ? WHERE denomination = 200', [notes200]);
    res.json({ success: true });
});

// ============ MAINTENANCE APIs ============
app.post('/api/maintenance', (req, res) => {
    res.json({ success: true });
});

app.post('/api/reset-balances', (req, res) => {
    db.run('UPDATE users SET balance = 5000 WHERE role = ?', ['user'], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ============ Serve the frontend for any other route ============
// This must be the LAST route – after all API endpoints
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`✅ Tumaini ATM Server running at http://localhost:${PORT}`);
    console.log(`📊 SQLite Database: database.sqlite`);
});