
 // ==========================================
 // 1. SELECIONANDO OS ELEMENTOS
 // ==========================================

const password = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const eyeIcon = document.getElementById("eyeIcon");

const loginForm = document.getElementById("loginForm");
const email = document.getElementById("email");

const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");


// ==========================================
// 2. MOSTRAR E OCULTAR SENHA
// ==========================================

togglePassword.addEventListener("click", function() {

    if (password.type === "password") {

        password.type = "text";

        eyeIcon.classList.remove("fa-eye");
        eyeIcon.classList.add("fa-eye-slash");

    } else {

        password.type = "password";

        eyeIcon.classList.remove("fa-eye-slash");
        eyeIcon.classList.add("fa-eye");

    }

});


// ==========================================
// 3. EVENTO DE LOGIN
// ==========================================

loginForm.addEventListener("submit", function(event) {

    event.preventDefault();

    // Limpa mensagens anteriores
    emailError.textContent = "";
    passwordError.textContent = "";

    // Captura os valores
    const emailValue = email.value.trim().toLowerCase();
    const passwordValue = password.value;

    let isValid = true;


    // ==========================================
    // 4. VALIDAÇÃO DOS CAMPOS
    // ==========================================

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (emailValue === "") {

        emailError.textContent = "Informe seu e-mail.";
        isValid = false;

    } else if (!emailRegex.test(emailValue)) {

        emailError.textContent = "Digite um e-mail válido.";
        isValid = false;

    }

    if (passwordValue.trim() === "") {

        passwordError.textContent = "Informe sua senha.";
        isValid = false;

    }

    if (!isValid) {
        return;
    }


    // ==========================================
    // 5. RECUPERAR USUÁRIOS CADASTRADOS
    // ==========================================

    const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];


    // ==========================================
    // 6. VERIFICAR CREDENCIAIS
    // ==========================================

    const usuarioEncontrado = usuarios.find(function(usuario) {

        return usuario.email === emailValue &&
               usuario.senha === passwordValue;

    });


    // ==========================================
    // 7. VERIFICAR RESULTADO
    // ==========================================

    if (!usuarioEncontrado) {

        passwordError.textContent = "E-mail ou senha incorretos.";
        return;

    }


    // ==========================================
    // 8. CRIAR SESSÃO
    // ==========================================

    const sessao = {
        nome: usuarioEncontrado.nome,
        email: usuarioEncontrado.email
    };

    sessionStorage.setItem("usuarioLogado", JSON.stringify(sessao));


    // ==========================================
    // 9. REDIRECIONAR
    // ==========================================

    window.location.href = "home.html";

});
