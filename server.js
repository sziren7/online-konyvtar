const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 3001;
const bcrypt = require("bcrypt");

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

const db = new sqlite3.Database("./db/library.db", (err) => {
    if (err) {
        console.error("Hiba az adatbázis megnyitásakor:", err.message);
    } else {
        console.log("Sikeres adatbázis kapcsolat.");
    }
});

app.get("/api/books", (req, res) => {
    db.all("SELECT * FROM books", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        res.json(rows);
    });
});
app.post("/api/books", (req, res) => {
    const {
        title,
        author,
        year,
        category,
        description,
        available_copies,
        image_url,
        long_description,
        role
    } = req.body;
    if (role !== "admin") {
        return res.status(403).json({
            error: "Nincs jogosultság könyv hozzáadásához."
        });
    }
    if (!title || !author || !category) {
        return res.status(400).json({
            error: "A cím, szerző és kategória megadása kötelező."
        });
    }

    db.run(
        `INSERT INTO books
        (title, author, year, category, description, available_copies, image_url, long_description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            title,
            author,
            year,
            category,
            description,
            available_copies || 1,
            image_url,
            long_description
        ],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            res.status(201).json({
                message: "Könyv sikeresen hozzáadva.",
                id: this.lastID
            });
        }
    );
});
app.delete("/api/books/:id", (req, res) => {
    const bookId = req.params.id;
    const { role } = req.body;

    if (role !== "admin") {
        return res.status(403).json({
            error: "Nincs jogosultság könyv törléséhez."
        });
    }

    db.run(
        "DELETE FROM books WHERE id = ?",
        [bookId],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    error: "A könyv nem található."
                });
            }

            res.json({
                message: "Könyv sikeresen törölve."
            });
        }
    );
});
app.post("/api/loans", (req, res) => {
    const { book_id, borrower_name } = req.body;

    if (!book_id || !borrower_name) {
        return res.status(400).json({
            error: "A könyv azonosítója és a kölcsönző neve kötelező."
        });
    }

    db.get("SELECT * FROM books WHERE id = ?", [book_id], (err, book) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (!book) {
            return res.status(404).json({
                error: "A könyv nem található."
            });
        }

        if (book.available_copies <= 0) {
            return res.status(400).json({
                error: "Nincs elérhető példány ebből a könyvből."
            });
        }

        const loanDate = new Date();
        const dueDate = new Date();
        dueDate.setDate(loanDate.getDate() + 14);

        db.run(
            `INSERT INTO loans (book_id, borrower_name, loan_date, due_date, returned)
             VALUES (?, ?, ?, ?, 0)`,
            [
                book_id,
                borrower_name,
                loanDate.toISOString().split("T")[0],
                dueDate.toISOString().split("T")[0]
            ],
            function (insertErr) {
                if (insertErr) {
                    return res.status(500).json({ error: insertErr.message });
                }

                db.run(
                    "UPDATE books SET available_copies = available_copies - 1 WHERE id = ?",
                    [book_id],
                    (updateErr) => {
                        if (updateErr) {
                            return res.status(500).json({ error: updateErr.message });
                        }

                        res.status(201).json({
                            message: "Sikeres kölcsönzés.",
                            loan_id: this.lastID,
                            due_date: dueDate.toISOString().split("T")[0]
                        });
                    }
                );
            }
        );
    });
});

app.post("/api/register", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: "Felhasználónév és jelszó kötelező."
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            [username, hashedPassword],
            function (err) {
                if (err) {
                    return res.status(500).json({
                        error: "A felhasználónév már létezik vagy hiba történt."
                    });
                }

                res.status(201).json({
                    message: "Sikeres regisztráció."
                });
            }
        );
    } catch (error) {
        res.status(500).json({
            error: "Hiba a jelszó titkosításakor."
        });
    }
});
app.post("/api/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: "Felhasználónév és jelszó kötelező."
        });
    }

    db.get(
        "SELECT * FROM users WHERE username = ?",
        [username],
        async (err, user) => {

            if (err) {
                return res.status(500).json({
                    error: err.message
                });
            }

            if (!user) {
                return res.status(401).json({
                    error: "Hibás felhasználónév vagy jelszó."
                });
            }

            const passwordMatch = await bcrypt.compare(
                password,
                user.password
            );

            if (!passwordMatch) {
                return res.status(401).json({
                    error: "Hibás felhasználónév vagy jelszó."
                });
            }

            res.json({
                message: "Sikeres bejelentkezés.",
                username: user.username,
                role: user.role
            });
        }
    );
});

app.get("/api/my-loans/:username", (req, res) => {
    const username = req.params.username;

    const sql = `
        SELECT
            loans.id,
            loans.loan_date,
            loans.due_date,
            loans.returned,
            books.title,
            books.author
        FROM loans
        INNER JOIN books ON loans.book_id = books.id
        WHERE loans.borrower_name = ?
        ORDER BY loans.due_date ASC
    `;

    db.all(sql, [username], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        res.json(rows);
    });
});
app.put("/api/return/:loanId", (req, res) => {

    const loanId = req.params.loanId;

    db.get(
        "SELECT * FROM loans WHERE id = ?",
        [loanId],
        (err, loan) => {

            if (err) {
                return res.status(500).json({
                    error: err.message
                });
            }

            if (!loan) {
                return res.status(404).json({
                    error: "Kölcsönzés nem található."
                });
            }

            if (loan.returned === 1) {
                return res.status(400).json({
                    error: "A könyv már vissza lett hozva."
                });
            }

            db.run(
                "UPDATE loans SET returned = 1 WHERE id = ?",
                [loanId],
                (updateErr) => {

                    if (updateErr) {
                        return res.status(500).json({
                            error: updateErr.message
                        });
                    }

                    db.run(
                        `UPDATE books
                         SET available_copies =
                         available_copies + 1
                         WHERE id = ?`,
                        [loan.book_id],
                        (bookErr) => {

                            if (bookErr) {
                                return res.status(500).json({
                                    error: bookErr.message
                                });
                            }

                            res.json({
                                message:
                                "Sikeres visszahozás."
                            });
                        }
                    );
                }
            );
        }
    );
});
const server = app.listen(PORT, () => {
    console.log(`A szerver fut a ${PORT} porton.`);
});

process.stdin.resume();
