const registerForm = document.getElementById("registerForm");
const registerMessage = document.getElementById("registerMessage");

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  registerMessage.textContent = "";
  registerMessage.className = "message";

  try {
    const response = await fetch("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      registerMessage.textContent = data.message || "Помилка реєстрації";
      registerMessage.classList.add("error");
      return;
    }

    registerMessage.textContent = "Реєстрація успішна! Зараз відкриється сторінка входу.";
    registerMessage.classList.add("success");

    registerForm.reset();

    setTimeout(() => {
      window.location.href = "login.html";
    }, 1500);
  } catch (error) {
    registerMessage.textContent = "Backend не запущено або сталася помилка з'єднання";
    registerMessage.classList.add("error");
  }
});