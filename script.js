// script.js — versi Fase C
// Bar user sekarang di dalam header (ikut banner, tidak floating).
// encoding: UTF-8

(function() {
  "use strict";

  // ============================================
  // KONFIGURASI
  // ============================================
  window.DUTA_API = {
    url: [
      'https://script.google.com/macros/s/',
      'AKfycbz8AIqbAznVwEUsebrRWLLN9MMrKSR9HP0bD1VR_BMDDLXIY9fPWu_ioYr4ZClLzSBU',
      '/exec'
    ].join('')
  };

  window.DUTA_BOBOT = { aktivitas: 0.5, kuis: 0.5 };

  // Root path — diisi oleh halaman ('' atau '../')
  function getRoot() {
    return (typeof window.DUTA_ROOT === 'string') ? window.DUTA_ROOT : '';
  }
  window.getRoot = getRoot;

  // ============================================
  // HITUNG NILAI
  // ============================================
  window.hitungNilaiAkhir = function(nilaiAktivitas, nilaiKuis) {
    const arr = Array.isArray(nilaiAktivitas) ? nilaiAktivitas : [];
    const rata = arr.length > 0
      ? arr.reduce((a, b) => a + Number(b || 0), 0) / arr.length
      : 0;
    const kuis = Number(nilaiKuis) || 0;
    return Math.round((rata * window.DUTA_BOBOT.aktivitas) + (kuis * window.DUTA_BOBOT.kuis));
  };

  window.hitungRataAktivitas = function(nilaiAktivitas) {
    const arr = Array.isArray(nilaiAktivitas) ? nilaiAktivitas : [];
    if (arr.length === 0) return 0;
    return Math.round(arr.reduce((a, b) => a + Number(b || 0), 0) / arr.length);
  };

  // ============================================
  // IDENTITAS SISWA
  // ============================================
  window.simpanIdentitasSiswa = function(sekolah, nama, kelas) {
    try {
      localStorage.setItem('duta_siswa', JSON.stringify({
        sekolah: sekolah || '', nama: nama || '', kelas: kelas || ''
      }));
    } catch (e) {}
  };
  window.ambilIdentitasSiswa = function() {
    try {
      const raw = localStorage.getItem('duta_siswa');
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || !d.nama) return null;
      return d;
    } catch (e) { return null; }
  };
  window.hapusIdentitasSiswa = function() {
    try { localStorage.removeItem('duta_siswa'); } catch (e) {}
  };

  // ============================================
  // ID PER MODUL
  // ============================================
  window.simpanIdModul = function(modul, id) {
    if (!modul || !id) return;
    try { localStorage.setItem('duta_id_' + modul, id); } catch (e) {}
  };
  window.ambilIdModul = function(modul) {
    if (!modul) return null;
    try { return localStorage.getItem('duta_id_' + modul) || null; } catch (e) { return null; }
  };
  window.hapusIdModul = function(modul) {
    if (!modul) return;
    try { localStorage.removeItem('duta_id_' + modul); } catch (e) {}
  };

  // ============================================
  // SESSION
  // ============================================
  window.simpanSession = function(s) {
    try { localStorage.setItem('duta_session', JSON.stringify(s || {})); } catch (e) {}
  };
  window.ambilSession = function() {
    try {
      const raw = localStorage.getItem('duta_session');
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.user_id) return null;
      return s;
    } catch (e) { return null; }
  };
  window.hapusSession = function() {
    try { localStorage.removeItem('duta_session'); } catch (e) {}
  };
  window.sudahLogin = function() {
    const s = window.ambilSession();
    return !!(s && s.tipe === 'login');
  };
  window.modeTamu = function() {
    const s = window.ambilSession();
    return !!(s && s.tipe === 'tamu');
  };
  window.ambilUserId = function() {
    const s = window.ambilSession();
    return s ? s.user_id : null;
  };

  // ============================================
  // HELPER: ambil nama siswa gabungan untuk dikirim ke sheet
  // ============================================
  function ambilNamaSiswaUntukSheet() {
    // Prioritas 1: dari key lab[modul]_siswa (array)
    // Kita cek semua key yang berawalan 'lab' dan berakhiran '_siswa'
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('lab') && k.endsWith('_siswa')) keys.push(k);
      }
      // Ambil yang paling baru (asumsi: key yang cocok dengan modul aktif)
      // Fallback: gabung dari key pertama yang ketemu
      for (let i = 0; i < keys.length; i++) {
        try {
          const arr = JSON.parse(localStorage.getItem(keys[i]) || '[]');
          if (Array.isArray(arr) && arr.length > 0 && arr[0].nama) {
            return arr.map(s => s.nama).filter(Boolean).join(' & ');
          }
        } catch (e) {}
      }
    } catch (e) {}

    // Prioritas 2: dari duta_siswa (identitas tunggal)
    const ids = window.ambilIdentitasSiswa();
    if (ids && ids.nama) return ids.nama;

    return '';
  }
  window.ambilNamaSiswaUntukSheet = ambilNamaSiswaUntukSheet;

  // ============================================
  // API CALL
  // ============================================
  window.dutaFetch = async function(payload) {
    const apiUrl = window.DUTA_API && window.DUTA_API.url;
    if (!apiUrl) return { ok: false, error: 'URL API tidak tersedia' };
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (err) {
      return { ok: false, error: err.message || 'Gagal terhubung ke server' };
    }
  };

  window.dutaLogin = async function(username, password) {
    const hasil = await window.dutaFetch({
      action: 'login', username: username, password: password
    });
    if (hasil && hasil.ok) {
      window.simpanSession({
        user_id: hasil.user_id,
        nama: hasil.nama,
        kelas: hasil.kelas,
        sekolah: hasil.sekolah || '',
        tipe: 'login',
        waktu_login: new Date().toISOString()
      });
    }
    return hasil;
  };

  window.dutaDaftar = async function(username, password, nama, kelas, sekolah) {
    return await window.dutaFetch({
      action: 'register',
      username: username, password: password,
      nama: nama, kelas: kelas, sekolah: sekolah
    });
  };

  window.dutaCekUser = async function(username) {
    return await window.dutaFetch({ action: 'cekUser', username: username });
  };

  // Buat kode tamu (dipanggil dari halaman aktivitas saat mulai)
  window.dutaBuatTamu = async function(sekolah, nama, kelas) {
    const hasil = await window.dutaFetch({
      action: 'buatTamu', sekolah: sekolah, nama: nama, kelas: kelas
    });
    if (hasil && hasil.ok) {
      window.simpanSession({
        user_id: hasil.kode_tamu,
        nama: hasil.nama,
        kelas: hasil.kelas,
        sekolah: hasil.sekolah || '',
        tipe: 'tamu',
        kadaluarsa: hasil.kadaluarsa,
        waktu_buat: new Date().toISOString()
      });
    }
    return hasil;
  };

  // Helper: pastikan user punya kode tamu. Kalau sudah login, return sesi login.
  // Kalau sudah tamu berkode, return kode. Kalau belum, buat baru.
  window.dutaPastikanPunyaKode = async function(sekolah, nama, kelas) {
    const session = window.ambilSession();

    // Sudah login → tidak perlu kode
    if (session && session.tipe === 'login') {
      return { ok: true, tipe: 'login', user_id: session.user_id, sudah_ada: true };
    }

    // Sudah tamu berkode → pakai kode itu
    if (session && session.tipe === 'tamu' && session.user_id) {
      return { ok: true, tipe: 'tamu', user_id: session.user_id, sudah_ada: true };
    }

    // Belum → buat baru
    const hasil = await window.dutaBuatTamu(sekolah, nama, kelas);
    if (hasil && hasil.ok) {
      return { ok: true, tipe: 'tamu', user_id: hasil.kode_tamu, sudah_ada: false };
    }
    return { ok: false, error: (hasil && hasil.error) || 'Gagal membuat kode tamu' };
  };

  window.dutaAmbilProgress = async function(modul) {
    const userId = window.ambilUserId();
    if (!userId) return { ok: false, error: 'Belum login/tamu' };
    return await window.dutaFetch({
      action: 'getProgress', userId: userId, modul: modul || ''
    });
  };

  // ============================================
  // SIMPAN PROGRESS (dengan nama_siswa)
  // ============================================
  window.dutaSimpanProgress = async function(modul, bagianTerakhir, skor, nilaiAkhir) {
    const userId = window.ambilUserId();
    if (!userId) return { ok: false, error: 'Belum login/tamu' };

    // Ambil nama siswa gabungan dari localStorage
    const namaSiswa = ambilNamaSiswaUntukSheet();

    return await window.dutaFetch({
      action: 'simpanProgress',
      userId: userId,
      modul: modul,
      bagianTerakhir: bagianTerakhir || '',
      skor: skor || {},
      nilaiAkhir: nilaiAkhir || 0,
      namaSiswa: namaSiswa
    });
  };

  window.dutaResetUser = async function() {
    const session = window.ambilSession();
    if (!session) return { ok: false, error: 'Tidak ada session aktif' };
    if (session.tipe !== 'tamu') return { ok: false, error: 'Reset hanya untuk tamu' };
    const hasil = await window.dutaFetch({ action: 'resetUser', userId: session.user_id });
    hapusSemuaLocalStorageUser();
    return hasil;
  };

  function hapusSemuaLocalStorageUser() {
    try {
      const prefixes = ['lab', 'duta'];
      const hapus = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && prefixes.some(p => k.startsWith(p))) hapus.push(k);
      }
      hapus.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
  }
  window.hapusSemuaLocalStorageUser = hapusSemuaLocalStorageUser;

  // ============================================
  // KIRIM NILAI BAGIAN (LAMA)
  // ============================================
  window.kirimNilaiBagian = async function(modul, bagian, nilai, totalBagian, nilaiAkhir) {
    const apiUrl = window.DUTA_API && window.DUTA_API.url;
    if (!apiUrl) return { ok: false, error: 'URL API tidak tersedia' };

    const idTersimpan = window.ambilIdModul(modul);
    const userId = window.ambilUserId();
    let payload;
    let idUntukDipakai;

    if (idTersimpan) {
      idUntukDipakai = idTersimpan;
      payload = {
        sheetName: modul, id: idTersimpan,
        bagian: bagian, nilai: Number(nilai) || 0
      };
      if (nilaiAkhir !== undefined && nilaiAkhir !== null) {
        payload.nilaiAkhir = Number(nilaiAkhir) || 0;
      }
    } else {
      const siswa = window.ambilIdentitasSiswa();
      if (!siswa) return { ok: false, error: 'Identitas siswa belum diisi' };
      if (!Array.isArray(totalBagian) || totalBagian.length === 0) {
        return { ok: false, error: 'totalBagian wajib diisi' };
      }
      idUntukDipakai = userId || generateIdKlien(modul);
      payload = {
        sheetName: modul, id: idUntukDipakai,
        sekolah: siswa.sekolah || '', nama: siswa.nama || '',
        kelas: siswa.kelas || '', bagian: bagian,
        nilai: Number(nilai) || 0, totalBagian: totalBagian
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
      return { ok: true, mode: idTersimpan ? 'update' : 'insert', id: idUntukDipakai };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  function generateIdKlien(modul) {
    const kode = (modul || 'DUTA').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const tgl = '' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate());
    const jam = pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return kode + '-' + tgl + '-' + jam + '-' + rand;
  }

  window.kirimNilaiKeSheet = async function(sheetName, nama, kelas, nilai) {
    const apiUrl = window.DUTA_API && window.DUTA_API.url;
    if (!apiUrl) return { ok: false, error: 'URL API tidak tersedia' };
    try {
      await fetch(apiUrl, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sheetName: sheetName, nama: nama, kelas: kelas, nilai: nilai,
          bagian: 'nilai_akhir', totalBagian: ['nilai_akhir']
        })
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  // ============================================
  // HEADER (banner + bar user menyatu)
  // ============================================
  function renderHeader() {
    const el = document.getElementById('header-utama');
    if (!el) return;

    const session = window.ambilSession();
    let barHtml = '';

    if (!session) {
      // Belum login & belum punya kode → tamu biasa
      barHtml = `
        <span class="ub-info ub-guest">👤 Tamu</span>
        <a href="javascript:void(0)" class="ub-btn ub-login" id="ubAksiLogin">🔑 Login</a>
      `;
    } else if (session.tipe === 'login') {
      // Sudah login → tidak ada tombol Reset
      barHtml = `
        <span class="ub-info ub-login" title="Login: ${escapeHtml(session.user_id)}">
          👤 ${escapeHtml(session.nama || session.user_id)}
        </span>
        <button type="button" class="ub-btn ub-logout" id="ubAksiLogout">🚪 Logout</button>
      `;
    } else {
      // Tamu berkode → ada tombol Reset
      barHtml = `
        <span class="ub-info ub-tamu" title="Kode: ${escapeHtml(session.user_id)}">
          🎭 ${escapeHtml(session.user_id)}
        </span>
        <button type="button" class="ub-btn ub-reset" id="ubAksiReset" title="Reset data tamu & progres">🗑️</button>
        <a href="javascript:void(0)" class="ub-btn ub-login" id="ubAksiLogin">🔑 Login</a>
      `;
    }

    el.innerHTML = `
      <div class="banner">
        <div class="banner-brand">
          <h1>📡 Informatika DUTA</h1>
          <span class="sub">SMPN 2 Talegong</span>
        </div>
        <div class="duta-user-bar" id="duta-user-bar">
          ${barHtml}
        </div>
      </div>
    `;

    // Pasang handler
    const btnLogin  = document.getElementById('ubAksiLogin');
    const btnLogout = document.getElementById('ubAksiLogout');
    const btnReset  = document.getElementById('ubAksiReset');

    if (btnLogin)  btnLogin.addEventListener('click', aksiLogin);
    if (btnLogout) btnLogout.addEventListener('click', aksiLogout);
    if (btnReset)  btnReset.addEventListener('click', aksiResetTamu);
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ===== Aksi: Login =====
  function aksiLogin() {
    const currentPath = window.location.pathname + window.location.search;
    try { sessionStorage.setItem('duta_redirect_after_login', currentPath); } catch (e) {}
    window.location.href = getRoot() + 'login.html';
  }

  // ===== Aksi: Logout =====
  function aksiLogout() {
    tampilkanModal({
      judul: 'Logout',
      pesan: 'Yakin ingin logout? Progres belajar tetap tersimpan di server.',
      tombolLanjut: '🚪 Logout',
      onLanjut: function() {
        window.hapusSession();
        window.hapusSemuaLocalStorageUser();
        window.location.href = getRoot() + 'index.html';
      }
    });
  }

  // ===== Aksi: Reset Tamu =====
  async function aksiResetTamu() {
    const session = window.ambilSession();
    if (!session || session.tipe !== 'tamu') {
      alert('Reset hanya tersedia untuk mode Tamu.');
      return;
    }
    tampilkanModal({
      judul: 'Reset Data Tamu',
      pesan: 'Semua data tamu <strong>' + escapeHtml(session.user_id) +
             '</strong> dan progres belajarnya akan dihapus permanen.<br><br>Lanjutkan?',
      tombolLanjut: '🗑️ Lanjut Hapus',
      onLanjut: async function() {
        tampilkanLoading(true);
        const hasil = await window.dutaResetUser();
        tampilkanLoading(false);
        if (hasil && hasil.ok) {
          alert('✅ Reset berhasil.');
          window.hapusSession();
          window.location.href = getRoot() + 'index.html';
        } else {
          alert('⚠️ Gagal reset: ' + ((hasil && hasil.error) || 'Tidak diketahui'));
        }
      }
    });
  }

  // ============================================
  // MODAL SEDERHANA
  // ============================================
  function tampilkanModal(opts) {
    const lama = document.getElementById('duta-modal');
    if (lama) lama.remove();

    const modal = document.createElement('div');
    modal.id = 'duta-modal';
    modal.className = 'duta-modal-overlay';
    modal.innerHTML = `
      <div class="duta-modal-box">
        <h3 class="duta-modal-title">${escapeHtml(opts.judul || 'Konfirmasi')}</h3>
        <div class="duta-modal-body">${opts.pesan || ''}</div>
        <div class="duta-modal-actions">
          <button type="button" class="duta-modal-btn duta-modal-batal">Batal</button>
          <button type="button" class="duta-modal-btn duta-modal-lanjut">${escapeHtml(opts.tombolLanjut || 'Lanjut')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.duta-modal-batal').addEventListener('click', function() { modal.remove(); });
    modal.querySelector('.duta-modal-lanjut').addEventListener('click', function() {
      modal.remove();
      if (typeof opts.onLanjut === 'function') opts.onLanjut();
    });

    const esc = function(e) {
      if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', esc); }
    };
    document.addEventListener('keydown', esc);
  }
  window.tampilkanModal = tampilkanModal;

  function tampilkanLoading(aktif) {
    const lama = document.getElementById('duta-modal-loading');
    if (lama) lama.remove();
    if (!aktif) return;

    const el = document.createElement('div');
    el.id = 'duta-modal-loading';
    el.className = 'duta-modal-overlay';
    el.innerHTML = `
      <div class="duta-modal-box" style="text-align:center; max-width:220px;">
        <div class="duta-spinner"></div>
        <div style="margin-top:0.6rem; font-weight:700; color:#5c2f8a;">Memproses…</div>
      </div>
    `;
    document.body.appendChild(el);
  }

  // ============================================
  // FOOTER
  // ============================================
  function renderFooter() {
    const el = document.getElementById('footer-utama');
    if (!el) return;
    const year = new Date().getFullYear();
    el.innerHTML = `
      <div class="container" style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:0.5rem 1rem; padding:0.5rem 1rem;">
        <div><span style="font-weight:600; color:#4d3829;">Kiki Husni Kamil, S.Pd.</span> · Guru Informatika</div>
        <div style="text-align:right;">
          <span>&copy; ${year} SMPN 2 Talegong</span><br>
          <span style="font-size:0.85rem; opacity:0.7;">Terbit: 2026-08-05</span>
        </div>
      </div>
    `;
  }

  // ============================================
  // COLLAPSIBLE INFO & SCROLL TOP
  // ============================================
  function initInfoToggle() {
    const wrapper = document.getElementById('info-collapsible');
    const btn = document.getElementById('info-toggle');
    if (!wrapper || !btn) return;
    const label = btn.querySelector('.label');
    btn.addEventListener('click', function() {
      const exp = wrapper.classList.toggle('expanded');
      btn.setAttribute('aria-expanded', String(exp));
      if (label) label.textContent = exp ? 'Sembunyikan' : 'Baca selengkapnya';
    });
  }

  function initScrollButton() {
    const btn = document.getElementById('scrollTopBtn');
    if (!btn) return;
    btn.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    function toggle() { btn.style.display = window.scrollY > 120 ? 'flex' : 'none'; }
    window.addEventListener('scroll', toggle);
    toggle();
  }

  // ============================================
  // TOMBOL LANJUTKAN BELAJAR (untuk aktivitas)
  // ============================================
  window.renderTombolLanjut = async function(opts) {
    const modul = opts.modul;
    const containerId = opts.containerId || 'duta-lanjut-container';
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    const session = window.ambilSession();
    if (!session) return;

    const hasil = await window.dutaAmbilProgress(modul);
    if (!hasil || !hasil.ok || !hasil.progress || hasil.progress.length === 0) {
      return;
    }

    const p = hasil.progress[0];
    const bagianTerakhir = p.bagian_terakhir || '';
    const selesai = p.nilai_akhir > 0;

    const btn = document.createElement('a');
    btn.className = 'duta-lanjut-btn';
    btn.href = '#';

    if (selesai) {
      btn.innerHTML = `🔄 <strong>Ulangi Modul Ini</strong> — Nilai akhir: ${p.nilai_akhir}`;
    } else if (bagianTerakhir) {
      btn.innerHTML = `▶️ <strong>Lanjutkan dari Bagian ${bagianTerakhir.toUpperCase()}</strong> — Progres tersimpan`;
    } else {
      return;
    }

    const mapBagianKeFile = opts.mapBagianKeFile || {};
    const fileTujuan = mapBagianKeFile[bagianTerakhir] || opts.halamanAwal;
    btn.href = fileTujuan;

    btn.addEventListener('click', function(e) {
      e.preventDefault();
      window.location.href = fileTujuan;
    });

    container.appendChild(btn);
  };

  // ============================================
  // EKSEKUSI
  // ============================================
  document.addEventListener('DOMContentLoaded', function() {
    renderHeader();
    renderFooter();
    initInfoToggle();
    initScrollButton();
  });

  console.log('✅ script.js Fase C siap.');
})();