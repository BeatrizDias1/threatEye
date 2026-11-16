document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggleSidebar');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    const navItems = document.querySelectorAll('.sidebar__item');
    const uploadBox = document.getElementById('area_upload');
    const fileInput = document.getElementById('fileInput');

    // Abre e fecha o menu lateral transparente ao clicar no hambúrguer
    toggleBtn.addEventListener('click', () => {
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            sidebar.classList.toggle('open');
        } else {
            sidebar.classList.toggle('closed');
            mainContent.classList.toggle('expanded');
        }
    });

    // Destaca o item ativo no menu lateral e fecha no mobile após clicar
    navItems.forEach(item => {
        item.addEventListener('click', function () {
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');

            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }
        });
    });

    // Abre o seletor de arquivos ao clicar na caixa de upload
    if (uploadBox && fileInput) {
        uploadBox.addEventListener('click', () => fileInput.click());
    }
});