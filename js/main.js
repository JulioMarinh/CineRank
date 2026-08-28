// =======================================================
// TEMA (claro/escuro)
// =======================================================

// Aplica o tema salvo assim que o script carrega, antes de qualquer
// outra coisa — evita um "flash" do tema errado na primeira pintura
// da página.
(function aplicarTemaSalvo() {
    const temaSalvo = localStorage.getItem("cinerank-theme");
    if (temaSalvo === "light") {
        document.documentElement.classList.add("light-theme");
    }
})();

// =======================================================
// REFERÊNCIAS AOS ELEMENTOS DO DOM
// =======================================================

const uploadBtn = document.getElementById("uploadBtn");
const csvFile = document.getElementById("csvFile");
const fileName = document.getElementById("fileName");
const movieList = document.getElementById("movieList");
const searchMovie = document.getElementById("searchMovie");
const home = document.getElementById("home");
const ranking = document.getElementById("ranking");
const hero = document.getElementById("hero");
const heroBgA = document.getElementById("heroBgA");
const heroBgB = document.getElementById("heroBgB");
const heroSkeleton = document.getElementById("heroSkeleton");
const heroDots = document.getElementById("heroDots");
const heroPrev = document.getElementById("heroPrev");
const heroNext = document.getElementById("heroNext");
const viewRanking = document.getElementById("viewRanking");
const loading = document.getElementById("loading");
const progress = document.getElementById("progress");
const loadingText = document.getElementById("loadingText");

const modal = document.getElementById("movieModal");
const closeModal = document.getElementById("closeModal");
const wrappedModal = document.getElementById("wrappedModal");
const wrappedBtn = document.getElementById("wrappedBtn");
const closeWrapped = document.getElementById("closeWrapped");
const wrappedContainer = document.getElementById("wrappedContainer");
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const downloadWrappedBtn = document.getElementById("downloadWrappedBtn");
const shareWrappedBtn = document.getElementById("shareWrappedBtn");
const libraryBtn = document.getElementById("libraryBtn");
const libraryModal = document.getElementById("libraryModal");
const closeLibrary = document.getElementById("closeLibrary");
const libraryContainer = document.getElementById("libraryContainer");
const myReviewsBtn = document.getElementById("myReviewsBtn");
const reviewsModal = document.getElementById("reviewsModal");
const closeReviews = document.getElementById("closeReviews");
const reviewsContainer = document.getElementById("reviewsContainer");

const modalPoster = document.getElementById("modalPoster");
const modalTitle = document.getElementById("modalTitle");
const modalRating = document.getElementById("modalRating");
const modalYear = document.getElementById("modalYear");
const modalGenre = document.getElementById("modalGenre");
const modalRuntime = document.getElementById("modalRuntime");
const modalOverview = document.getElementById("modalOverview");
const modalIMDb = document.getElementById("modalIMDb");
const ratingStarsDisplay = document.getElementById("ratingStarsDisplay");
const ratingScoreDisplay = document.getElementById("ratingScoreDisplay");
const rateBtn = document.getElementById("rateBtn");
const ratingForm = document.getElementById("ratingForm");
const ratingStarsInput = document.getElementById("ratingStarsInput");
const ratingComment = document.getElementById("ratingComment");
const ratingCommentCount = document.getElementById("ratingCommentCount");
const saveRatingBtn = document.getElementById("saveRatingBtn");
const heroTitle = document.getElementById("heroTitle");
const heroInfo = document.getElementById("heroInfo");
const heroDescription = document.getElementById("heroDescription");
const heroButton = document.getElementById("heroButton");
const loadMoreBtn = document.getElementById("loadMoreBtn");

// Chave da API do TMDb, usada em todas as buscas de filme/série
const API_KEY = "608461580d8148bc725aa1338e9dc710";

// Os botões que dependem de ter filmes importados começam
// desabilitados — só liberam quando o CSV termina de carregar
viewRanking.disabled = true;
if (wrappedBtn) wrappedBtn.disabled = true;
if (libraryBtn) libraryBtn.disabled = true;

// Troca o ícone (lua/sol) de acordo com o tema atual
function atualizarIconeTema() {
    const claro = document.documentElement.classList.contains("light-theme");
    if (themeIcon) themeIcon.textContent = claro ? "☀️" : "🌙";
    if (themeToggle) themeToggle.setAttribute(
        "aria-label",
        claro ? "Switch to dark theme" : "Switch to light theme"
    );
}

atualizarIconeTema();

// Os gráficos (Chart.js) não recebem cor via CSS — o texto e as linhas
// de grade precisam ser passados na configuração de cada gráfico, e
// aqui a gente escolhe a cor certa de acordo com o tema atual.
function corGraficoTexto() {
    return document.documentElement.classList.contains("light-theme")
        ? "#2a2a28"
        : "#ffffff";
}

function corGraficoGrade() {
    return document.documentElement.classList.contains("light-theme")
        ? "#d8d4c9"
        : "#2a2a2a";
}

// Atualiza os gráficos já desenhados quando o tema muda — sem isso,
// eles ficariam com a cor "congelada" de quando foram criados.
function atualizarCoresGraficos() {

    const todosOsGraficos = [
        typesChart, genresChart, ratingsChart, yearsChart,
        directorsChart, countriesChart, languagesChart, actorsChart
    ];

    todosOsGraficos.forEach(chart => {

        if (!chart) return;

        const texto = corGraficoTexto();
        const grade = corGraficoGrade();

        if (chart.options.plugins?.legend?.labels) {
            chart.options.plugins.legend.labels.color = texto;
        }

        ["x", "y"].forEach(eixo => {
            const escala = chart.options.scales?.[eixo];
            if (!escala) return;
            if (escala.ticks) escala.ticks.color = texto;
            if (escala.grid) escala.grid.color = grade;
        });

        chart.update();

    });

}

// Clique no botão de tema: alterna a classe, salva a preferência e
// atualiza tudo que depende do tema (ícone + gráficos já desenhados)
themeToggle?.addEventListener("click", () => {

    document.documentElement.classList.toggle("light-theme");

    localStorage.setItem(
        "cinerank-theme",
        document.documentElement.classList.contains("light-theme") ? "light" : "dark"
    );

    atualizarIconeTema();
    atualizarCoresGraficos();

    // pequena animação de giro no ícone
    themeToggle.classList.remove("spin");
    void themeToggle.offsetWidth; // força reflow pra reiniciar a animação
    themeToggle.classList.add("spin");

});

// =======================================================
// ESTADO GERAL DA APLICAÇÃO
// =======================================================

// Lista de filmes carregados do CSV, já com os dados do TMDb
let filmesComNota = [];

// Lista de favoritos (IDs do IMDb), persistida no navegador
let favoritos = JSON.parse(
    localStorage.getItem("favoritos")
) || [];

let filmesPorPagina = 20;
let paginaAtual = 1;
let listaAtual = [];
let destaque = null;
let filtroAtual = "all";

// =======================================================
// LISTA DE FILMES (renderização dos cards no ranking)
// =======================================================

// Desenha os cards de filme na tela a partir de uma lista já filtrada
function mostrarFilmes(lista) {

    listaAtual = lista;

    const limite = paginaAtual * filmesPorPagina;
    const filmesMostrar = lista.slice(0, limite);

    let html = "";

    filmesMostrar.forEach((filme, index) => {
        html += `
        <div class="movie-card" data-index="${index}">
            <div class="movie-poster skeleton-wrap">
                <img
                    src="${filme.poster ? filme.poster : "assets/img/noposter.png"}"
                    alt="${filme.Title}"
                    loading="lazy"
                    onload="this.parentElement.classList.add('loaded')"
                    onerror="this.onerror=null;this.src='assets/img/noposter.png';this.parentElement.classList.add('loaded');">
            </div>
            <div class="movie-info">
                <div class="movie-header">
                    <h2 class="movie-title">
                        ${filme.Title}
                    </h2>
                    <button
                        class="favorite-btn ${favoritos.includes(filme.Const) ? "active" : ""}"
                        data-id="${filme.Const}">
                        ${favoritos.includes(filme.Const) ? "★" : "☆"}
                    </button>
                </div>
                <h3 class="movie-position">
                    <span>#</span> ${index + 1}
                </h3>
                <div class="movie-details">
                    <p class="rating">
                        ⭐ ${filme["IMDb Rating"]}
                    </p>
                    <p class="genre">
                        🎭 ${filme.Genres || "N/A"}
                    </p>
                </div>
            </div>
        </div>
    `;
    });

    movieList.innerHTML = html;

    // Clicar em qualquer parte do card abre o modal de detalhes
    movieList.querySelectorAll(".movie-card").forEach(card => {
        card.addEventListener("click", () => {
            const index = Number(card.dataset.index);
            const filme = listaAtual[index];
            if (filme) {
                abrirModal(filme);
            }
        });
    });

    // Clicar na estrela favorita/desfavorita sem abrir o modal
    document.querySelectorAll(".favorite-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();

            const id = btn.dataset.id;

            if (favoritos.includes(id)) {
                favoritos = favoritos.filter(f => f !== id);
            } else {
                favoritos.push(id);
            }

            localStorage.setItem(
                "favoritos",
                JSON.stringify(favoritos)
            );

            aplicarFiltro();
            atualizarCarouselFavoritos();
        });
    });

    atualizarBotaoLoadMore();
}

// Mostra/esconde o botão "Load More" dependendo se ainda há filmes
// além da página atual
function atualizarBotaoLoadMore() {
    if (
        paginaAtual * filmesPorPagina >=
        listaAtual.length
    ) {
        loadMoreBtn.style.display = "none";
    } else {
        loadMoreBtn.style.display = "block";
    }
}

// =======================================================
// BANNER PRINCIPAL (HERO)
// =======================================================

// Controla qual das duas camadas de fundo (A/B) está visível no
// momento, pra alternar entre elas a cada troca de destaque
let heroBgAtiva = "A";

// Atualiza o banner pro filme recebido: pré-carrega a foto de fundo,
// faz o crossfade entre as camadas e troca o texto (título, nota,
// sinopse) com um fade suave sincronizado
function atualizarHero(filme) {

    const heroContent = document.querySelector("#hero .hero-content");

    const camadaAtual = heroBgAtiva === "A" ? heroBgA : heroBgB;
    const proximaCamada = heroBgAtiva === "A" ? heroBgB : heroBgA;

    // Se esse filme não tem foto de fundo (busca no TMDb falhou ou não
    // achou nada), nem tenta baixar nada — vai direto pro texto, sem
    // gerar uma requisição de rede pra uma URL vazia/inexistente
    if (!filme.backdrop) {
        prosseguirComHero();
        return;
    }

    // Pré-carrega a imagem antes de trocar qualquer coisa na tela —
    // assim o crossfade nunca começa com uma imagem pela metade
    const preload = new Image();

    preload.onload = () => {
        prosseguirComHero();
    };

    preload.onerror = () => {
        // mesmo se a imagem falhar, segue em frente sem travar o banner
        prosseguirComHero();
    };

    preload.src = filme.backdrop;

    function prosseguirComHero() {

        if (filme.backdrop) {
            proximaCamada.style.backgroundImage = `url(${filme.backdrop})`;
        }

        heroSkeleton?.classList.add("loaded");

        heroContent.classList.add("fading");

        setTimeout(() => {

            proximaCamada.classList.add("active");
            camadaAtual.classList.remove("active");
            heroBgAtiva = heroBgAtiva === "A" ? "B" : "A";

            heroTitle.textContent = filme.Title;

            heroInfo.textContent =
                `⭐ ${filme["IMDb Rating"]} • ${filme.Year}`;

            heroDescription.textContent =
                filme.overview || "";

            heroContent.classList.remove("fading");

        }, 450);

    }

    destaque = filme;

}

// =======================================================
// CINERANK WRAPPED (resumo da coleção)
// =======================================================

// As três funções abaixo descobrem o item mais frequente de cada
// categoria (gênero, diretor, ator) entre todos os filmes importados
function descobrirGeneroFavorito() {
    const contagem = {};
    filmesComNota.forEach(filme => {
        if (!filme.Genres) return;
        filme.Genres.split(",").forEach(genero => {
            const chave = genero.trim();
            if (!chave) return;
            contagem[chave] = (contagem[chave] || 0) + 1;
        });
    });
    return Object.entries(contagem)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown";
}

function descobrirDiretorFavorito() {
    const contagem = {};
    filmesComNota.forEach(filme => {
        if (!filme.director) return;
        const chave = filme.director.trim();
        if (!chave) return;
        contagem[chave] = (contagem[chave] || 0) + 1;
    });
    return Object.entries(contagem)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown";
}

function descobrirAtorFavorito() {
    const contagem = {};
    filmesComNota.forEach(filme => {
        if (!Array.isArray(filme.cast)) return;
        filme.cast.forEach(nome => {
            const chave = nome.trim();
            if (!chave) return;
            contagem[chave] = (contagem[chave] || 0) + 1;
        });
    });
    return Object.entries(contagem)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown";
}

// Agrupa os filmes por década de lançamento (ex: 2013 → "2010s") e
// retorna a década com mais títulos
function descobrirDecadaFavorita() {
    const contagem = {};
    filmesComNota.forEach(filme => {
        const ano = Number(filme.Year);
        if (isNaN(ano)) return;
        const decada = `${Math.floor(ano / 10) * 10}s`;
        contagem[decada] = (contagem[decada] || 0) + 1;
    });
    return Object.entries(contagem)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown";
}

// =======================================================
// BIBLIOTECA (estatísticas rápidas da coleção importada)
// =======================================================

// Monta o HTML do card da biblioteca e abre o modal. Usa a coluna
// "Your Rating" do CSV (a nota pessoal do usuário no IMDb) pra separar
// o que já foi avaliado do que ainda não foi.
function abrirLibrary(){

    const total = filmesComNota.length;

    const avaliados = filmesComNota.filter(f => f["Your Rating"]);
    const semNota = total - avaliados.length;

    const media = avaliados.length > 0
        ? avaliados.reduce((soma, f) => soma + Number(f["Your Rating"]), 0) / avaliados.length
        : 0;

    // Filme favorito: o mais bem avaliado pessoalmente; se ninguém foi
    // avaliado, cai pro primeiro da lista (já ordenada pela nota do IMDb)
    const filmeFavorito = avaliados.length > 0
        ? [...avaliados].sort((a, b) => Number(b["Your Rating"]) - Number(a["Your Rating"]))[0]
        : filmesComNota[0];

    const generoFavorito = descobrirGeneroFavorito();
    const decadaFavorita = descobrirDecadaFavorita();

    libraryContainer.innerHTML = `

<h1 class="wrapped-title">

<span class="wrapped-title-icon">📊</span> My Library

</h1>

<div class="wrapped-stat">

<h2>${total}</h2>

<p>Movies</p>

</div>

<div class="wrapped-stat">

<h2>${avaliados.length}</h2>

<p>Movies Rated</p>

</div>

<div class="wrapped-stat">

<h2>${semNota}</h2>

<p>Not Rated</p>

</div>

<div class="wrapped-stat">

<h2>${media.toFixed(2)}</h2>

<p>Average</p>

</div>

<div class="wrapped-stat">

<h2>${filmeFavorito?.Title || "—"}</h2>

<p>Favorite Movie</p>

</div>

<div class="wrapped-stat">

<h2>${generoFavorito}</h2>

<p>Favorite Genre</p>

</div>

<div class="wrapped-stat">

<h2>${decadaFavorita}</h2>

<p>Favorite Decade</p>

</div>

`;

    libraryModal.classList.remove("hidden");

}

libraryBtn?.addEventListener("click", () => {
    if (filmesComNota.length === 0) return;
    abrirLibrary();
});

closeLibrary?.addEventListener("click", () => {
    libraryModal.classList.add("hidden");
});

// Clicar fora do card também fecha
libraryModal?.addEventListener("click", (e) => {
    if (e.target === libraryModal) {
        libraryModal.classList.add("hidden");
    }
});

// Monta o HTML do resumo Wrapped e abre o modal
function abrirWrapped(){

    const maiorNota = filmesComNota[0];
    const menorNota = filmesComNota[filmesComNota.length-1];

    const generoFavorito = descobrirGeneroFavorito();
    const diretorFavorito = descobrirDiretorFavorito();
    const atorFavorito = descobrirAtorFavorito();

    document.getElementById("wrappedContainer").innerHTML=`

<h1 class="wrapped-title">

<span class="wrapped-title-icon">🎉</span> CineRank Wrapped

</h1>

<div class="wrapped-stat">

<h2>${filmesComNota.length}</h2>

<p>Titles Watched</p>

</div>

<div class="wrapped-stat">

<h2>${generoFavorito}</h2>

<p>Favorite Genre</p>

</div>

<div class="wrapped-stat">

<h2>${diretorFavorito}</h2>

<p>Favorite Director</p>

</div>

<div class="wrapped-stat">

<h2>${atorFavorito}</h2>

<p>Most Watched Actor</p>

</div>

<div class="wrapped-stat">

<h2>${maiorNota.Title}</h2>

<p>Highest Rated ⭐ ${maiorNota["IMDb Rating"]}</p>

</div>

<div class="wrapped-stat">

<h2>${menorNota.Title}</h2>

<p>Lowest Rated ⭐ ${menorNota["IMDb Rating"]}</p>

</div>

`;

    wrappedModal.classList.remove("hidden");

}

// Captura o conteúdo do Wrapped como imagem (html2canvas) e monta um
// PDF a partir dela (jsPDF), disparando o download
async function baixarWrappedPDF() {

    if (!wrappedContainer || !downloadWrappedBtn) return;

    const textoOriginal = downloadWrappedBtn.textContent;

    try {

        downloadWrappedBtn.disabled = true;
        downloadWrappedBtn.textContent = "Gerando PDF...";

        if (typeof html2canvas === "undefined" || !window.jspdf) {
            throw new Error("PDF libraries failed to load");
        }

        const canvas = await html2canvas(wrappedContainer, {
            backgroundColor: "#0e0e0e",
            scale: 2,
            useCORS: true
        });

        const imgData = canvas.toDataURL("image/png");

        const { jsPDF } = window.jspdf;

        const pdf = new jsPDF({
            orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
            unit: "px",
            format: [canvas.width, canvas.height]
        });

        pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
        pdf.save("cinerank-wrapped.pdf");

    } catch (erro) {

        console.error("Erro ao gerar PDF do Wrapped:", erro);
        alert("Couldn't generate the PDF right now. Please try again.");

    } finally {

        downloadWrappedBtn.disabled = false;
        downloadWrappedBtn.textContent = textoOriginal;

    }

}

// Monta o texto curto usado tanto no compartilhamento nativo quanto
// na cópia pro clipboard
function montarTextoCompartilhamento() {

    const maiorNota = filmesComNota[0];
    const generoFavorito = descobrirGeneroFavorito();

    return `🎬 My CineRank Wrapped: ${filmesComNota.length} titles watched, favorite genre ${generoFavorito}, top pick "${maiorNota?.Title || ""}" ⭐ ${maiorNota?.["IMDb Rating"] || ""}`;

}

// Compartilha o resumo: usa o menu nativo do sistema quando disponível
// (funciona bem no celular), ou copia o texto pro clipboard no desktop
async function compartilharWrapped() {

    if (!shareWrappedBtn) return;

    const texto = montarTextoCompartilhamento();

    if (navigator.share) {

        try {
            await navigator.share({
                title: "CineRank Wrapped",
                text: texto
            });
        } catch (erro) {
            // usuário cancelou o compartilhamento — não é um erro real
            if (erro?.name !== "AbortError") {
                console.error("Erro ao compartilhar:", erro);
            }
        }

    } else if (navigator.clipboard) {

        try {
            await navigator.clipboard.writeText(texto);

            const textoOriginal = shareWrappedBtn.textContent;
            shareWrappedBtn.textContent = "Copied! ✓";

            setTimeout(() => {
                shareWrappedBtn.textContent = textoOriginal;
            }, 2000);

        } catch (erro) {
            console.error("Erro ao copiar texto:", erro);
            alert(texto);
        }

    } else {
        alert(texto);
    }

}

downloadWrappedBtn?.addEventListener("click", baixarWrappedPDF);
shareWrappedBtn?.addEventListener("click", compartilharWrapped);

loadMoreBtn?.addEventListener("click", () => {
    paginaAtual++;
    mostrarFilmes(listaAtual);
});

// Botão "View Details" do hero abre o modal do filme em destaque
heroButton?.addEventListener("click", () => {
    if (destaque) {
        abrirModal(destaque);
    }
});

// =======================================================
// CARROSSÉIS (Top Rated / Movies / TV Shows / Favorites)
// =======================================================

// Preenche um carrossel específico (pelo id do container) com uma
// lista de filmes, incluindo o skeleton loading de cada pôster
function criarCarousel(id, lista) {
    const container = document.getElementById(id);

    container.innerHTML = "";

    lista.forEach((filme, index) => {
        container.innerHTML += `
            <div class="poster-card skeleton-wrap" data-index="${index}">
                <img
                    src="${filme.poster}"
                    alt="${filme.Title}"
                    loading="lazy"
                    onload="this.parentElement.classList.add('loaded')"
                    onerror="this.onerror=null;this.src='assets/img/noposter.png';this.parentElement.classList.add('loaded');">
            </div>
        `;
    });

    container.querySelectorAll('.poster-card').forEach((card, index) => {
        card.addEventListener('click', () => {
            abrirModal(lista[index]);
        });
    });
}

// Recria o carrossel de favoritos — chamado após a importação e
// sempre que uma estrela é clicada, pra manter ele sincronizado
function atualizarCarouselFavoritos() {
    criarCarousel(
        "favoritesCarousel",
        filmesComNota.filter(f => favoritos.includes(f.Const))
    );
}

// =======================================================
// GRÁFICOS (Chart.js) — dashboard de analytics
// =======================================================

// Instâncias dos gráficos ficam em variáveis globais pra poderem ser
// destruídas e recriadas a cada nova importação, e atualizadas quando
// o tema muda
let typesChart;
let genresChart;
let ratingsChart;
let yearsChart;
let directorsChart;
let countriesChart;
let languagesChart;
let actorsChart;

// Top 8 gêneros mais frequentes na coleção
function criarGraficoGeneros() {

    const generos = {};

    filmesComNota.forEach(filme => {
        if (!filme.Genres) return;
        filme.Genres.split(",").forEach(genero => {
            genero = genero.trim();
            generos[genero] = (generos[genero] || 0) + 1;
        });
    });

    const top = Object.entries(generos)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    if (genresChart) {
        genresChart.destroy();
    }

    const ctx = document.getElementById("genresChart").getContext("2d");

    genresChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: top.map(g => g[0]),
            datasets: [{
                label: "Movies",
                data: top.map(g => g[1]),
                backgroundColor: "#FFD54A",
                borderRadius: 8
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: corGraficoTexto() },
                    grid: { color: corGraficoGrade() }
                },
                y: {
                    ticks: { color: corGraficoTexto() },
                    grid: { display: false }
                }
            }
        }
    });

}

// Distribuição de notas do IMDb (quantos filmes por faixa de nota)
function criarGraficoNotas() {

    const notas = {};

    filmesComNota.forEach(filme => {
        const nota = Math.floor(Number(filme["IMDb Rating"]));
        notas[nota] = (notas[nota] || 0) + 1;
    });

    const labels = Object.keys(notas).sort((a, b) => b - a);
    const valores = labels.map(label => notas[label]);

    if (ratingsChart) {
        ratingsChart.destroy();
    }

    const ctx = document.getElementById("ratingsChart").getContext("2d");

    ratingsChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                data: valores,
                backgroundColor: "#FFD54A",
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: corGraficoTexto() },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: corGraficoTexto() },
                    grid: { color: corGraficoGrade() }
                }
            }
        }
    });

}

// Quantidade de títulos lançados por ano
function criarGraficoAnos() {

    const anos = {};

    filmesComNota.forEach(filme => {
        const ano = Number(filme.Year);
        if (!isNaN(ano)) {
            anos[ano] = (anos[ano] || 0) + 1;
        }
    });

    const labels = Object.keys(anos).sort((a, b) => a - b);
    const valores = labels.map(label => anos[label]);

    if (yearsChart) {
        yearsChart.destroy();
    }

    const ctx = document.getElementById("yearsChart").getContext("2d");

    yearsChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Titles",
                data: valores,
                borderColor: "#FFD54A",
                backgroundColor: "rgba(255,213,74,.15)",
                fill: true,
                tension: .35,
                pointBackgroundColor: "#FFD54A",
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: corGraficoTexto() },
                    grid: { color: corGraficoGrade() }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: corGraficoTexto() },
                    grid: { color: corGraficoGrade() }
                }
            }
        }
    });

}

// Top 5 diretores com mais títulos na coleção
function criarGraficoDiretores() {

    const diretores = {};

    filmesComNota.forEach(filme => {
        if (!filme.director) return;
        diretores[filme.director] = (diretores[filme.director] || 0) + 1;
    });

    const top = Object.entries(diretores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const labels = top.map(item => item[0]);
    const valores = top.map(item => item[1]);

    if (directorsChart) {
        directorsChart.destroy();
    }

    const ctx = document.getElementById("directorsChart").getContext("2d");

    directorsChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                data: valores,
                backgroundColor: "#FFD54A",
                borderRadius: 8
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: corGraficoTexto() },
                    grid: { color: corGraficoGrade() }
                },
                y: {
                    ticks: { color: corGraficoTexto() },
                    grid: { display: false }
                }
            }
        }
    });

}

// Top 8 países de produção mais frequentes
function criarGraficoPaises() {

    const paises = {};

    filmesComNota.forEach(filme => {
        if (!filme.country) return;
        paises[filme.country] = (paises[filme.country] || 0) + 1;
    });

    const top = Object.entries(paises)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const labels = top.map(item => item[0]);
    const valores = top.map(item => item[1]);

    if (countriesChart) {
        countriesChart.destroy();
    }

    const ctx = document.getElementById("countriesChart").getContext("2d");

    countriesChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                data: valores,
                backgroundColor: "#FFD54A",
                borderRadius: 8
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: corGraficoTexto() },
                    grid: { color: corGraficoGrade() }
                },
                y: {
                    ticks: { color: corGraficoTexto() },
                    grid: { display: false }
                }
            }
        }
    });

}

// Top 8 idiomas mais frequentes
function criarGraficoIdiomas() {

    const idiomas = {};

    filmesComNota.forEach(filme => {
        if (!filme.language) return;
        idiomas[filme.language] = (idiomas[filme.language] || 0) + 1;
    });

    const top = Object.entries(idiomas)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const labels = top.map(item => item[0]);
    const valores = top.map(item => item[1]);

    if (languagesChart) {
        languagesChart.destroy();
    }

    const ctx = document.getElementById("languagesChart").getContext("2d");

    languagesChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                data: valores,
                backgroundColor: "#FFD54A",
                borderRadius: 8
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: corGraficoTexto() },
                    grid: { color: corGraficoGrade() }
                },
                y: {
                    ticks: { color: corGraficoTexto() },
                    grid: { display: false }
                }
            }
        }
    });

}

// Top 10 atores mais recorrentes no elenco
function criarGraficoAtores() {

    const atores = {};

    filmesComNota.forEach(filme => {
        if (!filme.cast) return;
        filme.cast.forEach(nome => {
            atores[nome] = (atores[nome] || 0) + 1;
        });
    });

    const top = Object.entries(atores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const labels = top.map(a => a[0]);
    const valores = top.map(a => a[1]);

    if (actorsChart) {
        actorsChart.destroy();
    }

    const ctx = document.getElementById("actorsChart").getContext("2d");

    actorsChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                data: valores,
                backgroundColor: "#FFD54A",
                borderRadius: 10
            }]
        },
        options: {
            responsive: true,
            indexAxis: "y",
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { ticks: { color: corGraficoTexto() } },
                y: { ticks: { color: corGraficoTexto() } }
            }
        }
    });

}

// Gráfico de rosca: proporção de filmes vs séries de TV
function criarGraficos() {

    const movies = filmesComNota.filter(f => {
        const tipo = String(f["Title Type"] || "").toLowerCase();
        return (
            tipo.includes("movie") ||
            tipo.includes("filme") ||
            tipo.includes("feature")
        );
    }).length;

    const series = filmesComNota.filter(f => {
        const tipo = String(f["Title Type"] || "").toLowerCase();
        return (
            tipo.includes("tv") ||
            tipo.includes("series") ||
            tipo.includes("série")
        );
    }).length;

    if (typesChart) {
        typesChart.destroy();
    }

    const ctx = document.getElementById("typesChart").getContext("2d");

    typesChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["Movies", "TV Shows"],
            datasets: [{
                data: [movies, series],
                backgroundColor: ["#FFD54A", "#4A90E2"],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: corGraficoTexto(),
                        font: { size: 14 }
                    }
                }
            }
        }
    });

}

// =======================================================
// BARRA DE CARREGAMENTO
// =======================================================

function mostrarLoading(texto) {
    loading.classList.remove("hidden");
    progress.style.width = "0%";
    loadingText.style.color = "#8f8f8f";
    loadingText.textContent = texto;
    progress.style.background = "#FFD54A";
}

function atualizarLoading(atual, total, texto = "Importing movies...") {
    const porcentagem = (atual / total) * 100;
    progress.style.width = porcentagem + "%";
    loadingText.textContent = `${texto} (${atual}/${total})`;
}

function esconderLoading() {
    loading.classList.add("hidden");
}

// =======================================================
// INTEGRAÇÃO COM A API DO TMDb
// =======================================================

// Busca os dados de um filme/série no TMDb a partir da linha do CSV.
// Tenta primeiro pelo ID do IMDb (mais preciso); se não encontrar,
// cai pra busca por nome (filme, depois série).
async function buscarFilmeTMDB(filme) {

    // Garante que "backdrop" sempre exista como string, mesmo se a busca
    // falhar completamente — o bug real por trás do erro "GET .../undefined"
    // no console: quando nenhum resultado era encontrado, filme.backdrop
    // nunca era definido (ficava undefined de verdade), e o Image() do
    // banner tentava carregar a string "undefined" como se fosse uma URL.
    filme.backdrop = filme.backdrop || "";

    try {
        let resposta = await fetch(
            `https://api.themoviedb.org/3/find/${filme.Const}?api_key=${API_KEY}&external_source=imdb_id`
        );

        let dados = await resposta.json();
        let resultado = null;
        let tipo = null;

        if (dados.movie_results.length > 0) {
            resultado = dados.movie_results[0];
            tipo = "movie";
        } else if (dados.tv_results.length > 0) {
            resultado = dados.tv_results[0];
            tipo = "tv";
        }

        if (!resultado) {
            resposta = await fetch(
                `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(filme.Title)}`
            );
            dados = await resposta.json();
            if (dados.results.length > 0) {
                resultado = dados.results[0];
                tipo = "movie";
            }
        }

        if (!resultado) {
            resposta = await fetch(
                `https://api.themoviedb.org/3/search/tv?api_key=${API_KEY}&query=${encodeURIComponent(filme.Title)}`
            );
            dados = await resposta.json();
            if (dados.results.length > 0) {
                resultado = dados.results[0];
                tipo = "tv";
            }
        }

        if (resultado && tipo) {

            filme.tmdbId = resultado.id;
            filme.mediaType = tipo;

            filme.backdrop = resultado.backdrop_path
                ? `https://image.tmdb.org/t/p/original${resultado.backdrop_path}`
                : "";

            filme.overview = resultado.overview;

            filme.year =
                resultado.release_date
                    ? resultado.release_date.substring(0,4)
                    : resultado.first_air_date?.substring(0,4);

            filme.vote = resultado.vote_average;

            // Detalhes e créditos (elenco/diretor) não dependem um do
            // outro, então buscamos os dois em paralelo — economiza
            // uma viagem de rede inteira por filme
            const [detalhes, respostaCreditos] = await Promise.all([
                fetch(`https://api.themoviedb.org/3/${tipo}/${resultado.id}?api_key=${API_KEY}`),
                fetch(`https://api.themoviedb.org/3/${tipo}/${resultado.id}/credits?api_key=${API_KEY}`)
            ]);

            // Às vezes o ID que o TMDb devolveu no passo anterior está
            // quebrado (não existe mais como esse tipo) e essas duas
            // buscas voltam 404 — nesse caso não tenta processar o corpo
            // da resposta, só segue com os valores padrão de fallback
            if (!detalhes.ok || !respostaCreditos.ok) {
                filme.poster = filme.poster || "assets/img/noposter.png";
                filme.overview = filme.overview || "Overview not available.";
                filme.genres = filme.genres || "N/A";
                filme.director = "Unknown";
                filme.cast = [];
                filme.URL = filme.Const ? `https://www.imdb.com/title/${filme.Const}` : "#";
                return;
            }

            const [info, creditos] = await Promise.all([
                detalhes.json(),
                respostaCreditos.json()
            ]);

            filme.poster = info.poster_path
                ? `https://image.tmdb.org/t/p/w500${info.poster_path}`
                : "assets/img/noposter.png";

            filme.backdrop = info.backdrop_path
                ? `https://image.tmdb.org/t/p/original${info.backdrop_path}`
                : filme.backdrop || "";

            filme.country = info.production_countries?.[0]?.name || "Unknown";
            filme.language = info.spoken_languages?.[0]?.english_name || "Unknown";
            filme.overview = info.overview;

            // Séries de TV não têm "runtime" — o campo certo é
            // "episode_run_time" (um array com a duração dos episódios)
            filme.runtime =
                info.runtime ||
                (Array.isArray(info.episode_run_time) && info.episode_run_time[0]) ||
                filme.runtime ||
                0;

            filme.release = info.release_date || info.first_air_date;
            filme.voteCount = info.vote_count || filme.voteCount || 0;
            filme.popularity = info.popularity || filme.popularity || 0;
            filme.genres = info.genres && info.genres.length
                ? info.genres.map(g => g.name).join(", ")
                : filme.genres || "N/A";

            const diretor = creditos.crew?.find(pessoa => pessoa.job === "Director");
            filme.director = diretor ? diretor.name : "Unknown";

            filme.cast = Array.isArray(creditos.cast)
                ? creditos.cast.slice(0, 5).map(ator => ator.name)
                : [];

            filme.URL = filme.Const ? `https://www.imdb.com/title/${filme.Const}` : "#";

        } else {
            // Nenhum resultado encontrado no TMDb — segue com valores
            // padrão pra não travar a importação
            filme.poster = filme.poster || "assets/img/noposter.png";
            filme.overview = filme.overview || "Overview not available.";
            filme.genres = filme.genres || "N/A";
            filme.URL = filme.Const ? `https://www.imdb.com/title/${filme.Const}` : "#";
        }
    } catch (erro) {
        console.error(erro);
        filme.poster = filme.poster || "assets/img/noposter.png";
        filme.overview = filme.overview || "Overview not available.";
        filme.genres = filme.genres || "N/A";
        filme.URL = filme.Const ? `https://www.imdb.com/title/${filme.Const}` : "#";
    }
}

// Busca o link do trailer oficial (YouTube) de um filme/série já
// identificado no TMDb
async function buscarTrailer(filme){

    if (!filme || !filme.tmdbId || !filme.mediaType) {
        return null;
    }

    try {
        const resposta = await fetch(
            `https://api.themoviedb.org/3/${filme.mediaType}/${filme.tmdbId}/videos?api_key=${API_KEY}`
        );

        if (!resposta.ok) {
            console.warn('TMDb videos fetch failed', resposta.status);
            return null;
        }

        const dados = await resposta.json();

        if (!dados || !Array.isArray(dados.results)) return null;

        const trailer = dados.results.find(video =>
            video.type === "Trailer" &&
            video.site === "YouTube"
        );

        if (trailer) return `https://www.youtube.com/embed/${trailer.key}`;
    } catch (e) {
        console.error('buscarTrailer error', e);
    }

    return null;

}

// =======================================================
// UPLOAD E IMPORTAÇÃO DO CSV
// =======================================================

uploadBtn.addEventListener("click", () => {
    csvFile.click();
});

csvFile.addEventListener("change", () => {

    const arquivo = csvFile.files[0];

    if (!arquivo) return;

    hero.classList.add("hidden");
    // Reseta o skeleton do banner pra ele reaparecer nas fotos de um
    // novo CSV (senão só funcionaria na primeira importação)
    heroSkeleton?.classList.remove("loaded");
    ranking.classList.add("hidden");
    document.body.classList.remove("ranking-active");

    mostrarLoading("Reading IMDb List...");

    viewRanking.disabled = true;
    // Uma nova importação invalida o resumo Wrapped e a biblioteca anteriores
    if (wrappedBtn) wrappedBtn.disabled = true;
    if (libraryBtn) libraryBtn.disabled = true;

    fileName.textContent = arquivo.name;
    searchMovie.value = "";

    // Reseta o filtro ativo pra "All" a cada nova importação, tanto na
    // lógica quanto visualmente no botão
    filtroAtual = "all";
    document.querySelector(".filter-btn.active")?.classList.remove("active");
    document.querySelector('.filter-btn[data-filter="all"]')?.classList.add("active");

    const leitor = new FileReader();

    leitor.onload = () => {

        atualizarLoading(50, 100, "Processing Movies...");

        Papa.parse(leitor.result, {

            header: true,

            complete: async function (resultado) {

                filmesComNota = resultado.data.filter(
                    filme => filme["IMDb Rating"]
                );

                filmesComNota.sort((a, b) => {
                    return Number(b["IMDb Rating"]) - Number(a["IMDb Rating"]);
                });

                const total = filmesComNota.length;

                // Busca os dados de todos os filmes em paralelo, usando
                // um pool de "workers": cada um pega o próximo filme da
                // fila assim que termina o anterior. Isso acelera muito
                // a importação em listas grandes, sem perder a ordem
                // (cada filme é atualizado por referência no array).
                const CONCORRENCIA = 16;
                let indiceFila = 0;
                let concluidos = 0;

                async function workerImportacao() {
                    while (indiceFila < total) {
                        const i = indiceFila++;
                        await buscarFilmeTMDB(filmesComNota[i]);
                        concluidos++;
                        atualizarLoading(concluidos, total, "Importing movies...");
                    }
                }

                await Promise.all(
                    Array.from(
                        { length: Math.min(CONCORRENCIA, total) },
                        () => workerImportacao()
                    )
                );

                // Com os dados prontos, monta o resto da tela de ranking
                atualizarEstatisticas();
                criarGraficos();
                criarGraficoGeneros();
                criarGraficoNotas();
                criarGraficoAnos();
                criarGraficoDiretores();
                criarGraficoPaises();
                criarGraficoIdiomas();
                criarGraficoAtores();

                criarCarousel(
                    "topRatedCarousel",
                    filmesComNota
                        .filter(f => Number(f["IMDb Rating"]) >= 9)
                        .slice(0, 15)
                );

                criarCarousel(
                    "moviesCarousel",
                    filmesComNota
                        .filter(f => {
                            const tipo = String(f["Title Type"] || "").toLowerCase();
                            return (
                                tipo.includes("movie") ||
                                tipo.includes("filme") ||
                                tipo.includes("feature")
                            );
                        })
                        .slice(0, 15)
                );

                criarCarousel(
                    "tvCarousel",
                    filmesComNota
                        .filter(f => {
                            const tipo = String(f["Title Type"] || "").toLowerCase();
                            return (
                                tipo.includes("tv") ||
                                tipo.includes("series") ||
                                tipo.includes("série")
                            );
                        })
                        .slice(0, 15)
                );

                atualizarCarouselFavoritos();

                // Liga o banner giratório com os primeiros destaques
                iniciarHero();

                atualizarLoading(
                    total,
                    total,
                    `${filmesComNota.length} movies imported successfully ✓`
                );

                viewRanking.disabled = false;
                // Só libera o Wrapped e a Library se realmente importou algum filme
                if (wrappedBtn) wrappedBtn.disabled = filmesComNota.length === 0;
                if (libraryBtn) libraryBtn.disabled = filmesComNota.length === 0;

                setTimeout(() => {
                    esconderLoading();
                }, 1500);

            }

        });

    };

    leitor.readAsText(arquivo);

});

// =======================================================
// PESQUISA E NAVEGAÇÃO ENTRE TELAS
// =======================================================

searchMovie.addEventListener("input", () => {
    paginaAtual = 1;
    aplicarFiltro();
});

viewRanking.addEventListener("click", () => {

    // Reaplica o filtro/pesquisa atual em vez de sempre mostrar tudo,
    // pra respeitar o que o usuário já tinha selecionado
    aplicarFiltro();

    home.classList.add("hidden");
    hero.classList.remove("hidden");
    wrappedModal.classList.add("hidden");
    libraryModal?.classList.add("hidden");
    reviewsModal?.classList.add("hidden");

    ranking.classList.remove("hidden");
    document.body.classList.add("ranking-active");

});

// =======================================================
// ESTATÍSTICAS (cards no topo do ranking)
// =======================================================

function atualizarEstatisticas() {

    const total = filmesComNota.length;

    if (total === 0) return;

    const media =
        filmesComNota.reduce((soma, filme) => {
            return soma + Number(filme["IMDb Rating"]);
        }, 0) / total;

    const anos = filmesComNota
        .map(f => Number(f.Year))
        .filter(ano => !isNaN(ano));

    const menorAno = Math.min(...anos);
    const maiorAno = Math.max(...anos);

    // Usa String(...) com fallback pra não quebrar quando "Title Type"
    // vier vazio em alguma linha do CSV
    const movies = filmesComNota.filter(f => {
        const tipo = String(f["Title Type"] || "").toLowerCase();
        return tipo.includes("movie") || tipo.includes("filme");
    }).length;

    const series = filmesComNota.filter(f => {
        const tipo = String(f["Title Type"] || "").toLowerCase();
        return (
            tipo.includes("tv") ||
            tipo.includes("series") ||
            tipo.includes("série")
        );
    }).length;

    const totalMinutos = filmesComNota.reduce((tot, filme) => {
        return tot + Number(filme.runtime || 0);
    }, 0);

    const mediaRuntime = total > 0 ? Math.round(totalMinutos / total) : 0;
    const horas = Math.floor(totalMinutos / 60);
    const dias = (horas / 24).toFixed(1);

    document.getElementById("totalMovies").textContent = total;
    document.getElementById("averageRating").textContent = media.toFixed(2);
    document.getElementById("yearRange").textContent = `${menorAno} - ${maiorAno}`;
    document.getElementById("tvShows").textContent = series;
    document.getElementById("averageRuntime").textContent = `${mediaRuntime} min`;
    document.getElementById("totalRuntime").textContent = `${horas} h`;
    document.getElementById("watchDays").textContent = `${dias} days`;
    document.getElementById("movies").textContent = movies;
}

// =======================================================
// FILTROS (All / Movies / TV Shows / Top Rated / Favorites)
// =======================================================

// Aplica o filtro ativo + a pesquisa digitada juntos, sempre que um
// dos dois muda — assim buscar "Favorites" com um filtro de gênero
// aplicado busca só dentro daquele filtro, não na lista inteira
function aplicarFiltro() {

    let lista = [...filmesComNota];

    paginaAtual = 1;

    switch (filtroAtual) {

        case "movie":
            lista = lista.filter(f => {
                const tipo = (f["Title Type"] || "").toLowerCase();
                return tipo.includes("movie") || tipo.includes("filme");
            });
            break;

        case "tv":
            lista = lista.filter(f => {
                const tipo = (f["Title Type"] || "").toLowerCase();
                return (
                    tipo.includes("tv") ||
                    tipo.includes("series") ||
                    tipo.includes("série")
                );
            });
            break;

        case "top":
            lista = lista.filter(f => Number(f["IMDb Rating"]) >= 9);
            break;

        case "favorites":
            lista = lista.filter(f => favoritos.includes(f.Const));
            break;

        case "all":
        default:
            break;

    }

    const pesquisa = (searchMovie.value || "").toLowerCase();

    if (pesquisa) {
        lista = lista.filter(f =>
            (f.Title || "").toLowerCase().includes(pesquisa)
        );
    }

    mostrarFilmes(lista);

}

const botoesFiltro = document.querySelectorAll(".filter-btn");

botoesFiltro.forEach(botao => {
    botao.addEventListener("click", () => {

        document
            .querySelector(".filter-btn.active")
            ?.classList.remove("active");

        botao.classList.add("active");

        filtroAtual = botao.dataset.filter;

        aplicarFiltro();

    });
});

// =======================================================
// MODAL DE DETALHES DO FILME — avaliação pessoal (estrelas + comentário)
// =======================================================

// Avaliações salvas no navegador, indexadas pelo Const (ID do IMDb) —
// cada uma guarda { estrelas, comentario, titulo, poster, data }
let avaliacoesUsuario = JSON.parse(
    localStorage.getItem("cinerank-avaliacoes")
) || {};

function salvarAvaliacoesNoStorage() {
    localStorage.setItem(
        "cinerank-avaliacoes",
        JSON.stringify(avaliacoesUsuario)
    );
}

// Filme atualmente aberto no modal — usado pra saber onde salvar
// quando o botão "Save Review" é clicado
let filmeModalAtual = null;

// Quantas estrelas estão selecionadas no formulário no momento
// (cada estrela vale 2 pontos: 1★=2, 2★=4 ... 5★=10)
let estrelasSelecionadas = 0;

// Pinta as estrelas do formulário de avaliação até o valor indicado
function renderizarEstrelasInput(valor) {
    ratingStarsInput.querySelectorAll(".star-btn").forEach(btn => {
        const v = Number(btn.dataset.value);
        const preenchida = v <= valor;
        btn.textContent = preenchida ? "★" : "☆";
        btn.classList.toggle("filled", preenchida);
    });
}

// Atualiza a exibição "Your Rating" (estrelas de leitura + nota) e
// prepara o formulário com o que já foi salvo pra esse filme, se houver
function carregarAvaliacao(filme) {

    const salva = avaliacoesUsuario[filme.Const];

    const estrelas = salva?.estrelas || 0;

    ratingStarsDisplay.textContent =
        "★".repeat(estrelas) + "☆".repeat(5 - estrelas);

    ratingScoreDisplay.textContent = `${estrelas * 2} / 10`;

    rateBtn.textContent = salva ? "Edit Rating" : "Rate";

    // Sempre começa com o formulário fechado ao abrir um filme
    ratingForm.classList.add("hidden");

    estrelasSelecionadas = estrelas;
    renderizarEstrelasInput(estrelasSelecionadas);

    ratingComment.value = salva?.comentario || "";
    ratingCommentCount.textContent = ratingComment.value.length;

}

rateBtn?.addEventListener("click", () => {
    ratingForm.classList.toggle("hidden");
});

// Clique numa estrela do formulário define a nota (com pré-visualização
// ao passar o mouse, revertendo pro valor selecionado ao tirar o mouse)
ratingStarsInput?.querySelectorAll(".star-btn").forEach(btn => {

    const valor = Number(btn.dataset.value);

    btn.addEventListener("mouseenter", () => {
        renderizarEstrelasInput(valor);
    });

    btn.addEventListener("mouseleave", () => {
        renderizarEstrelasInput(estrelasSelecionadas);
    });

    btn.addEventListener("click", () => {
        estrelasSelecionadas = valor;
        renderizarEstrelasInput(estrelasSelecionadas);
    });

});

// Contador de caracteres do comentário (limite de 300)
ratingComment?.addEventListener("input", () => {
    ratingCommentCount.textContent = ratingComment.value.length;
});

saveRatingBtn?.addEventListener("click", () => {

    if (!filmeModalAtual) return;

    // Preserva a data original se já existia uma avaliação anterior
    // pra esse filme (editar não deve mudar quando ela foi feita)
    const avaliacaoAnterior = avaliacoesUsuario[filmeModalAtual.Const];

    avaliacoesUsuario[filmeModalAtual.Const] = {
        estrelas: estrelasSelecionadas,
        comentario: ratingComment.value.trim(),
        titulo: filmeModalAtual.Title,
        poster: filmeModalAtual.poster,
        data: avaliacaoAnterior?.data || new Date().toISOString().slice(0, 10)
    };

    salvarAvaliacoesNoStorage();

    carregarAvaliacao(filmeModalAtual);
    ratingForm.classList.add("hidden");

});

// =======================================================
// TELA "MY REVIEWS" (lista de todas as avaliações feitas)
// =======================================================

// Qual avaliação está com o formulário de edição aberto no momento
// (só uma por vez, pra não bagunçar a tela)
let reviewEmEdicaoId = null;

// Monta a lista de avaliações (ou o estado vazio) dentro do modal
function renderizarMinhasAvaliacoes() {

    const ids = Object.keys(avaliacoesUsuario);

    if (ids.length === 0) {

        reviewsContainer.innerHTML = `
            <div class="reviews-empty">
                <div class="reviews-empty-icon">🎬</div>
                <p>You haven't reviewed any movies yet.</p>
                <button type="button" id="browseMoviesBtn" class="btn browse-movies-btn">
                    Browse Movies
                </button>
            </div>
        `;

        document.getElementById("browseMoviesBtn")?.addEventListener("click", () => {
            reviewsModal.classList.add("hidden");
            if (!viewRanking.disabled) {
                viewRanking.click();
            }
        });

        return;

    }

    // Mais recentes primeiro
    const ordenadas = ids
        .map(id => ({ id, ...avaliacoesUsuario[id] }))
        .sort((a, b) => (b.data || "").localeCompare(a.data || ""));

    reviewsContainer.innerHTML = ordenadas.map(review => {

        const estrelas = "★".repeat(review.estrelas || 0) + "☆".repeat(5 - (review.estrelas || 0));
        const poster = review.poster || "assets/img/noposter.png";
        const emEdicao = reviewEmEdicaoId === review.id;

        return `
            <div class="review-card" data-id="${review.id}">

                <div class="review-poster">
                    <img src="${poster}" alt="${review.titulo}" onerror="this.onerror=null;this.src='assets/img/noposter.png';">
                </div>

                <div class="review-info">
                    <h2 class="review-movie-title">${review.titulo || "Untitled"}</h2>
                    <div class="review-stars">${estrelas}</div>
                    ${review.data ? `<span class="review-date">${review.data}</span>` : ""}
                    <p class="review-comment">${review.comentario ? review.comentario : "<em>No comment written.</em>"}</p>

                    <div class="review-actions">
                        <button type="button" class="review-action-btn edit-review-btn" data-id="${review.id}">
                            Edit Review
                        </button>
                        <button type="button" class="review-action-btn delete delete-review-btn" data-id="${review.id}">
                            Delete
                        </button>
                    </div>

                    ${emEdicao ? `
                    <div class="review-edit-form">
                        <div class="stars-input review-edit-stars" data-id="${review.id}">
                            <button type="button" class="star-btn" data-value="1">${review.estrelas >= 1 ? "★" : "☆"}</button>
                            <button type="button" class="star-btn" data-value="2">${review.estrelas >= 2 ? "★" : "☆"}</button>
                            <button type="button" class="star-btn" data-value="3">${review.estrelas >= 3 ? "★" : "☆"}</button>
                            <button type="button" class="star-btn" data-value="4">${review.estrelas >= 4 ? "★" : "☆"}</button>
                            <button type="button" class="star-btn" data-value="5">${review.estrelas >= 5 ? "★" : "☆"}</button>
                        </div>
                        <textarea maxlength="300" class="review-edit-comment">${review.comentario || ""}</textarea>
                        <div class="review-edit-actions">
                            <button type="button" class="review-save-btn" data-id="${review.id}">Save Review</button>
                            <button type="button" class="review-cancel-btn" data-id="${review.id}">Cancel</button>
                        </div>
                    </div>
                    ` : ""}

                </div>

            </div>
        `;

    }).join("");

    ligarEventosDosReviews();

}

// Liga os cliques dos botões de cada card (edit/delete/save/cancel e
// as estrelas do formulário de edição) — chamado toda vez que a lista
// é redesenhada, já que o HTML é recriado do zero
function ligarEventosDosReviews() {

    reviewsContainer.querySelectorAll(".edit-review-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            reviewEmEdicaoId = btn.dataset.id;
            renderizarMinhasAvaliacoes();
        });
    });

    reviewsContainer.querySelectorAll(".review-cancel-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            reviewEmEdicaoId = null;
            renderizarMinhasAvaliacoes();
        });
    });

    reviewsContainer.querySelectorAll(".delete-review-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const confirmou = confirm("Delete this review? This can't be undone.");
            if (!confirmou) return;

            delete avaliacoesUsuario[btn.dataset.id];
            salvarAvaliacoesNoStorage();
            reviewEmEdicaoId = null;
            renderizarMinhasAvaliacoes();
        });
    });

    // Estrelas clicáveis dentro do formulário de edição de cada card
    reviewsContainer.querySelectorAll(".review-edit-stars").forEach(grupo => {

        const id = grupo.dataset.id;

        grupo.querySelectorAll(".star-btn").forEach(estrela => {
            estrela.addEventListener("click", () => {

                const valor = Number(estrela.dataset.value);

                grupo.querySelectorAll(".star-btn").forEach(e => {
                    e.textContent = Number(e.dataset.value) <= valor ? "★" : "☆";
                });

                grupo.dataset.selecionado = valor;

            });
        });

    });

    reviewsContainer.querySelectorAll(".review-save-btn").forEach(btn => {
        btn.addEventListener("click", () => {

            const id = btn.dataset.id;
            const card = btn.closest(".review-card");

            const grupoEstrelas = card.querySelector(".review-edit-stars");
            const novaNota = grupoEstrelas.dataset.selecionado
                ? Number(grupoEstrelas.dataset.selecionado)
                : (avaliacoesUsuario[id]?.estrelas || 0);

            const novoComentario = card.querySelector(".review-edit-comment").value.trim();

            avaliacoesUsuario[id] = {
                ...avaliacoesUsuario[id],
                estrelas: novaNota,
                comentario: novoComentario
            };

            salvarAvaliacoesNoStorage();
            reviewEmEdicaoId = null;
            renderizarMinhasAvaliacoes();

        });
    });

}

// Abre/fecha o modal do "My Reviews" (clique no botão, no X, ou fora do card)
myReviewsBtn?.addEventListener("click", () => {
    reviewEmEdicaoId = null;
    renderizarMinhasAvaliacoes();
    reviewsModal.classList.remove("hidden");
});

closeReviews?.addEventListener("click", () => {
    reviewsModal.classList.add("hidden");
});

reviewsModal?.addEventListener("click", (e) => {
    if (e.target === reviewsModal) {
        reviewsModal.classList.add("hidden");
    }
});

async function abrirModal(filme){

    // Guarda qual filme está aberto agora, pra saber onde salvar a
    // avaliação quando o usuário clicar em "Salvar"
    filmeModalAtual = filme;
    carregarAvaliacao(filme);

    // Skeleton (shimmer) enquanto o pôster desse filme específico carrega
    const modalPosterWrap = modalPoster.parentElement;
    modalPosterWrap.classList.add("skeleton-wrap");
    modalPosterWrap.classList.remove("loaded");

    modalPoster.onload = () => {
        modalPosterWrap.classList.add("loaded");
    };
    modalPoster.onerror = () => {
        modalPoster.onerror = null;
        modalPoster.src = "assets/img/noposter.png";
        modalPosterWrap.classList.add("loaded");
    };
    modalPoster.src = filme.poster;

    modalTitle.textContent = filme.Title;
    modalRating.textContent = `⭐ ${filme["IMDb Rating"]}`;
    modalYear.textContent = `📅 ${filme.Year}`;
    modalGenre.textContent = `🎭 ${filme.Genres || "N/A"}`;
    modalRuntime.textContent = filme.runtime ? `⏱ ${filme.runtime} min` : "";
    modalOverview.textContent = filme.overview || "Overview not available.";
    modalIMDb.href = filme.URL;

    const botaoTrailer = document.getElementById("watchTrailer");
    if (botaoTrailer) botaoTrailer.style.display = "none";

    try {
        const trailer = await buscarTrailer(filme);

        if (trailer && botaoTrailer) {
            botaoTrailer.style.display = "inline-flex";
            botaoTrailer.onclick = () => {
                const tc = document.getElementById("trailerContainer");
                const tf = document.getElementById("trailerFrame");
                if (tc) tc.classList.remove("hidden");
                if (tf) tf.src = trailer;
            };
        } else if (botaoTrailer) {
            botaoTrailer.style.display = "none";
        }
    } catch (e) {
        console.error('abrirModal trailer error', e);
        if (botaoTrailer) botaoTrailer.style.display = "none";
    }

    modal.classList.remove("hidden");

}

closeModal.addEventListener("click", () => {

    modal.classList.add("hidden");

    const tc = document.getElementById("trailerContainer");
    if (tc) tc.classList.add("hidden");
    const tf = document.getElementById("trailerFrame");
    if (tf) tf.src = "";

});

// Clicar fora do card (no fundo escuro) também fecha o modal
modal.addEventListener("click", (e) => {
    if (e.target === modal) {
        closeModal.click();
    }
});

if (wrappedBtn) {
    wrappedBtn.addEventListener("click", event => {
        event.preventDefault();
        if (!wrappedContainer) {
            console.error("Wrapped container missing");
            return;
        }
        abrirWrapped();
    });
} else {
    console.warn("wrappedBtn not found");
}

if (closeWrapped) {
    closeWrapped.addEventListener("click", event => {
        event.preventDefault();
        wrappedModal?.classList.add("hidden");
    });
} else {
    console.warn("closeWrapped not found");
}

// Clicar fora do card do Wrapped também fecha
wrappedModal?.addEventListener("click", (e) => {
    if (e.target === wrappedModal) {
        wrappedModal.classList.add("hidden");
    }
});

// Tecla Esc fecha qualquer modal aberto (filme, Wrapped, Library ou Reviews)
document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!modal.classList.contains("hidden")) closeModal.click();
    if (!wrappedModal?.classList.contains("hidden")) wrappedModal.classList.add("hidden");
    if (!libraryModal?.classList.contains("hidden")) libraryModal.classList.add("hidden");
    if (!reviewsModal?.classList.contains("hidden")) reviewsModal.classList.add("hidden");
});

// =======================================================
// NAVEGAÇÃO DO BANNER (bolinhas, setas e troca automática)
// =======================================================

let indiceHero = 0;
let heroIntervalId = null;
const HERO_INTERVAL_MS = 8000;

// Cria uma bolinha indicadora por filme em destaque (até 10)
function criarDotsHero(total) {

    if (!heroDots) return;

    heroDots.innerHTML = "";

    for (let i = 0; i < total; i++) {

        const dot = document.createElement("button");

        dot.className = "hero-dot" + (i === 0 ? " active" : "");
        dot.type = "button";
        dot.setAttribute("aria-label", `Go to highlight ${i + 1}`);

        dot.addEventListener("click", () => {
            irParaHero(i);
        });

        heroDots.appendChild(dot);

    }

}

// Marca visualmente qual bolinha corresponde ao filme atual
function atualizarDotsHero() {

    if (!heroDots) return;

    heroDots.querySelectorAll(".hero-dot").forEach((dot, i) => {
        dot.classList.toggle("active", i === indiceHero);
    });

}

// Reinicia a contagem de 8s — chamado após navegação manual, pra ela
// não "brigar" com a troca automática logo em seguida
function reiniciarIntervaloHero() {

    if (heroIntervalId) clearInterval(heroIntervalId);

    const total = Math.min(10, filmesComNota.length);
    if (total <= 1) return;

    heroIntervalId = setInterval(() => {

        indiceHero = (indiceHero + 1) % total;

        atualizarHero(filmesComNota[indiceHero]);
        atualizarDotsHero();

    }, HERO_INTERVAL_MS);

}

// Navegação manual (clique nas setas ou nas bolinhas). Aceita índices
// fora do intervalo e "dá a volta" (ex: anterior do 0 vai pro último)
function irParaHero(indice) {

    const total = Math.min(10, filmesComNota.length);

    if (total === 0) return;

    indiceHero = ((indice % total) + total) % total;

    atualizarHero(filmesComNota[indiceHero]);
    atualizarDotsHero();

    reiniciarIntervaloHero();

}

heroPrev?.addEventListener("click", () => {
    irParaHero(indiceHero - 1);
});

heroNext?.addEventListener("click", () => {
    irParaHero(indiceHero + 1);
});

// Liga o banner: cria as bolinhas, mostra o primeiro destaque e começa
// a troca automática a cada 8 segundos
function iniciarHero() {

    if (filmesComNota.length === 0) return;

    const total = Math.min(10, filmesComNota.length);

    indiceHero = 0;

    criarDotsHero(total);

    atualizarHero(filmesComNota[indiceHero]);
    atualizarDotsHero();

    reiniciarIntervaloHero();

}