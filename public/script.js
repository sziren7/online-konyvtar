async function loadBooks() {
    try {
        const response = await fetch("/api/books");
        const books = await response.json();

        const container = document.getElementById("books-container");
        container.innerHTML = "";

        books.forEach(book => {
            const card = document.createElement("div");
            card.classList.add("book-card");

            card.innerHTML = `
                <img src="${book.image_url}" alt="${book.title}" class="book-image">

                <h2>${book.title}</h2>

                <p><strong>Szerző:</strong> ${book.author}</p>
                <p><strong>Kategória:</strong> ${book.category}</p>
                <p><strong>Év:</strong> ${book.year}</p>

                <p class="short-description">${book.description}</p>

                <details>
                    <summary>Részletes bemutató</summary>
                    <p>${book.long_description}</p>
                </details>

                <p><strong>Elérhető példány:</strong> ${book.available_copies}</p>

                ${book.available_copies > 0
                    ? `<button onclick="borrowBook(${book.id})">Kölcsönzés</button>`
                    : `<button disabled>Nincs elérhető példány</button>`
                }
                ${localStorage.getItem("userRole") === "admin"
                    ? `
                        <button onclick="deleteBook(${book.id})">
                            Könyv törlése
                        </button>
                    `
                : ""
            }
        `;

            container.appendChild(card);
        });

    } catch (error) {
        console.error("Hiba a könyvek betöltésekor:", error);
    }
}

async function borrowBook(bookId) {
    const loggedInUser = localStorage.getItem("loggedInUser");

    if (!loggedInUser) {
        alert("Kölcsönzéshez be kell jelentkezni.");
        return;
    }

    const response = await fetch("/api/loans", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            book_id: bookId,
            borrower_name: loggedInUser
        })
    });

    const result = await response.json();

    if (response.ok) {
        alert(`${result.message} Határidő: ${result.due_date}`);
        location.reload();
    } else {
        alert("Hiba: " + result.error);
    }
}

async function register() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const message = document.getElementById("auth-message");

    const response = await fetch("/api/register", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username,
            password
        })
    });

    const result = await response.json();

    if (response.ok) {
        message.textContent = "Sikeres regisztráció.";
    } else {
        message.textContent = result.error;
    }
}

async function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const message = document.getElementById("auth-message");

    const response = await fetch("/api/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username,
            password
        })
    });

    const result = await response.json();

    if (response.ok) {
        localStorage.setItem("loggedInUser", result.username);
        localStorage.setItem("userRole", result.role);
        message.textContent = `Bejelentkezve: ${result.username}`;
        updateUserInfo();
    } else {
        message.textContent = result.error;
    }
}

function logout() {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("userRole");
    
    document.getElementById("auth-message").textContent =
        "Sikeres kijelentkezés.";

    updateUserInfo();
}

function updateUserInfo() {

    const userInfo =
        document.getElementById("user-info");

    const loggedInUser =
        localStorage.getItem("loggedInUser");

    const userRole =
        localStorage.getItem("userRole");

    const adminSection =
        document.getElementById("admin-section");

    if (loggedInUser) {

        userInfo.textContent =
            `Bejelentkezve: ${loggedInUser}`;

        if (userRole === "admin") {
            adminSection.style.display = "block";
        } else {
            adminSection.style.display = "none";
        }

    } else {

        userInfo.textContent =
            "Nincs bejelentkezett felhasználó.";

        adminSection.style.display = "none";
    }
}
async function loadMyLoans() {

    const loggedInUser =
        localStorage.getItem("loggedInUser");

    const container =
        document.getElementById("my-loans-container");

    if (!loggedInUser) {

        container.innerHTML =
            "<p>Jelentkezz be a kölcsönzések megtekintéséhez.</p>";

        return;
    }

    try {

        const response = await fetch(
            `/api/my-loans/${loggedInUser}`
        );

        const loans = await response.json();

        if (loans.length === 0) {

            container.innerHTML =
                "<p>Nincs aktív kölcsönzés.</p>";

            return;
        }

        container.innerHTML = "";

        loans.forEach(loan => {

            const loanCard =
                document.createElement("div");

            loanCard.classList.add("loan-card");

            loanCard.innerHTML = `
                <h3>${loan.title}</h3>

                <p><strong>Szerző:</strong>
                ${loan.author}</p>

                <p><strong>Kölcsönzés:</strong>
                ${loan.loan_date}</p>

                <p><strong>Határidő:</strong>
                ${loan.due_date}</p>

                <button onclick="returnBook(${loan.id})">
                    Visszahozás
                </button>
`;

            container.appendChild(loanCard);
        });

    } catch (error) {

        console.error(
            "Hiba a kölcsönzések betöltésekor:",
            error
        );
    }
}
loadBooks();
updateUserInfo();
async function returnBook(loanId) {
    const response = await fetch(`/api/return/${loanId}`, {
        method: "PUT"
    });

    const result = await response.json();

    if (response.ok) {
        alert(result.message);
        loadBooks();
        loadMyLoans();
    } else {
        alert("Hiba: " + result.error);
    }
}
loadMyLoans();
function searchBooks() {

    const searchValue =
        document.getElementById("searchInput")
        .value
        .toLowerCase();

    const cards =
        document.querySelectorAll(".book-card");

    cards.forEach(card => {

        const text =
            card.textContent.toLowerCase();

        if (text.includes(searchValue)) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
}

function resetSearch() {

    document.getElementById("searchInput").value = "";

    const cards =
        document.querySelectorAll(".book-card");

    cards.forEach(card => {
        card.style.display = "block";
    });
}
async function addBook() {

    const title =
        document.getElementById("newTitle").value;

    const author =
        document.getElementById("newAuthor").value;

    const year =
        document.getElementById("newYear").value;

    const category =
        document.getElementById("newCategory").value;

    const available_copies =
        document.getElementById("newCopies").value;

    const image_url =
        document.getElementById("newImageUrl").value;

    const description =
        document.getElementById("newDescription").value;

    const long_description =
        document.getElementById("newLongDescription").value;

    const response = await fetch("/api/books", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            title,
            author,
            year,
            category,
            description,
            available_copies,
            image_url,
            long_description,
            role: localStorage.getItem("userRole")

        })
    });

    const result = await response.json();

    const message =
        document.getElementById("admin-message");

    if (response.ok) {

        message.textContent =
            "Könyv sikeresen hozzáadva.";

        loadBooks();

    } else {

        message.textContent =
            result.error;
    }
}
async function deleteBook(bookId) {

    const confirmDelete =
        confirm("Biztosan törölni szeretnéd ezt a könyvet?");

    if (!confirmDelete) {
        return;
    }

    const response = await fetch(`/api/books/${bookId}`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            role: localStorage.getItem("userRole")
        })
    });

    const result = await response.json();

    if (response.ok) {

        alert(result.message);

        loadBooks();

    } else {

        alert("Hiba: " + result.error);
    }
}