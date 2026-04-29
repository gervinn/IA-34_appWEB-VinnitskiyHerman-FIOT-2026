const registerForm = document.getElementById("registerForm");
const registerMessage = document.getElementById("registerMessage");

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();

  registerMessage.textContent = "";
  registerMessage.className = "message";

  if (password !== confirmPassword) {
    registerMessage.textContent = "Паролі не збігаються";
    registerMessage.classList.add("error");
    return;
  }

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
        confirmPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      registerMessage.textContent = data.message || "Помилка реєстрації";
      registerMessage.classList.add("error");
      return;
    }

    registerMessage.innerHTML = `
      Реєстрація успішна!<br>
      Для підтвердження email відкрийте посилання:<br>
      <a href="${data.confirmLink}" target="_blank">Підтвердити email</a><br><br>
      Після підтвердження можна перейти на сторінку входу.
    `;

    registerMessage.classList.add("success");
    registerForm.reset();
  } catch (error) {
    registerMessage.textContent = "Backend не запущено або сталася помилка з'єднання";
    registerMessage.classList.add("error");
  }
});