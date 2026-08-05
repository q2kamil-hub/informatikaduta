// script.js — header, footer, navigasi, breadcrumb, tombol scroll
// AI: Tidak menambah fitur di luar permintaan. Konsistensi antar halaman dijaga.
// encoding: UTF-8

(function() {
  "use strict";

  // --- DATA NAVIGASI UTAMA (nama file sudah diperbarui) ---
  const menuItems = [
    { label: "Teknologi Informasi dan Komunikasi", link: "tik.html" },
    { label: "Sistem Komputer", link: "sk.html" },
    { label: "Jaringan Komputer dan Internet", link: "jki.html" },
    { label: "Dampak Sosial Informatika", link: "dsi.html" },
    { label: "Analisis Data", link: "ad.html" },
    { label: "Berpikir Komputasional", link: "bk.html" },
    { label: "Algoritma Pemrograman", link: "ap.html" }
  ];

  // --- MAPPING HALAMAN UNTUK BREADCRUMB ---
  const pageTitles = {
    'index.html': 'Beranda',
    'tik.html': 'Teknologi Informasi dan Komunikasi',
    'sk.html': 'Sistem Komputer',
    'jki.html': 'Jaringan Komputer dan Internet',
    'dsi.html': 'Dampak Sosial Informatika',
    'ad.html': 'Analisis Data',
    'bk.html': 'Berpikir Komputasional',
    'ap.html': 'Algoritma Pemrograman'
  };

  // --- 1. HEADER (banner + navigasi) ---
  function renderHeader() {
    const headerEl = document.getElementById('header-utama');
    if (!headerEl) return;

    const bannerHTML = `
      <div class="banner">
        <h1>📡 Informatika DUTA</h1>
        <span class="sub">SMPN 2 Talegong</span>
      </div>
    `;

    let navHTML = `<nav class="nav-utama" aria-label="Menu utama">`;
    menuItems.forEach(item => {
      navHTML += `<a href="${item.link}">${item.label}</a>`;
    });
    navHTML += `</nav>`;

    headerEl.innerHTML = bannerHTML + navHTML;
  }

  // --- 2. FOOTER ---
  function renderFooter() {
    const footerEl = document.getElementById('footer-utama');
    if (!footerEl) return;

    const year = new Date().getFullYear();
    const publishDate = "2026-08-05";

    footerEl.innerHTML = `
      <div class="container" style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:0.5rem 1rem; padding:0.5rem 1rem;">
        <div>
          <span style="font-weight:600; color:#4d3829;">Kiki Husni Kamil, S.Pd.</span> · Guru Informatika
        </div>
        <div style="text-align:right;">
          <span>&copy; ${year} SMPN 2 Talegong</span><br>
          <span style="font-size:0.85rem; opacity:0.7;">Terbit: ${publishDate}</span>
        </div>
      </div>
    `;
  }

  // --- 3. BREADCRUMB (dinamis berdasarkan halaman) ---
  function renderBreadcrumb() {
    const container = document.getElementById('breadcrumb-container');
    if (!container) return;

    // Dapatkan nama file halaman saat ini
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Tentukan judul halaman saat ini
    let currentTitle = pageTitles[currentPage] || 'Informatika DUTA';
    
    // Untuk halaman kartu (jk1.html, bk1.html, dll)
    // Format: [kode]-[nomor].html
    const cardMatch = currentPage.match(/^([a-z]+)(\d+)\.html$/);
    if (cardMatch) {
      const code = cardMatch[1];
      const number = cardMatch[2];
      // Cari judul halaman induk berdasarkan kode
      const parentPage = code + '.html';
      const parentTitle = pageTitles[parentPage] || 'Konten';
      currentTitle = parentTitle + ' - Kartu ' + number;
    }

    let html = '';
    // Selalu tampilkan Beranda sebagai item pertama
    html += `<li><a href="index.html">Beranda</a></li>`;
    
    // Tampilkan halaman saat ini (tanpa link jika halaman saat ini)
    html += `<li>${currentTitle}</li>`;
    
    container.innerHTML = html;
  }

  // --- 4. TOMBOL FLOATING PANAH KE ATAS ---
  function initScrollButton() {
    const btn = document.getElementById('scrollTopBtn');
    if (!btn) return;

    function scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    btn.addEventListener('click', scrollToTop);
    btn.addEventListener('touchend', function(e) {
      e.preventDefault();
      scrollToTop();
    });

    function toggleVisibility() {
      if (window.scrollY > 120) {
        btn.style.display = 'flex';
      } else {
        btn.style.display = 'none';
      }
    }
    window.addEventListener('scroll', toggleVisibility);
    toggleVisibility();
  }

  // --- 5. EKSEKUSI SEMUA ---
  document.addEventListener('DOMContentLoaded', function() {
    renderHeader();
    renderFooter();
    renderBreadcrumb();
    initScrollButton();
  });

})();