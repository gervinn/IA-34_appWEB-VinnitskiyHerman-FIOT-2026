const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const resetPasswordForm = document.getElementById("resetPasswordForm");

const forgotEmail = document.getElementById("forgotEmail");
const resetToken = document.getElementById("resetToken");
const resetNewPassword = document.getElementById("resetNewPassword");
const resetConfirmPassword = document.getElementById("resetConfirmPassword");

const forgotMessage = document.getElementById("forgotMessage");
const resetMessage = document.getElementById("resetMessage");

function showMessage(element, text, type) {
  element.innerHTML = text;
  element.className = `message ${type}`;
}

forgotPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  forgotMessage.textContent = "";
  forgotMessage.className = "message";

  try {
    const response = await fetch("http://localhost:3000/api/auth/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: forgotEmail.value.trim(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(forgotMessage, data.message || "Помилка відновлення пароля", "error");
      return;
    }

    if (data.resetToken) {
      showMessage(
        forgotMessage,
        `
          Reset token створено:<br>
          <strong>${data.resetToken}</strong><br><br>
          Скопіюйте його в форму скидання пароля.
        `,
        "success"
      );

      resetToken.value = data.resetToken;
    } else {
      showMessage(forgotMessage, data.message, "success");
    }
  } catch (error) {
    showMessage(forgotMessage, "Backend не запущено або помилка з'єднання", "error");
  }
});

resetPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  resetMessage.textContent = "";
  resetMessage.className = "message";

  if (resetNewPassword.value !== resetConfirmPassword.value) {
    showMessage(resetMessage, "Нові паролі не збігаються", "error");
    return;
  }

  try {
    const response = await fetch("http://localhost:3000/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: resetToken.value.trim(),
        newPassword: resetNewPassword.value,
        confirmNewPassword: resetConfirmPassword.value,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(resetMessage, data.message || "Помилка скидання пароля", "error");
      return;
    }

    showMessage(resetMessage, "Пароль успішно змінено. Тепер можна увійти.", "success");
    resetPasswordForm.reset();
  } catch (error) {
    showMessage(resetMessage, "Backend не запущено або помилка з'єднання", "error");
  }
});