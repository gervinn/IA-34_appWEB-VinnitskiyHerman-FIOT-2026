const API_URL = "http://localhost:3000";

const token = localStorage.getItem("macshnaknelsToken");
const userData = localStorage.getItem("macshnaknelsUser");

const usersTable = document.getElementById("usersTable");
const usersMessage = document.getElementById("usersMessage");
const postsMessage = document.getElementById("postsMessage");
const postsList = document.getElementById("postsList");

const postForm = document.getElementById("postForm");
const postIdInput = document.getElementById("postId");
const postTitleInput = document.getElementById("postTitle");
const postContentInput = document.getElementById("postContent");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const adminAccount = document.getElementById("adminAccount");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");

let currentUser = null;

if (!token || !userData) {
  alert("Спочатку увійдіть в акаунт адміністратора");
  window.location.href = "login.html";
} else {
  currentUser = JSON.parse(userData);

  if (currentUser.role !== "admin") {
    alert("Доступ дозволено лише адміністратору");
    window.location.href = "index.html";
  }

  adminAccount.textContent = `Адмін: ${currentUser.name}`;
  adminLogoutBtn.style.display = "inline-block";
}

adminLogoutBtn.addEventListener("click", () => {
  localStorage.removeItem("macshnaknelsToken");
  localStorage.removeItem("macshnaknelsUser");
  window.location.href = "index.html";
});

function getHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showMessage(element, text, type) {
  element.textContent = text;
  element.className = `admin-message ${type}`;
}

async function loadUsers() {
  try {
    const response = await fetch(`${API_URL}/api/admin/users`, {
      headers: getHeaders(),
    });

    const users = await response.json();

    if (!response.ok) {
      showMessage(usersMessage, users.message || "Помилка завантаження користувачів", "error");
      return;
    }

    usersTable.innerHTML = users
      .map((user) => {
        return `
          <tr>
            <td>${user.id}</td>
            <td>${escapeHTML(user.name)}</td>
            <td>${escapeHTML(user.email)}</td>
            <td>
              <select id="role-${user.id}">
                <option value="user" ${user.role === "user" ? "selected" : ""}>user</option>
                <option value="admin" ${user.role === "admin" ? "selected" : ""}>admin</option>
              </select>
            </td>
            <td>
              <button class="admin-save-btn" onclick="updateUserRole(${user.id})">Зберегти роль</button>
              <button class="admin-delete-btn" onclick="deleteUser(${user.id})">Видалити</button>
            </td>
          </tr>
        `;
      })
      .join("");
  } catch (error) {
    showMessage(usersMessage, "Backend не запущено або помилка з'єднання", "error");
  }
}

async function updateUserRole(id) {
  const role = document.getElementById(`role-${id}`).value;

  try {
    const response = await fetch(`${API_URL}/api/admin/users/${id}/role`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ role }),
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(usersMessage, data.message || "Помилка оновлення ролі", "error");
      return;
    }

    showMessage(usersMessage, "Роль користувача оновлено", "success");
    loadUsers();
  } catch (error) {
    showMessage(usersMessage, "Помилка з'єднання з backend", "error");
  }
}

async function deleteUser(id) {
  if (!confirm("Ви точно хочете видалити цього користувача?")) return;

  try {
    const response = await fetch(`${API_URL}/api/admin/users/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(usersMessage, data.message || "Помилка видалення користувача", "error");
      return;
    }

    showMessage(usersMessage, "Користувача видалено", "success");
    loadUsers();
  } catch (error) {
    showMessage(usersMessage, "Помилка з'єднання з backend", "error");
  }
}

async function loadPosts() {
  try {
    const response = await fetch(`${API_URL}/api/admin/posts`, {
      headers: getHeaders(),
    });

    const posts = await response.json();

    if (!response.ok) {
      showMessage(postsMessage, posts.message || "Помилка завантаження постів", "error");
      return;
    }

    if (posts.length === 0) {
      postsList.innerHTML = "<p>Поки що немає постів або акцій.</p>";
      return;
    }

    postsList.innerHTML = posts
      .map((post) => {
        return `
          <article class="post-card">
            <h3>${escapeHTML(post.title)}</h3>
            <p>${escapeHTML(post.content)}</p>
            <small>Автор: ${post.author ? escapeHTML(post.author.name) : "Невідомо"}</small>

            <div class="post-actions">
              <button class="edit-post-btn" onclick="editPost(${post.id}, '${escapeHTML(post.title)}', '${escapeHTML(post.content)}')">
                Редагувати
              </button>
              <button class="delete-post-btn" onclick="deletePost(${post.id})">
                Видалити
              </button>
            </div>
          </article>
        `;
      })
      .join("");
  } catch (error) {
    showMessage(postsMessage, "Backend не запущено або помилка з'єднання", "error");
  }
}

postForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const postId = postIdInput.value;
  const title = postTitleInput.value.trim();
  const content = postContentInput.value.trim();

  const isEditMode = Boolean(postId);

  const url = isEditMode
    ? `${API_URL}/api/admin/posts/${postId}`
    : `${API_URL}/api/admin/posts`;

  const method = isEditMode ? "PUT" : "POST";

  try {
    const response = await fetch(url, {
      method,
      headers: getHeaders(),
      body: JSON.stringify({
        title,
        content,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(postsMessage, data.message || "Помилка збереження поста", "error");
      return;
    }

    showMessage(postsMessage, isEditMode ? "Пост оновлено" : "Пост створено", "success");

    postForm.reset();
    postIdInput.value = "";

    loadPosts();
  } catch (error) {
    showMessage(postsMessage, "Помилка з'єднання з backend", "error");
  }
});

function editPost(id, title, content) {
  postIdInput.value = id;
  postTitleInput.value = title;
  postContentInput.value = content;

  window.scrollTo({
    top: postForm.offsetTop - 120,
    behavior: "smooth",
  });
}

cancelEditBtn.addEventListener("click", () => {
  postForm.reset();
  postIdInput.value = "";
});

async function deletePost(id) {
  if (!confirm("Ви точно хочете видалити цей пост?")) return;

  try {
    const response = await fetch(`${API_URL}/api/admin/posts/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(postsMessage, data.message || "Помилка видалення поста", "error");
      return;
    }

    showMessage(postsMessage, "Пост видалено", "success");
    loadPosts();
  } catch (error) {
    showMessage(postsMessage, "Помилка з'єднання з backend", "error");
  }
}

loadUsers();
loadPosts();