const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

async function loadUserAfterOAuth(accessToken, refreshToken) {
  try {
    const response = await fetch("http://localhost:3000/api/auth/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const user = await response.json();

    if (!response.ok) {
      loginMessage.textContent = user.message || "Помилка Google login";
      loginMessage.classList.add("error");
      return;
    }

    localStorage.setItem("macshnaknelsToken", accessToken);
    localStorage.setItem("macshnaknelsRefreshToken", refreshToken);
    localStorage.setItem("macshnaknelsUser", JSON.stringify(user));

    loginMessage.textContent = "Google login виконано успішно";
    loginMessage.classList.add("success");

    setTimeout(() => {
      window.location.href = "index.html";
    }, 1000);
  } catch (error) {
    loginMessage.textContent = "Помилка обробки Google login";
    loginMessage.classList.add("error");
  }
}

const urlParams = new URLSearchParams(window.location.search);

if (urlParams.get("oauth") === "success") {
  const accessToken = urlParams.get("accessToken");
  const refreshToken = urlParams.get("refreshToken");

  if (accessToken && refreshToken) {
    loadUserAfterOAuth(accessToken, refreshToken);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  loginMessage.textContent = "";
  loginMessage.className = "message";

  try {
    const response = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      loginMessage.textContent = data.message || "Помилка входу";
      loginMessage.classList.add("error");
      return;
    }

    localStorage.setItem("macshnaknelsToken", data.accessToken);
    localStorage.setItem("macshnaknelsRefreshToken", data.refreshToken);
    localStorage.setItem("macshnaknelsUser", JSON.stringify(data.user));

    loginMessage.textContent = `Вітаємо, ${data.user.name}! Вхід виконано успішно.`;
    loginMessage.classList.add("success");

    setTimeout(() => {
      window.location.href = "index.html";
    }, 1000);
  } catch (error) {
    loginMessage.textContent = "Backend не запущено або сталася помилка з'єднання";
    loginMessage.classList.add("error");
  }
});