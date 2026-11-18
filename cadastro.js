
// ==========================================
// 1. SELECIONANDO OS ELEMENTOS
// ==========================================

const cadastroForm = document.getElementById("cadastroForm");

const nome = document.getElementById("nome");
const email = document.getElementById("email");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");

const nomeError = document.getElementById("nomeError");
const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");
const confirmPasswordError = document.getElementById("confirmPasswordError");


// ==========================================
// 2. EVENTO DE CADASTRO
// ==========================================

cadastroForm.addEventListener("submit", function(event) {

    // Impede o recarregamento da página
    event.preventDefault();

    // Limpa mensagens anteriores
    nomeError.textContent = "";
    emailError.textContent = "";
    passwordError.textContent = "";
    confirmPasswordError.textContent = "";

    // Captura os valores
    const nomeValue = nome.value.trim();
    const emailValue = email.value.trim().toLowerCase();
    const passwordValue = password.value;
    const confirmPasswordValue = confirmPassword.value;

    let isValid = true;


    // ==========================================
    // 3. VALIDAÇÃO DO NOME
    // ==========================================

    if (nomeValue === "") {

        nomeError.textContent = "Informe seu nome.";
        isValid = false;

    }


    // ==========================================
    // 4. VALIDAÇÃO DO E-MAIL
    // ==========================================

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (emailValue === "") {

        emailError.textContent = "Informe seu e-mail.";
        isValid = false;

    } else if (!emailRegex.test(emailValue)) {

        emailError.textContent = "Digite um e-mail válido.";
        isValid = false;

    }


    // ==========================================
    // 5. VALIDAÇÃO DA SENHA
    // ==========================================

    if (passwordValue.length < 8) {

        passwordError.textContent = "A senha deve ter pelo menos 8 caracteres.";
        isValid = false;

    }


    // ==========================================
    // 6. CONFIRMAÇÃO DA SENHA
    // ==========================================

    if (confirmPasswordValue === "") {

        confirmPasswordError.textContent = "Confirme sua senha.";
        isValid = false;

    } else if (passwordValue !== confirmPasswordValue) {

        confirmPasswordError.textContent = "As senhas não são iguais.";
        isValid = false;

    }


    // ==========================================
    // 7. INTERROMPE SE EXISTIR ERRO
    // ==========================================

    if (!isValid) {
        return;
    }


    // ==========================================
    // 8. VERIFICA SE O E-MAIL JÁ EXISTE
    // ==========================================

    const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];

    const usuarioExiste = usuarios.some(function(usuario) {
        return usuario.email === emailValue;
    });

    if (usuarioExiste) {

        emailError.textContent = "Este e-mail já está cadastrado.";
        return;

    }


    // ==========================================
    // 9. CRIA O NOVO USUÁRIO
    // ==========================================

    const novoUsuario = {
        nome: nomeValue,
        email: emailValue,
        senha: passwordValue
    };


    // ==========================================
    // 10. SALVA NO LOCALSTORAGE
    // ==========================================

    usuarios.push(novoUsuario);

    localStorage.setItem("usuarios", JSON.stringify(usuarios));


    // ==========================================
    // 11. FINALIZA O CADASTRO
    // ==========================================

    alert("Cadastro realizado com sucesso!");

    window.location.href = "index.html";

});
