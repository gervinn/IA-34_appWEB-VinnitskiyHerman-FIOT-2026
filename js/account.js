const API_URL = "http://localhost:3000";

const profileInfo = document.getElementById("profileInfo");
const profileMessage = document.getElementById("profileMessage");
const profileUpdateMessage = document.getElementById("profileUpdateMessage");
const passwordMessage = document.getElementById("passwordMessage");

const profileForm = document.getElementById("profileForm");
const changePasswordForm = document.getElementById("changePasswordForm");

const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");

const oldPassword = document.getElementById("oldPassword");
const newPassword = document.getElementById("newPassword");
const confirmNewPassword = document.getElementById("confirmNewPassword");

const refreshTokenBtn = document.getElementById("refreshTokenBtn");
const deleteAccountBtn = document.getElementById("deleteAccountBtn");
const accountLogoutBtn = document.getElementById("accountLogoutBtn");
const accountAdminLink = document.getElementById("accountAdminLink");

function showMessage(element, text, type) {
  element.textContent = text;
  element.className = `message ${type}`;
}

function getAccessToken() {
  return localStorage.getItem("macshnaknelsToken");
}

function getRefreshToken() {
  return localStorage.getItem("macshnaknelsRefreshToken");
}

function clearAuthData() {
  localStorage.removeItem("macshnaknelsUser");
  localStorage.removeItem("macshnaknelsToken");
  localStorage.removeItem("macshnaknelsRefreshToken");
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      return null;
    }

    localStorage.setItem("macshnaknelsToken", data.accessToken);
    return data.accessToken;
  } catch (error) {
    return null;
  }
}

async function authFetch(url, options = {}) {
  let token = getAccessToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status !== 401) {
    return response;
  }

  const newToken = await refreshAccessToken();

  if (!newToken) {
    clearAuthData();
    window.location.href = "login.html";
    return response;
  }

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${newToken}`,
    },
  });
}

async function loadProfile() {
  const token = getAccessToken();

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  try {
    const response = await authFetch(`${API_URL}/api/auth/me`);
    const user = await response.json();

    if (!response.ok) {
      profileInfo.textContent = user.message || "Помилка завантаження профілю";
      return;
    }

    localStorage.setItem("macshnaknelsUser", JSON.stringify(user));

    profileInfo.innerHTML = `
      <strong>ID:</strong> ${user.id}<br>
      <strong>Ім’я:</strong> ${user.name}<br>
      <strong>Email:</strong> ${user.email}<br>
      <strong>Роль:</strong> ${user.role}<br>
      <strong>Email підтверджено:</strong> ${user.emailConfirmed ? "Так" : "Ні"}
    `;

    profileName.value = user.name;
    profileEmail.value = user.email;

    if (user.role === "admin") {
      accountAdminLink.style.display = "inline-block";
    }
  } catch (error) {
    profileInfo.textContent = "Backend не запущено або сталася помилка з'єднання";
  }
}

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  profileUpdateMessage.textContent = "";
  profileUpdateMessage.className = "message";

  try {
    const response = await authFetch(`${API_URL}/api/auth/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: profileName.value.trim(),
        email: profileEmail.value.trim(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(profileUpdateMessage, data.message || "Помилка оновлення профілю", "error");
      return;
    }

    localStorage.setItem("macshnaknelsUser", JSON.stringify(data.user));
    showMessage(profileUpdateMessage, "Профіль успішно оновлено", "success");

    loadProfile();
  } catch (error) {
    showMessage(profileUpdateMessage, "Помилка з'єднання з backend", "error");
  }
});

changePasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  passwordMessage.textContent = "";
  passwordMessage.className = "message";

  if (newPassword.value !== confirmNewPassword.value) {
    showMessage(passwordMessage, "Нові паролі не збігаються", "error");
    return;
  }

  try {
    const response = await authFetch(`${API_URL}/api/auth/change-password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        oldPassword: oldPassword.value,
        newPassword: newPassword.value,
        confirmNewPassword: confirmNewPassword.value,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(passwordMessage, data.message || "Помилка зміни пароля", "error");
      return;
    }

    showMessage(passwordMessage, "Пароль успішно змінено", "success");
    changePasswordForm.reset();
  } catch (error) {
    showMessage(passwordMessage, "Помилка з'єднання з backend", "error");
  }
});

refreshTokenBtn.addEventListener("click", async () => {
  const newToken = await refreshAccessToken();

  if (!newToken) {
    showMessage(profileMessage, "Не вдалося оновити access token", "error");
    return;
  }

  showMessage(profileMessage, "Access token успішно оновлено", "success");
});

deleteAccountBtn.addEventListener("click", async () => {
  const confirmed = confirm("Ви точно хочете видалити свій акаунт?");

  if (!confirmed) return;

  try {
    const response = await authFetch(`${API_URL}/api/auth/delete-account`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(profileMessage, data.message || "Помилка видалення акаунта", "error");
      return;
    }

    clearAuthData();
    alert("Акаунт видалено");
    window.location.href = "index.html";
  } catch (error) {
    showMessage(profileMessage, "Помилка з'єднання з backend", "error");
  }
});

accountLogoutBtn.addEventListener("click", async () => {
  const token = getAccessToken();

  try {
    if (token) {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    }
  } catch (error) {
    console.log("Logout на backend не виконано");
  }

  clearAuthData();
  window.location.href = "index.html";
});

loadProfile();