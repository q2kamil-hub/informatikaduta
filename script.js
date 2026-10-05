// script.js — header, footer, tombol scroll, collapsible info, konfigurasi API global
// AI: Tidak menambah fitur di luar permintaan. Konsistensi antar halaman dijaga.
// encoding: UTF-8

(function() {
  "use strict";

  // ============================================
  // KONFIGURASI API GLOBAL
  // ============================================
  window.DUTA_API = {
    url: [
      'https://script.google.com/macros/s/',
      'AKfycbz8AIqbAznVwEUsebrRWLLN9MMrKSR9HP0bD1VR_BMDDLXIY9fPWu_ioYr4ZClLzSBU',
      '/exec'
    ].join('')
  };

  // ============================================
  // BOBOT NILAI (TERPUSAT — berlaku semua modul)
  // ============================================
  window.DUTA_BOBOT = {
    aktivitas: 0.5,
    kuis: 0.5
  };

  // ============================================
  // HELPER: HITUNG NILAI AKHIR
  // ============================================
  window.hitungNilaiAkhir = function(nilaiAktivitas, nilaiKuis) {
    const arr = Array.isArray(nilaiAktivitas) ? nilaiAktivitas : [];
    const rata = arr.length > 0
      ? arr.reduce((a, b) => a + Number(b || 0), 0) / arr.length
      : 0;
    const kuis = Number(nilaiKuis) || 0;
    const nilai = (rata * window.DUTA_BOBOT.aktivitas) +
                  (kuis * window.DUTA_BOBOT.kuis);
    return Math.round(nilai);
  };

  window.hitungRataAktivitas = function(nilaiAktivitas) {
    const arr = Array.isArray(nilaiAktivitas) ? nilaiAktivitas : [];
    if (arr.length === 0) return 0;
    return Math.round(arr.reduce((a, b) => a + Number(b || 0), 0) / arr.length);
  };

  // ============================================
  // HELPER: IDENTITAS SISWA
  // ============================================
  window.simpanIdentitasSiswa = function(sekolah, nama, kelas) {
    try {
      localStorage.setItem('duta_siswa', JSON.stringify({
        sekolah: sekolah || '',
        nama: nama || '',
        kelas: kelas || ''
      }));
    } catch (e) {
      console.warn('localStorage tidak tersedia:', e);
    }
  };

  window.ambilIdentitasSiswa = function() {
    try {
      const raw = localStorage.getItem('duta_siswa');
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.nama) return null;
      return data;
    } catch (e) {
      return null;
    }
  };

  window.hapusIdentitasSiswa = function() {
    try {
      localStorage.removeItem('duta_siswa');
    } catch (e) {}
  };

  // ============================================
  // HELPER: ID BARIS PER MODUL
  // ============================================
  window.simpanIdModul = function(modul, id) {
    if (!modul || !id) return;
    try {
      localStorage.setItem('duta_id_' + modul, id);
    } catch (e) {
      console.warn('localStorage tidak tersedia:', e);
    }
  };

  window.ambilIdModul = function(modul) {
    if (!modul) return null;
    try {
      return localStorage.getItem('duta_id_' + modul) || null;
    } catch (e) {
      return null;
    }
  };

  window.hapusIdModul = function(modul) {
    if (!modul) return;
    try {
      localStorage.removeItem('duta_id_' + modul);
    } catch (e) {}
  };

  // ============================================
  // HELPER: KIRIM NILAI PER BAGIAN
  // ============================================
  window.kirimNilaiBagian = async function(modul, bagian, nilai, totalBagian, nilaiAkhir) {
    const apiUrl = window.DUTA_API && window.DUTA_API.url;
    if (!apiUrl) return { ok: false, error: 'URL API tidak tersedia' };

    const idTersimpan = window.ambilIdModul(modul);

    let payload;
    let idUntukDipakai;

    if (idTersimpan) {
      // ===== Mode UPDATE =====
      idUntukDipakai = idTersimpan;
      payload = {
        sheetName: modul,
        id: idTersimpan,
        bagian: bagian,
        nilai: Number(nilai) || 0
      };
      if (nilaiAkhir !== undefined && nilaiAkhir !== null) {
        payload.nilaiAkhir = Number(nilaiAkhir) || 0;
      }
    } else {
      // ===== Mode INSERT =====
      const siswa = window.ambilIdentitasSiswa();
      if (!siswa) {
        return { ok: false, error: 'Identitas siswa belum diisi' };
      }
      if (!Array.isArray(totalBagian) || totalBagian.length === 0) {
        return { ok: false, error: 'totalBagian wajib dikirim pada insert pertama' };
      }

      idUntukDipakai = generateIdKlien(modul);

      payload = {
        sheetName: modul,
        id: idUntukDipakai,
        sekolah: siswa.sekolah || '',
        nama: siswa.nama || '',
        kelas: siswa.kelas || '',
        bagian: bagian,
        nilai: Number(nilai) || 0,
        totalBagian: totalBagian
      };

      window.simpanIdModul(modul, idUntukDipakai);
    }

    try {
      await fetch(apiUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      return {
        ok: true,
        mode: idTersimpan ? 'update' : 'insert',
        id: idUntukDipakai
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  // ============================================
  // HELPER INTERNAL: Generate ID di sisi klien
  // ============================================
  function generateIdKlien(modul) {
    const kode = (modul || 'DUTA').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const tgl = '' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate());
    const jam = pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return kode + '-' + tgl + '-' + jam + '-' + rand;
  }

  // ============================================
  // HELPER LAMA: KIRIM NILAI SEKALIGUS (kompatibilitas)
  // ============================================
  window.kirimNilaiKeSheet = async function(sheetName, nama, kelas, nilai) {
    const apiUrl = window.DUTA_API && window.DUTA_API.url;
    if (!apiUrl) return { ok: false, error: 'URL API tidak tersedia' };

    try {
      await fetch(apiUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sheetName: sheetName,
          nama: nama,
          kelas: kelas,
          nilai: nilai,
          bagian: 'nilai_akhir',
          totalBagian: ['nilai_akhir']
        })
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  // ============================================
  // 1. HEADER (banner saja, tanpa menu bar)
  // ============================================
  function renderHeader() {
    const headerEl = document.getElementById('header-utama');
    if (!headerEl) return;

    headerEl.innerHTML = `
      <div class="banner">
        <h1>📡 Informatika DUTA</h1>
        <span class="sub">SMPN 2 Talegong</span>
      </div>
    `;
  }

  // ============================================
  // 2. FOOTER
  // ============================================
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

  // ============================================
  // 3. COLLAPSIBLE INFO
  // ============================================
  function initInfoToggle() {
    const wrapper = document.getElementById('info-collapsible');
    const btn = document.getElementById('info-toggle');
    if (!wrapper || !btn) return;

    const label = btn.querySelector('.label');

    function setExpanded(expanded) {
      wrapper.classList.toggle('expanded', expanded);
      btn.setAttribute('aria-expanded', String(expanded));
      if (label) {
        label.textContent = expanded ? 'Sembunyikan' : 'Baca selengkapnya';
      }
    }

    btn.addEventListener('click', function() {
      const isExpanded = wrapper.classList.contains('expanded');
      setExpanded(!isExpanded);
    });
  }

  // ============================================
  // 4. TOMBOL FLOATING PANAH KE ATAS
  // ============================================
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

  // ============================================
  // 5. EKSEKUSI SEMUA
  // ============================================
  document.addEventListener('DOMContentLoaded', function() {
    renderHeader();
    renderFooter();
    initInfoToggle();
    initScrollButton();
  });

})();