// script.js — versi Fase C v3.2 (sentralisasi navbar + breadcrumb + favicon)
// Perubahan dari v3.1:
//   + renderFavicon() terpusat
//   + renderNavbar() menyatu di banner
//   + renderBreadcrumb() via fetch partials/breadcrumb.json
//   + autoDetectRoot() & autoDetectModulAktif()
//   + initDutaPage() — panggil 1x di DOMContentLoaded
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

  const BATAS_SESI_MENIT = 60;
  const KEY_AKTIVITAS = 'duta_aktivitas_terakhir';
  const THROTTLE_AKTIVITAS_MS = 60 * 1000;

  function getRoot() {
    return (typeof window.DUTA_ROOT === 'string') ? window.DUTA_ROOT : '';
  }
  window.getRoot = getRoot;

  function getModulAktif() {
    return (typeof window.DUTA_MODUL_AKTIF === 'string') ? window.DUTA_MODUL_AKTIF : '';
  }
  window.getModulAktif = getModulAktif;

  // ============================================
  // NORMALISASI
  // ============================================
  function normalisasiNama(str) {
    return String(str || '')
      .trim().toLowerCase().replace(/\s+/g, ' ')
      .split(' ')
      .map(function(kata) {
        if (!kata) return '';
        return kata.charAt(0).toUpperCase() + kata.slice(1);
      })
      .join(' ').trim();
  }
  function normalisasiKelas(str) {
    let s = String(str || '').trim().toUpperCase().replace(/\s+/g, '');
    const romawiMap = { 'VIII': '8', 'VII': '7', 'IX': '9' };
    const keys = Object.keys(romawiMap).sort(function(a, b) { return b.length - a.length; });
    for (let i = 0; i < keys.length; i++) {
      const romawi = keys[i];
      if (s.indexOf(romawi) === 0) { s = romawiMap[romawi] + s.substring(romawi.length); break; }
    }
    const match = s.match(/^(\d+)([A-Z]*)$/);
    if (match) return match[1] + match[2];
    return s;
  }
  function normalisasiSekolah(str) {
    return String(str || '').trim().replace(/\s+/g, ' ').toUpperCase();
  }
  window.dutaNormalisasi = { nama: normalisasiNama, kelas: normalisasiKelas, sekolah: normalisasiSekolah };

  // ============================================
  // HITUNG NILAI
  // ============================================
  window.hitungNilaiAkhir = function(nilaiAktivitas, nilaiKuis) {
    const arr = Array.isArray(nilaiAktivitas) ? nilaiAktivitas : [];
    const rata = arr.length > 0 ? arr.reduce((a, b) => a + Number(b || 0), 0) / arr.length : 0;
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
        sekolah: normalisasiSekolah(sekolah),
        nama: normalisasiNama(nama),
        kelas: normalisasiKelas(kelas)
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
  // IDENTITAS SISWA MULTI-USER (baru)
  // ============================================
  // Struktur localStorage `duta_identitas_siswa`:
  // {
  //   tipe: 'login' | 'tamu',
  //   utama: { username, nama, kelas, sekolah },
  //   teman: [ { username, nama, kelas, sekolah }, ... ],   // maks 4 (total 5)
  //   tamu:  { sekolah, kelas, daftarNama: [..] } | null
  // }
  const KEY_IDENTITAS = 'duta_identitas_siswa';
  const MAKS_TEMAN = 5;

  function ambilIdentitasSiswaMulti() {
    try {
      const raw = localStorage.getItem(KEY_IDENTITAS);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || !d.tipe) return null;
      return d;
    } catch (e) { return null; }
  }
  window.ambilIdentitasSiswaMulti = ambilIdentitasSiswaMulti;

  function simpanIdentitasSiswaMulti(obj) {
    try {
      if (!obj || !obj.tipe) { localStorage.removeItem(KEY_IDENTITAS); return; }
      if (!Array.isArray(obj.teman)) obj.teman = [];
      localStorage.setItem(KEY_IDENTITAS, JSON.stringify(obj));
    } catch (e) {}
    // trigger render ulang user bar
    try { renderUserBar(); } catch (e) {}
  }
  window.simpanIdentitasSiswaMulti = simpanIdentitasSiswaMulti;

  function hapusIdentitasSiswaMulti() {
    try { localStorage.removeItem(KEY_IDENTITAS); } catch (e) {}
    try { renderUserBar(); } catch (e) {}
  }
  window.hapusIdentitasSiswaMulti = hapusIdentitasSiswaMulti;

  /**
   * Sinkronkan localStorage identitas dengan session aktif.
   * - Jika login & tipe beda → reset.
   * - Jika tamu & tipe beda → reset.
   * - Pastikan utama = data session.
   */
  function sinkronkanIdentitasDenganSession() {
    const s = window.ambilSession ? window.ambilSession() : null;
    const d = ambilIdentitasSiswaMulti();
    if (!s) return null;

    if (!d || d.tipe !== s.tipe) {
      // buat baru
      if (s.tipe === 'login') {
        const baru = {
          tipe: 'login',
          utama: { username: s.user_id, nama: s.nama, kelas: s.kelas, sekolah: s.sekolah },
          teman: []
        };
        simpanIdentitasSiswaMulti(baru);
        return baru;
      } else {
        // tamu — biarkan kosong dulu, akan diisi lewat modal
        const baru = {
          tipe: 'tamu',
          utama: { username: s.user_id, nama: s.nama, kelas: s.kelas, sekolah: s.sekolah },
          teman: [],
          tamu: null
        };
        simpanIdentitasSiswaMulti(baru);
        return baru;
      }
    }

    // Sinkronkan identitas utama (nama/kelas/sekolah bisa berubah dari login)
    d.utama = {
      username: s.user_id,
      nama: s.nama,
      kelas: s.kelas,
      sekolah: s.sekolah
    };
    simpanIdentitasSiswaMulti(d);
    return d;
  }
  window.sinkronkanIdentitasDenganSession = sinkronkanIdentitasDenganSession;

  /**
   * Kumpulkan userIds untuk progress bulk.
   * - login: [utama.username, teman[0].username, ...]
   * - tamu : tidak ada (pakai single userId session)
   * Return: { userIds: [...], namaGabung: '...' }
   */
  function ambilUserIdsUntukProgress() {
    const d = ambilIdentitasSiswaMulti();
    if (!d) return { userIds: [], namaGabung: '' };

    if (d.tipe === 'login') {
      const ids = [];
      const names = [];
      if (d.utama && d.utama.username) {
        ids.push(d.utama.username);
        names.push(d.utama.nama || d.utama.username);
      }
      (d.teman || []).forEach(function(t) {
        if (t && t.username) {
          ids.push(t.username);
          names.push(t.nama || t.username);
        }
      });
      return { userIds: ids, namaGabung: names.join(' & ') };
    }

    // tamu — pakai session
    const s = window.ambilSession ? window.ambilSession() : null;
    if (!s) return { userIds: [], namaGabung: '' };
    return { userIds: [s.user_id], namaGabung: s.nama || s.user_id };
  }
  window.ambilUserIdsUntukProgress = ambilUserIdsUntukProgress;

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
  // SESSION + SLIDING EXPIRATION
  // ============================================
  function catatAktivitas(force) {
    try {
      const now = Date.now();
      const terakhir = Number(localStorage.getItem(KEY_AKTIVITAS)) || 0;
      if (!force && (now - terakhir) < THROTTLE_AKTIVITAS_MS) return;
      localStorage.setItem(KEY_AKTIVITAS, String(now));
    } catch (e) {}
  }
  window.catatAktivitas = catatAktivitas;

  function hapusAktivitas() {
    try { localStorage.removeItem(KEY_AKTIVITAS); } catch (e) {}
  }
  function cekKadaluarsaSesi() {
    try {
      const terakhir = Number(localStorage.getItem(KEY_AKTIVITAS)) || 0;
      if (terakhir === 0) return false;
      return (Date.now() - terakhir) > (BATAS_SESI_MENIT * 60 * 1000);
    } catch (e) { return false; }
  }

  window.simpanSession = function(s) {
    try {
      localStorage.setItem('duta_session', JSON.stringify(s || {}));
      catatAktivitas(true);
    } catch (e) {}
  };
  window.ambilSession = function() {
    try {
      const raw = localStorage.getItem('duta_session');
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.user_id) return null;
      if (cekKadaluarsaSesi()) { hapusSession(); hapusAktivitas(); return null; }
      catatAktivitas(false);
      return s;
    } catch (e) { return null; }
  };
  window.hapusSession = function() {
    try { localStorage.removeItem('duta_session'); hapusAktivitas(); } catch (e) {}
  };
  window.sudahLogin = function() { const s = window.ambilSession(); return !!(s && s.tipe === 'login'); };
  window.modeTamu = function() { const s = window.ambilSession(); return !!(s && s.tipe === 'tamu'); };
  window.ambilUserId = function() { const s = window.ambilSession(); return s ? s.user_id : null; };

  // ============================================
  // SESSION GURU
  // ============================================
  const KEY_GURU_AKTIVITAS = 'duta_guru_aktivitas';
  function catatAktivitasGuru(force) {
    try {
      const now = Date.now();
      const terakhir = Number(sessionStorage.getItem(KEY_GURU_AKTIVITAS)) || 0;
      if (!force && (now - terakhir) < THROTTLE_AKTIVITAS_MS) return;
      sessionStorage.setItem(KEY_GURU_AKTIVITAS, String(now));
    } catch (e) {}
  }
  window.simpanSessionGuru = function(guru) {
    try {
      sessionStorage.setItem('duta_guru', JSON.stringify(guru || {}));
      catatAktivitasGuru(true);
    } catch (e) {}
  };
  window.ambilSessionGuru = function() {
    try {
      const raw = sessionStorage.getItem('duta_guru');
      if (!raw) return null;
      const g = JSON.parse(raw);
      if (!g || !g.username) return null;
      const terakhir = Number(sessionStorage.getItem(KEY_GURU_AKTIVITAS)) || 0;
      if (terakhir > 0 && (Date.now() - terakhir) > (BATAS_SESI_MENIT * 60 * 1000)) {
        window.hapusSessionGuru(); return null;
      }
      catatAktivitasGuru(false);
      return g;
    } catch (e) { return null; }
  };
  window.hapusSessionGuru = function() {
    try {
      sessionStorage.removeItem('duta_guru');
      sessionStorage.removeItem(KEY_GURU_AKTIVITAS);
    } catch (e) {}
  };

  // ============================================
  // HELPER: nama siswa untuk sheet
  // ============================================
  function ambilNamaSiswaUntukSheet() {
    try {
      const modulAktif = getModulAktif();
      if (modulAktif) {
        const keyModul = 'lab' + modulAktif + '_siswa';
        try {
          const arr = JSON.parse(localStorage.getItem(keyModul) || '[]');
          if (Array.isArray(arr) && arr.length > 0) {
            const namaArr = arr.map(function(s) { return (s && s.nama) ? String(s.nama).trim() : ''; }).filter(Boolean);
            if (namaArr.length > 0) return namaArr.join(' & ');
          }
        } catch (e) {}
      }
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('lab') && k.endsWith('_siswa')) keys.push(k);
      }
      let terbaik = null;
      for (let i = 0; i < keys.length; i++) {
        try {
          const arr = JSON.parse(localStorage.getItem(keys[i]) || '[]');
          if (Array.isArray(arr) && arr.length > 0) {
            if (!terbaik || arr.length > terbaik.length) terbaik = arr;
          }
        } catch (e) {}
      }
      if (terbaik && terbaik.length > 0) {
        const namaArr = terbaik.map(function(s) { return (s && s.nama) ? String(s.nama).trim() : ''; }).filter(Boolean);
        if (namaArr.length > 0) return namaArr.join(' & ');
      }
    } catch (e) {}
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
      const res = await fetch(apiUrl, { method: 'POST', body: JSON.stringify(payload) });
      return await res.json();
    } catch (err) {
      return { ok: false, error: err.message || 'Gagal terhubung ke server' };
    }
  };

  // ============================================
  // AUTH SISWA
  // ============================================
  window.dutaLogin = async function(username, password) {
    const hasil = await window.dutaFetch({ action: 'login', username: username, password: password });
    if (hasil && hasil.ok) {
      window.simpanSession({
        user_id: hasil.user_id,
        nama: normalisasiNama(hasil.nama),
        kelas: normalisasiKelas(hasil.kelas),
        sekolah: normalisasiSekolah(hasil.sekolah || ''),
        tipe: 'login',
        waktu_login: new Date().toISOString()
      });
    }
    return hasil;
  };
  window.dutaDaftar = async function(username, password, nama, kelas, sekolah) {
    return await window.dutaFetch({
      action: 'register', username: username, password: password,
      nama: normalisasiNama(nama), kelas: normalisasiKelas(kelas), sekolah: normalisasiSekolah(sekolah)
    });
  };
  window.dutaCekUser = async function(username) {
    return await window.dutaFetch({ action: 'cekUser', username: username });
  };
  window.dutaBuatTamu = async function(sekolah, nama, kelas) {
    const hasil = await window.dutaFetch({
      action: 'buatTamu',
      sekolah: normalisasiSekolah(sekolah),
      nama: normalisasiNama(nama),
      kelas: normalisasiKelas(kelas)
    });
    if (hasil && hasil.ok) {
      window.simpanSession({
        user_id: hasil.kode_tamu,
        nama: normalisasiNama(hasil.nama),
        kelas: normalisasiKelas(hasil.kelas),
        sekolah: normalisasiSekolah(hasil.sekolah || ''),
        tipe: 'tamu',
        kadaluarsa: hasil.kadaluarsa,
        waktu_buat: new Date().toISOString()
      });
    }
    return hasil;
  };
  window.dutaPastikanPunyaKode = async function(sekolah, nama, kelas) {
    const session = window.ambilSession();
    if (session && session.tipe === 'login') return { ok: true, tipe: 'login', user_id: session.user_id, sudah_ada: true };
    if (session && session.tipe === 'tamu' && session.user_id) return { ok: true, tipe: 'tamu', user_id: session.user_id, sudah_ada: true };
    const hasil = await window.dutaBuatTamu(sekolah, nama, kelas);
    if (hasil && hasil.ok) return { ok: true, tipe: 'tamu', user_id: hasil.kode_tamu, sudah_ada: false };
    return { ok: false, error: (hasil && hasil.error) || 'Gagal membuat kode tamu' };
  };

  // ============================================
  // AUTH GURU
  // ============================================
  window.dutaLoginGuru = async function(username, password) {
    const hasil = await window.dutaFetch({ action: 'loginGuru', username: username, password: password });
    if (hasil && hasil.ok) {
      window.simpanSessionGuru({
        username: hasil.user_id, nama: hasil.nama,
        sekolah: normalisasiSekolah(hasil.sekolah || ''), password: password
      });
    }
    return hasil;
  };

  // ============================================
  // PROGRESS
  // ============================================
  window.dutaAmbilProgress = async function(modul) {
    const userId = window.ambilUserId();
    if (!userId) return { ok: false, error: 'Belum login/tamu' };
    return await window.dutaFetch({ action: 'getProgress', userId: userId, modul: modul || '' });
  };
  window.dutaSimpanProgress = async function(modul, bagianTerakhir, skor, nilaiAkhir, opsi) {
    const userId = window.ambilUserId();
    if (!userId) return { ok: false, error: 'Belum login/tamu' };
    return await window.dutaFetch({
      action: 'simpanProgress', userId: userId, modul: modul,
      bagianTerakhir: bagianTerakhir || '', skor: skor || {},
      nilaiAkhir: nilaiAkhir || 0, namaSiswa: ambilNamaSiswaUntukSheet(),
      kunciModul: (opsi && opsi.kunciModul === true)
    });
  };
  
    window.dutaSimpanProgressBulk = async function(modul, bagianTerakhir, skor, nilaiAkhir, opsi) {
    const info = ambilUserIdsUntukProgress();
    if (!info.userIds || info.userIds.length === 0) {
      return { ok: false, error: 'Tidak ada user ID (belum login/tamu atau identitas kosong)' };
    }
    if (info.userIds.length === 1) {
      // fallback single (hemat request)
      return await window.dutaSimpanProgress(modul, bagianTerakhir, skor, nilaiAkhir, opsi);
    }
    return await window.dutaFetch({
      action: 'simpanProgressBulk',
      userIds: info.userIds,
      modul: modul,
      bagianTerakhir: bagianTerakhir || '',
      skor: skor || {},
      nilaiAkhir: nilaiAkhir || 0,
      namaSiswa: info.namaGabung,
      kunciModul: (opsi && opsi.kunciModul === true)
    });
  };

  // ============================================
  // CEK STATUS MODUL
  // ============================================
  const KEY_CACHE_STATUS = 'duta_status_modul_';
  window.dutaCekStatusModul = async function(modul, opts) {
    if (!modul) return { ok: false, terkunci: false, status: '' };
    const forceRefresh = opts && opts.refresh === true;
    const cacheKey = KEY_CACHE_STATUS + modul;
    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const c = JSON.parse(cached);
          if (c && (Date.now() - (c.ts || 0)) < 60000) {
            return { ok: true, terkunci: c.status === 'selesai', status: c.status || '', nilai_akhir: c.nilai_akhir || 0, skor_kuis: c.skor_kuis || 0, fromCache: true };
          }
        }
      } catch (e) {}
    }
    const userId = window.ambilUserId();
    if (!userId) return { ok: false, terkunci: false, status: '' };
    try {
      const hasil = await window.dutaFetch({ action: 'getProgress', userId: userId, modul: modul });
      if (hasil && hasil.ok && hasil.progress && hasil.progress.length > 0) {
        const p = hasil.progress[0];
        const status = (p.status_modul || '').toString().trim().toLowerCase();
        const data = { ok: true, terkunci: status === 'selesai', status: status, nilai_akhir: Number(p.nilai_akhir) || 0, skor_kuis: Number(p.skor_kuis) || 0 };
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ status: data.status, nilai_akhir: data.nilai_akhir, skor_kuis: data.skor_kuis, ts: Date.now() }));
        } catch (e) {}
        return data;
      }
      return { ok: true, terkunci: false, status: '' };
    } catch (e) {
      return { ok: false, terkunci: false, status: '', error: e.message };
    }
  };
  window.dutaBersihkanCacheStatus = function(modul) {
    if (!modul) return;
    try { sessionStorage.removeItem(KEY_CACHE_STATUS + modul); } catch (e) {}
  };

  // ============================================
  // FEEDBACK AI
  // ============================================
  window.dutaMintaFeedbackAI = async function(payload) {
    const p = payload || {};
    const userId = window.ambilUserId ? window.ambilUserId() : null;
    if (!p.modul) return { ok: false, error: 'modul wajib diisi' };
    if (!p.bagian) return { ok: false, error: 'bagian wajib diisi' };
    const body = {
      action: 'getFeedbackAI', userId: userId || '',
      modul: p.modul, bagian: p.bagian, level: p.level || '',
      skorTes: Number(p.skorTes) || 0, benarTes: Number(p.benarTes) || 0, totalTes: Number(p.totalTes) || 0,
      ringkasHasil: p.ringkasHasil || '',
      mindful: { j1: (p.mindful && p.mindful.j1) || '', j2: (p.mindful && p.mindful.j2) || '', j3: (p.mindful && p.mindful.j3) || '', pilih: (p.mindful && p.mindful.pilih) || '' },
      refleksi: { pelajaran: (p.refleksi && p.refleksi.pelajaran) || '', penerapan: (p.refleksi && p.refleksi.penerapan) || '' },
      exitTicket: p.exitTicket || ''
    };
    const hasil = await window.dutaFetch(body);
    if (!hasil || !hasil.ok) return { ok: false, error: (hasil && hasil.error) || 'Gagal minta feedback' };
    return { ok: true, feedback: hasil.feedback || '', model: hasil.model || '', waktu: hasil.waktu || '' };
  };

  // ============================================
  // RESET USER
  // ============================================
  window.dutaResetUser = async function() {
    const session = window.ambilSession();
    if (!session) return { ok: false, error: 'Tidak ada session aktif' };
    if (session.tipe !== 'tamu') return { ok: false, error: 'Reset hanya untuk tamu' };
    const hasil = await window.dutaFetch({ action: 'resetUser', userId: session.user_id });
	hapusIdentitasSiswaMulti();
    hapusSemuaLocalStorageUser();
    return hasil;
  };
  function hapusSemuaLocalStorageUser() {
    try {
      const prefixes = ['lab', 'duta'];
      const hapus = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && prefixes.some(function(p) { return k.startsWith(p); })) hapus.push(k);
      }
      hapus.forEach(function(k) { localStorage.removeItem(k); });
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(KEY_CACHE_STATUS)) sessionStorage.removeItem(k);
      }
    } catch (e) {}
  }
  window.hapusSemuaLocalStorageUser = hapusSemuaLocalStorageUser;

  // ============================================
  // STATE AKTIVITAS
  // ============================================
  const STATE_TTL_MS = 24 * 60 * 60 * 1000;
  const STATE_THROTTLE_MS = 1000;
  const STATE_PREFIX = 'lab';
  const STATE_SUFFIX = '_state_';
  const stateThrottleMap = {};

  function ambilUserIdUntukState() {
    try {
      const s = window.ambilSession ? window.ambilSession() : null;
      if (s && s.user_id) return String(s.user_id).trim();
    } catch (e) {}
    return 'anon';
  }
  function bentukKeyState(keyBase) {
    const uid = ambilUserIdUntukState();
    if (keyBase.indexOf(STATE_SUFFIX) !== -1) return keyBase + '_' + uid;
    return STATE_PREFIX + keyBase + STATE_SUFFIX + '_' + uid;
  }
  function bersihkanStateKadaluarsa() {
    try {
      const now = Date.now();
      const hapus = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.indexOf('_state_') === -1) continue;
        if (k.indexOf(STATE_PREFIX) !== 0) continue;
        try {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const d = JSON.parse(raw);
          const ts = Number(d && d.__ts) || 0;
          if (!ts || (now - ts) > STATE_TTL_MS) hapus.push(k);
        } catch (e) { hapus.push(k); }
      }
      hapus.forEach(function(k) { try { localStorage.removeItem(k); } catch (e) {} });
    } catch (e) {}
  }
  window.dutaSimpanState = function(keyBase, obj, opts) {
    if (!keyBase || typeof obj !== 'object' || obj === null) return false;
    try {
      const o = opts || {};
      const force = o.force === true;
      const finalKey = bentukKeyState(keyBase);
      const now = Date.now();
      const terakhir = stateThrottleMap[finalKey] || 0;
      if (!force && (now - terakhir) < STATE_THROTTLE_MS) return false;
      const data = Object.assign({}, obj);
      data.__ts = now;
      localStorage.setItem(finalKey, JSON.stringify(data));
      stateThrottleMap[finalKey] = now;
      bersihkanStateKadaluarsa();
      return true;
    } catch (e) { return false; }
  };
  window.dutaAmbilState = function(keyBase) {
    if (!keyBase) return null;
    try {
      const finalKey = bentukKeyState(keyBase);
      const raw = localStorage.getItem(finalKey);
      if (!raw) return null;
      let d;
      try { d = JSON.parse(raw); } catch (e) { try { localStorage.removeItem(finalKey); } catch (e2) {} return null; }
      if (!d || typeof d !== 'object') { try { localStorage.removeItem(finalKey); } catch (e2) {} return null; }
      const ts = Number(d.__ts) || 0;
      if (!ts || (Date.now() - ts) > STATE_TTL_MS) { try { localStorage.removeItem(finalKey); } catch (e2) {} return null; }
      const hasil = Object.assign({}, d);
      delete hasil.__ts;
      return hasil;
    } catch (e) { return null; }
  };
  window.dutaHapusState = function(keyBase) {
    if (!keyBase) return false;
    try {
      const finalKey = bentukKeyState(keyBase);
      localStorage.removeItem(finalKey);
      delete stateThrottleMap[finalKey];
      return true;
    } catch (e) { return false; }
  };
  window.dutaAutoSave = function(keyBase, getterFn, intervalMs) {
    if (!keyBase || typeof getterFn !== 'function') return null;
    const ms = Number(intervalMs) || 5000;
    return setInterval(function() {
      try {
        const obj = getterFn();
        if (obj && typeof obj === 'object') window.dutaSimpanState(keyBase, obj, { force: true });
      } catch (e) {}
    }, ms);
  };
  window.dutaPasangAutoSaveInput = function(keyBase, getterFn, elArr) {
    if (!keyBase || typeof getterFn !== 'function' || !Array.isArray(elArr)) return;
    elArr.forEach(function(el) {
      if (!el || !el.addEventListener) return;
      el.addEventListener('input', function() {
        try { const obj = getterFn(); if (obj && typeof obj === 'object') window.dutaSimpanState(keyBase, obj, { force: true }); } catch (e) {}
      });
      el.addEventListener('change', function() {
        try { const obj = getterFn(); if (obj && typeof obj === 'object') window.dutaSimpanState(keyBase, obj, { force: true }); } catch (e) {}
      });
    });
  };

  // ============================================
  // KIRIM NILAI (LAMA)
  // ============================================
  window.kirimNilaiBagian = async function(modul, bagian, nilai, totalBagian, nilaiAkhir) {
    const apiUrl = window.DUTA_API && window.DUTA_API.url;
    if (!apiUrl) return { ok: false, error: 'URL API tidak tersedia' };
    const idTersimpan = window.ambilIdModul(modul);
    const userId = window.ambilUserId();
    let payload; let idUntukDipakai;
    if (idTersimpan) {
      idUntukDipakai = idTersimpan;
      payload = { sheetName: modul, id: idTersimpan, bagian: bagian, nilai: Number(nilai) || 0 };
      if (nilaiAkhir !== undefined && nilaiAkhir !== null) payload.nilaiAkhir = Number(nilaiAkhir) || 0;
    } else {
      const siswa = window.ambilIdentitasSiswa();
      if (!siswa) return { ok: false, error: 'Identitas siswa belum diisi' };
      if (!Array.isArray(totalBagian) || totalBagian.length === 0) return { ok: false, error: 'totalBagian wajib diisi' };
      idUntukDipakai = userId || generateIdKlien(modul);
      payload = {
        sheetName: modul, id: idUntukDipakai,
        sekolah: normalisasiSekolah(siswa.sekolah || ''),
        nama: normalisasiNama(siswa.nama || ''),
        kelas: normalisasiKelas(siswa.kelas || ''),
        bagian: bagian, nilai: Number(nilai) || 0, totalBagian: totalBagian
      };
      window.simpanIdModul(modul, idUntukDipakai);
    }
    try {
      await fetch(apiUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
      return { ok: true, mode: idTersimpan ? 'update' : 'insert', id: idUntukDipakai };
    } catch (err) { return { ok: false, error: err.message }; }
  };
  function generateIdKlien(modul) {
    const kode = (modul || 'DUTA').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const now = new Date();
    const pad = function(n) { return String(n).padStart(2, '0'); };
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
        method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ sheetName: sheetName, nama: normalisasiNama(nama), kelas: normalisasiKelas(kelas), nilai: nilai, bagian: 'nilai_akhir', totalBagian: ['nilai_akhir'] })
      });
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  };

  // ============================================
  // DASHBOARD GURU API
  // ============================================
  window.dutaGetAllProgress = async function(username, password) {
    if (!username) return { ok: false, error: 'Username guru wajib diisi' };
    return await window.dutaFetch({ action: 'getAllProgress', username: username, password: password || '' });
  };
  window.dutaUnlockModul = async function(guruUsername, guruPassword, userIdTarget, modul) {
    if (!guruUsername) return { ok: false, error: 'Username guru wajib diisi' };
    if (!userIdTarget) return { ok: false, error: 'userId target wajib diisi' };
    if (!modul) return { ok: false, error: 'modul wajib diisi' };
    return await window.dutaFetch({ action: 'unlockModul', username: guruUsername, password: guruPassword || '', userId: userIdTarget, modul: modul });
  };
  window.dutaUpdateSiswa = async function(opts) {
    const o = opts || {};
    if (!o.username) return { ok: false, error: 'Username guru wajib diisi' };
    if (!o.userId) return { ok: false, error: 'userId target wajib diisi' };
    const payload = { action: 'updateSiswa', username: o.username, password: o.password || '', userId: o.userId };
    if (o.nama !== undefined) payload.nama = normalisasiNama(o.nama);
    if (o.kelas !== undefined) payload.kelas = normalisasiKelas(o.kelas);
    if (o.sekolah !== undefined) payload.sekolah = normalisasiSekolah(o.sekolah);
    if (o.passwordSiswa !== undefined) payload.passwordSiswa = String(o.passwordSiswa);
    return await window.dutaFetch(payload);
  };
  window.dutaHapusTamuBulk = async function(username, password, userIds) {
    if (!username) return { ok: false, error: 'Username guru wajib diisi' };
    if (!Array.isArray(userIds) || userIds.length === 0) return { ok: false, error: 'Tidak ada userId yang dikirim' };
    return await window.dutaFetch({ action: 'hapusTamuBulk', username: username, password: password || '', userIds: userIds });
  };
  window.dutaBackupData = async function(username, password) {
    if (!username) return { ok: false, error: 'Username guru wajib diisi' };
    return await window.dutaFetch({ action: 'getBackupData', username: username, password: password || '' });
  };
  window.dutaRestoreBackup = async function(username, password, backupObj) {
    if (!username) return { ok: false, error: 'Username guru wajib diisi' };
    if (!backupObj || typeof backupObj !== 'object') return { ok: false, error: 'Data backup tidak valid' };
    return await window.dutaFetch({ action: 'restoreBackup', username: username, password: password || '', backup: backupObj });
  };

  // ============================================
  // FAVICON TERPUSAT
  // ============================================
  function renderFavicon() {
    const head = document.head;
    if (!head) return;
    head.querySelectorAll('link[rel*="icon"]').forEach(function(el) { el.remove(); });

    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = getRoot() + 'favicon.png';
    head.appendChild(link);

    const apple = document.createElement('link');
    apple.rel = 'apple-touch-icon';
    apple.href = getRoot() + 'favicon.png';
    head.appendChild(apple);
  }

  // ============================================
  // AUTO-DETECT ROOT (v2 — fix file vs folder)
  // ============================================
  function autoDetectRoot() {
    if (typeof window.DUTA_ROOT === 'string' && window.DUTA_ROOT !== '') {
      return window.DUTA_ROOT;
    }

    const path = window.location.pathname;
    const marker = '/informatikaduta/';
    const idx = path.indexOf(marker);

    // Kalau tidak ada marker '/informatikaduta/', fallback hitung slash
    if (idx === -1) {
      const parts = path.split('/').filter(Boolean);
      // parts[0] = folder proyek (mis. 'informatikaduta')
      // sisanya = subfolder/file
      if (parts.length <= 1) return '';
      // Kalau bagian terakhir adalah file (.html atau tanpa ekstensi),
      // kurangi 1. Tapi kita tidak tahu pasti mana file, mana folder.
      // Asumsi: kalau ada '.' di segmen terakhir → file.
      const last = parts[parts.length - 1];
      const isFile = last.indexOf('.') !== -1;
      const depth = isFile ? parts.length - 2 : parts.length - 1;
      return '../'.repeat(depth);
    }

    // Ada marker → ambil path setelah '/informatikaduta/'
    let after = path.substring(idx + marker.length); // mis. 'login' atau 'tik/materitik'
    // Buang query string & hash
    after = after.split('?')[0].split('#')[0];
    // Buang trailing slash
    after = after.replace(/\/+$/, '');

    if (after === '') return ''; // di root

    // Pecah per segmen
    let segmen = after.split('/').filter(Boolean);
    // Contoh: 'login'          → ['login']
    //         'tik/materitik'  → ['tik', 'materitik']
    //         'dashboard/guru' → ['dashboard', 'guru']

    // Tentukan apakah segmen terakhir adalah FILE atau FOLDER
    const last = segmen[segmen.length - 1];
    const isFile = last.indexOf('.') !== -1;

    // Kalau bukan file (tanpa titik), cek apakah ini nama halaman yang dikenal.
    // Daftar halaman root yang sering diakses tanpa .html
    const HALAMAN_ROOT = ['index', 'login', 'daftar', '404', ''];
    const HALAMAN_SUBFOLDER = ['materitik','materisk','materijki','materidsi','materiad','materibk','materidap'];

    let jumlahFolder = segmen.length;

    if (isFile) {
      // Ada ekstensi .html → pasti file → kurangi 1
      jumlahFolder = segmen.length - 1;
    } else if (segmen.length === 1) {
      // Satu segmen tanpa ekstensi
      // Kalau nama halaman root → root ('')
      // Kalau nama folder (mis. 'tik') → tapi ini tidak mungkin karena
      // folder 'tik' belum tentu ada index.html. Anggap file.
      if (HALAMAN_ROOT.indexOf(last) !== -1) {
        jumlahFolder = 0;
      } else {
        // Anggap file di root (mis. 'login', 'daftar')
        jumlahFolder = 0;
      }
    } else {
      // Lebih dari 1 segmen, tanpa ekstensi
      // Cek apakah segmen terakhir adalah nama halaman yang dikenal
      if (HALAMAN_ROOT.indexOf(last) !== -1) {
        jumlahFolder = segmen.length - 1;
      } else if (HALAMAN_SUBFOLDER.indexOf(last) !== -1) {
        jumlahFolder = segmen.length - 1;
      } else {
        // Asumsi file (mis. 'tik/materitik' → materitik adalah file)
        jumlahFolder = segmen.length - 1;
      }
    }

    if (jumlahFolder <= 0) return '';
    return '../'.repeat(jumlahFolder);
  }

  // ============================================
  // AUTO-DETECT MODUL AKTIF
  // ============================================
  function autoDetectModulAktif() {
    if (typeof window.DUTA_MODUL_AKTIF === 'string' && window.DUTA_MODUL_AKTIF !== '') return window.DUTA_MODUL_AKTIF;
    const path = window.location.pathname.toLowerCase();
    let m = path.match(/\/aktivitas([a-z]+)(\d+)[a-z](?:\.html)?$/);
    if (m) return m[1] + m[2];
    m = path.match(/\/materi([a-z]+)(\d+)(?:\.html)?$/);
    if (m) return m[1] + m[2];
    m = path.match(/\/([a-z]+)(\d+)(?:\.html)?$/);
    if (m && ['tik','sk','jki','dsi','ad','bk','ap'].indexOf(m[1]) !== -1) return m[1] + m[2];
    return '';
  }

  // ============================================
  // NAVBAR
  // ============================================
  var MENU_MODUL = [
    { label: 'Teknologi Informasi dan Komunikasi',  href: 'tik/materitik', ikon: '🖥️' },
    { label: 'Sistem Komputer',   href: 'sk/materisk',   ikon: '⚙️' },
    { label: 'Jaringan Komputer dan Internet',  href: 'jki/materijki', ikon: '🌐' },
    { label: 'Dampak Sosial dan Informatika',  href: 'dsi/materidsi', ikon: '⚖️' },
    { label: 'Analisis Data',   href: 'ad/materiad',   ikon: '📊' },
    { label: 'Berpikir Komputasional',   href: 'bk/materibk',   ikon: '🧠' },
    { label: 'Algoritma Pemrograman',   href: 'ap/materidap',  ikon: '💻' }
  ];

  function renderNavbar() {
    var host = document.getElementById('duta-navbar-host');
    if (!host) return;
    var root = getRoot();
    var path = window.location.pathname.toLowerCase();

    function isAktif(href) {
      if (!href) return path.replace(/\/+$/, '') === '/informatikaduta' || path === '/informatikaduta/';
      var clean = href.replace(/\.html$/, '');
      return path.indexOf('/' + clean) !== -1;
    }

    var modulItems = MENU_MODUL.map(function(m) {
      var aktif = isAktif(m.href) ? ' class="nav-drop-item aktif"' : ' class="nav-drop-item"';
      return '<a href="' + root + m.href + '"' + aktif + '>' +
             '<span class="ndi-ikon">' + m.ikon + '</span>' +
             '<span>' + m.label + '</span></a>';
    }).join('');

    host.innerHTML =
      '<nav class="duta-navbar" aria-label="Navigasi utama">' +
        '<a href="' + root + 'index" class="nav-link' + (isAktif('') ? ' aktif' : '') + '">🏠 Beranda</a>' +
        '<div class="nav-dropdown">' +
          '<button type="button" class="nav-link nav-drop-toggle" aria-haspopup="true" aria-expanded="false">' +
            '📚 Modul <span class="nav-caret">▾</span>' +
          '</button>' +
          '<div class="nav-drop-menu" role="menu">' + modulItems + '</div>' +
        '</div>' +
        '<a href="' + root + 'ujian/daftarujian" class="nav-link' + (isAktif('ujian/daftarujian') ? ' aktif' : '') + '">📝 Ujian</a>' +
        '<a href="javascript:void(0)" class="nav-link' + (isAktif('dashboard/siswa') ? ' aktif' : '') + '" onclick="cekAksesDashboard()">📊 Dashboard</a>' +
      '</nav>';

    var toggle = host.querySelector('.nav-drop-toggle');
    var dropdown = host.querySelector('.nav-dropdown');
    if (toggle && dropdown) {
      toggle.addEventListener('click', function(e) {
        e.stopPropagation();
        var open = dropdown.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
      });
      document.addEventListener('click', function(e) {
        if (!dropdown.contains(e.target)) {
          dropdown.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }
  
    // ============================================
  // CEK AKSES DASHBOARD (Tamu / Belum Login tidak boleh masuk)
  // ============================================
  window.cekAksesDashboard = function() {
    const s = window.ambilSession ? window.ambilSession() : null;
    
    // Jika belum login atau mode tamu
    if (!s || s.tipe !== 'login') {
      tampilkanModal({
        judul: '🔒 Akses Terbatas',
        pesan: '<p style="margin-bottom:0.8rem;">Halaman Dashboard hanya tersedia untuk siswa yang sudah login.</p>' +
               '<p style="font-size:0.85rem; color:#7a6656;">Silakan login menggunakan akun siswa Anda untuk melihat progres belajar.</p>',
        tombolLanjut: '🔑 Login Sekarang',
        onLanjut: function() {
          // Simpan URL agar setelah login bisa balik ke sini
          const currentPath = window.location.pathname + window.location.search;
          try { sessionStorage.setItem('duta_redirect_after_login', currentPath); } catch (e) {}
          window.location.href = getRoot() + 'login';
        }
      });
      return;
    }

    // Jika login sebagai siswa, arahkan ke halaman dashboard
    window.location.href = getRoot() + 'dashboard/siswa';
  };

  // ============================================
  // BREADCRUMB
  // ============================================
  function renderBreadcrumb() {
  var host = document.getElementById('duta-breadcrumb-host');
  if (!host) return;
  var root = getRoot();
  var path = window.location.pathname.toLowerCase();
  var marker = '/informatikaduta/';
  var idx = path.indexOf(marker);
  var rel = '';
  if (idx !== -1) rel = path.substring(idx + marker.length);
  else rel = path.replace(/^\/+/, '');
  rel = rel.replace(/\.html$/, '').replace(/\/+$/, '');
  if (rel === 'index') rel = '';

  fetch(root + 'partials/breadcrumb.json', { cache: 'no-cache' })
    .then(function(res) { if (!res.ok) throw new Error('JSON tidak ditemukan'); return res.json(); })
    .then(function(data) {
      var items = data[rel] || [];
      if (!items || items.length === 0) { host.innerHTML = ''; return; }
      var html = '<nav class="breadcrumb-wrapper" aria-label="Breadcrumb"><ol class="breadcrumb">';
      items.forEach(function(it, i) {
        var terakhir = (i === items.length - 1);
        var punyaHref = Object.prototype.hasOwnProperty.call(it, 'href') && it.href !== undefined && it.href !== null;

        if (terakhir) {
          html += '<li aria-current="page">' + escapeHtml(it.label) + '</li>';
        } else if (punyaHref && it.href !== rel) {
          var hrefFinal = (it.href === '') ? 'index' : it.href;
          html += '<li><a href="' + root + hrefFinal + '">' + escapeHtml(it.label) + '</a></li>';
        } else {
          html += '<li>' + escapeHtml(it.label) + '</li>';
        }
      });
      html += '</ol></nav>';
      host.innerHTML = html;
    })
    .catch(function() { host.innerHTML = ''; });
}

  // ============================================
  // INIT SEMUA
  // ============================================
  function initDutaPage() {
    if (typeof window.DUTA_ROOT !== 'string' || window.DUTA_ROOT === '') {
      window.DUTA_ROOT = autoDetectRoot();
    }
    if (typeof window.DUTA_MODUL_AKTIF !== 'string' || window.DUTA_MODUL_AKTIF === '') {
      window.DUTA_MODUL_AKTIF = autoDetectModulAktif();
    }
    renderFavicon();
    renderNavbar();
    renderBreadcrumb();
  }
  window.initDutaPage = initDutaPage;

  // ============================================
  // HEADER (banner + bar user + slot navbar)
  // ============================================
  function renderHeader() {
    const el = document.getElementById('header-utama');
    if (!el) return;

    el.innerHTML =
      '<div class="banner">' +
        '<div class="banner-brand">' +
          '<h1>📡 Informatika DUTA</h1>' +
          '<span class="sub">SMPN 2 Talegong</span>' +
        '</div>' +
        '<div class="duta-navbar-slot" id="duta-navbar-host"></div>' +
        '<div class="duta-user-bar" id="duta-user-bar"></div>' +
      '</div>';

    renderUserBar();
    renderNavbar();
  }

  function renderUserBar() {
    const host = document.getElementById('duta-user-bar');
    if (!host) return;

    const s = window.ambilSession ? window.ambilSession() : null;

    if (!s) {
      // guest
      host.innerHTML =
        '<span class="ub-info ub-guest" title="Belum login">👤 Tamu</span>' +
        '<a href="javascript:void(0)" class="ub-btn ub-login" id="ubAksiLogin">🔑 Login</a>';
      const btnLogin = document.getElementById('ubAksiLogin');
      if (btnLogin) btnLogin.addEventListener('click', aksiLogin);
      return;
    }

    // sinkronkan identitas
    sinkronkanIdentitasDenganSession();
    const d = ambilIdentitasSiswaMulti();
    const jumlahTeman = (d && Array.isArray(d.teman)) ? d.teman.length : 0;

    let infoClass, infoIcon, infoLabel;
    if (s.tipe === 'login') {
      infoClass = 'ub-login';
      infoIcon  = '👤';
      infoLabel = s.nama || s.user_id;
    } else {
      infoClass = 'ub-tamu';
      infoIcon  = '🎭';
      infoLabel = s.user_id;
    }

    const badgeTeman = jumlahTeman > 0
      ? '<span class="ub-badge-teman" title="' + jumlahTeman + ' teman belajar">👥 +' + jumlahTeman + '</span>'
      : '';

    // Tombol identitas: "Kelola" untuk login, "Identitas" untuk tamu
    const labelIdentitas = s.tipe === 'login' ? '⚙️ Identitas' : '📝 Identitas';

    host.innerHTML =
      '<button type="button" class="ub-trigger" id="ubTrigger" aria-haspopup="true" aria-expanded="false">' +
        '<span class="ub-info ' + infoClass + '" title="' + escapeHtml(infoLabel) + '">' +
          infoIcon + ' <span class="ub-nama">' + escapeHtml(truncate(infoLabel, 18)) + '</span>' +
        '</span>' +
        badgeTeman +
        '<span class="ub-caret">▾</span>' +
      '</button>' +
      '<div class="ub-dropdown" id="ubDropdown" role="menu">' +
        '<div class="ub-drop-header">' +
          '<div class="ub-drop-nama">' + escapeHtml(s.nama || s.user_id) + '</div>' +
          '<div class="ub-drop-meta">' +
            (s.tipe === 'login'
              ? 'Kelas ' + escapeHtml(s.kelas || '—') + ' · ' + escapeHtml(s.sekolah || '—')
              : 'Kode Tamu') +
          '</div>' +
        '</div>' +
        '<div class="ub-drop-section" id="ubDropTemanSection"></div>' +
        '<div class="ub-drop-actions">' +
          '<button type="button" class="ub-drop-btn" id="ubAksiIdentitas">' + labelIdentitas + '</button>' +
          '<button type="button" class="ub-drop-btn ub-drop-btn-danger" id="ubAksiLogout">🚪 Logout</button>' +
        '</div>' +
      '</div>';

    // Render daftar teman di dropdown
    renderTemanDropdown();

    // Event trigger
    const trigger = document.getElementById('ubTrigger');
    const dropdown = document.getElementById('ubDropdown');
    if (trigger && dropdown) {
      trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        const open = host.classList.toggle('open');
        trigger.setAttribute('aria-expanded', String(open));
      });
      document.addEventListener('click', function(e) {
        if (!host.contains(e.target)) {
          host.classList.remove('open');
          if (trigger) trigger.setAttribute('aria-expanded', 'false');
        }
      });
      const esc = function(e) {
        if (e.key === 'Escape') {
          host.classList.remove('open');
          if (trigger) trigger.setAttribute('aria-expanded', 'false');
        }
      };
      document.addEventListener('keydown', esc);
    }

    const btnId = document.getElementById('ubAksiIdentitas');
    const btnOut = document.getElementById('ubAksiLogout');
    if (btnId) btnId.addEventListener('click', function() {
      host.classList.remove('open');
      bukaModalIdentitas();
    });
    if (btnOut) btnOut.addEventListener('click', function() {
      host.classList.remove('open');
      aksiLogout();
    });
  }
  window.renderUserBar = renderUserBar;

  function renderTemanDropdown() {
    const sec = document.getElementById('ubDropTemanSection');
    if (!sec) return;
    const d = ambilIdentitasSiswaMulti();
    if (!d) { sec.innerHTML = ''; return; }

    if (d.tipe === 'tamu') {
      const t = d.tamu;
      if (!t || !Array.isArray(t.daftarNama) || t.daftarNama.length === 0) {
        sec.innerHTML = '<div class="ub-drop-empty">Belum ada identitas tamu. Klik <strong>📝 Identitas</strong>.</div>';
      } else {
        const nama = t.daftarNama.map(function(n) { return escapeHtml(n); }).join(', ');
        sec.innerHTML =
          '<div class="ub-drop-label">👥 Identitas Tamu (' + t.daftarNama.length + ')</div>' +
          '<div class="ub-drop-tamu">' +
            '<div><strong>' + escapeHtml(nama) + '</strong></div>' +
            '<div style="font-size:0.78rem;color:#7a6656;">Kelas ' + escapeHtml(t.kelas || '—') + ' · ' + escapeHtml(t.sekolah || '—') + '</div>' +
          '</div>';
      }
      return;
    }

    // login
    const teman = d.teman || [];
    if (teman.length === 0) {
      sec.innerHTML = '<div class="ub-drop-empty">Belum ada teman. Klik <strong>⚙️ Identitas</strong> untuk menambah.</div>';
      return;
    }
    let html = '<div class="ub-drop-label">👥 Teman belajar (' + teman.length + '/' + (MAKS_TEMAN - 1) + ')</div>';
    html += '<div class="ub-drop-teman-list">';
    teman.forEach(function(t, idx) {
      html +=
        '<div class="ub-chip">' +
          '<span class="ub-chip-avatar">' + escapeHtml((t.nama || '?').charAt(0).toUpperCase()) + '</span>' +
          '<span class="ub-chip-body">' +
            '<span class="ub-chip-nama">' + escapeHtml(t.nama || t.username) + '</span>' +
            '<span class="ub-chip-meta">@' + escapeHtml(t.username) + ' · ' + escapeHtml(t.kelas || '—') + '</span>' +
          '</span>' +
          '<button type="button" class="ub-chip-hapus" data-idx="' + idx + '" title="Hapus teman">✕</button>' +
        '</div>';
    });
    html += '</div>';
    sec.innerHTML = html;

    sec.querySelectorAll('.ub-chip-hapus').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const i = parseInt(btn.dataset.idx);
        if (isNaN(i)) return;
        const d2 = ambilIdentitasSiswaMulti();
        if (!d2 || !Array.isArray(d2.teman)) return;
        const t = d2.teman[i];
        if (!t) return;
        const nama = t.nama || t.username;
        tampilkanModal({
          judul: 'Hapus Teman',
          pesan: '<p>Hapus <strong>' + escapeHtml(nama) + '</strong> dari daftar teman belajar?</p>' +
                 '<p style="font-size:0.85rem;color:#7a6656;margin-top:0.6rem;">' +
                 'Catatan: nilai yang sudah tersimpan di sheet <strong>tidak ikut terhapus</strong>. ' +
                 'Penghapusan hanya mempengaruhi pengiriman nilai berikutnya.</p>',
          tombolLanjut: '✕ Hapus',
          onLanjut: function() {
            d2.teman.splice(i, 1);
            simpanIdentitasSiswaMulti(d2);
            renderUserBar();
          }
        });
      });
    });
  }

  function truncate(s, n) {
    s = String(s || '');
    return s.length > n ? s.substring(0, n - 1) + '…' : s;
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function aksiLogin() {
    const currentPath = window.location.pathname + window.location.search;
    try { sessionStorage.setItem('duta_redirect_after_login', currentPath); } catch (e) {}
    window.location.href = getRoot() + 'login';
  }
  function aksiLogout() {
    tampilkanModal({
      judul: 'Logout',
      pesan: 'Yakin ingin logout? Progres belajar tetap tersimpan di server.',
      tombolLanjut: '🚪 Logout',
      onLanjut: function() {
        window.hapusSession();
        hapusIdentitasSiswaMulti();
        window.hapusSemuaLocalStorageUser();
        window.location.href = getRoot() + 'index';
      }
    });
  }
  async function aksiResetTamu() {
    const session = window.ambilSession();
    if (!session || session.tipe !== 'tamu') { alert('Reset hanya tersedia untuk mode Tamu.'); return; }
    tampilkanModal({
      judul: 'Reset Data Tamu',
      pesan: 'Semua data tamu <strong>' + escapeHtml(session.user_id) + '</strong> dan progres belajarnya akan dihapus permanen.<br><br>Lanjutkan?',
      tombolLanjut: '🗑️ Lanjut Hapus',
      onLanjut: async function() {
        tampilkanLoading(true);
        const hasil = await window.dutaResetUser();
        tampilkanLoading(false);
        if (hasil && hasil.ok) {
          alert('✅ Reset berhasil.');
          window.hapusSession();
          window.location.href = getRoot() + 'index';
        } else {
          alert('⚠️ Gagal reset: ' + ((hasil && hasil.error) || 'Tidak diketahui'));
        }
      }
    });
  }
  
    // ============================================
  // MODAL IDENTITAS (LOGIN: tambah teman | TAMU: isi manual)
  // ============================================
  function bukaModalIdentitas() {
    const s = window.ambilSession ? window.ambilSession() : null;
    if (!s) { aksiLogin(); return; }
    if (s.tipe === 'login') bukaModalIdentitasLogin();
    else bukaModalIdentitasTamu();
  }
  window.bukaModalIdentitas = bukaModalIdentitas;

  // ---------- MODAL LOGIN: KELOLA TEMAN ----------
  function bukaModalIdentitasLogin() {
    const s = window.ambilSession();
    if (!s) return;
    sinkronkanIdentitasDenganSession();
    const d = ambilIdentitasSiswaMulti() || { tipe:'login', utama:{}, teman:[] };

    const modal = document.createElement('div');
    modal.id = 'duta-modal-identitas';
    modal.className = 'duta-modal-overlay';
    modal.innerHTML =
      '<div class="duta-modal-box duta-modal-identitas-box">' +
        '<h3 class="duta-modal-title">⚙️ Kelola Identitas Belajar</h3>' +
        '<div class="duta-modal-body">' +
          '<div class="identitas-utama-card">' +
            '<div class="iuc-avatar">' + escapeHtml((s.nama || '?').charAt(0).toUpperCase()) + '</div>' +
            '<div class="iuc-body">' +
              '<div class="iuc-nama">' + escapeHtml(s.nama || s.user_id) + '</div>' +
              '<div class="iuc-meta">@' + escapeHtml(s.user_id) + ' · Kelas ' + escapeHtml(s.kelas || '—') + ' · ' + escapeHtml(s.sekolah || '—') + '</div>' +
            '</div>' +
            '<span class="iuc-badge">UTAMA</span>' +
          '</div>' +

          '<div class="teman-section">' +
            '<div class="teman-section-title">' +
              '👥 Teman Belajar <span class="teman-count" id="mTemanCount">0/' + (MAKS_TEMAN - 1) + '</span>' +
            '</div>' +
            '<div class="teman-chip-list" id="mTemanList"></div>' +
          '</div>' +

          '<div class="tambah-teman-section">' +
            '<div class="tambah-teman-label">➕ Tambah Teman</div>' +
            '<div class="tambah-teman-row">' +
              '<input type="text" id="mInputUsername" placeholder="Username teman" maxlength="30" autocomplete="off" spellcheck="false">' +
              '<button type="button" class="btn-cek" id="mBtnCek">🔍 Cek</button>' +
            '</div>' +
            '<div class="tambah-teman-hint" id="mHint">Ketik username, lalu klik <strong>Cek</strong>.</div>' +

            '<div class="tambah-teman-confirm" id="mConfirmBox" style="display:none;">' +
              '<div class="confirm-user" id="mConfirmUser"></div>' +
              '<div class="tambah-teman-row" style="margin-top:0.5rem;">' +
                '<input type="password" id="mInputPassword" placeholder="Password teman (untuk verifikasi)" maxlength="50" autocomplete="off">' +
                '<button type="button" class="btn-tambah" id="mBtnTambah">✓ Tambah</button>' +
              '</div>' +
              '<div class="tambah-teman-hint">Password hanya untuk verifikasi, tidak disimpan.</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="duta-modal-actions">' +
          '<button type="button" class="duta-modal-btn duta-modal-batal" id="mBtnTutup">Tutup</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    // State lokal modal
    let userTerverifikasi = null;

    const elList = modal.querySelector('#mTemanList');
    const elCount = modal.querySelector('#mTemanCount');
    const elInput = modal.querySelector('#mInputUsername');
    const elBtnCek = modal.querySelector('#mBtnCek');
    const elHint = modal.querySelector('#mHint');
    const elConfirmBox = modal.querySelector('#mConfirmBox');
    const elConfirmUser = modal.querySelector('#mConfirmUser');
    const elPwd = modal.querySelector('#mInputPassword');
    const elBtnTambah = modal.querySelector('#mBtnTambah');

    function refresh() {
      const dd = ambilIdentitasSiswaMulti();
      const teman = (dd && Array.isArray(dd.teman)) ? dd.teman : [];
      elCount.textContent = teman.length + '/' + (MAKS_TEMAN - 1);
      elList.innerHTML = '';
      if (teman.length === 0) {
        elList.innerHTML = '<div class="teman-empty">Belum ada teman. Tambahkan jika satu komputer dipakai lebih dari satu orang.</div>';
        return;
      }
      teman.forEach(function(t, idx) {
        const chip = document.createElement('div');
        chip.className = 'teman-chip';
        chip.innerHTML =
          '<span class="tc-avatar">' + escapeHtml((t.nama || '?').charAt(0).toUpperCase()) + '</span>' +
          '<span class="tc-body">' +
            '<span class="tc-nama">' + escapeHtml(t.nama || t.username) + '</span>' +
            '<span class="tc-meta">@' + escapeHtml(t.username) + ' · Kelas ' + escapeHtml(t.kelas || '—') + '</span>' +
          '</span>' +
          '<button type="button" class="tc-hapus" data-idx="' + idx + '">✕</button>';
        elList.appendChild(chip);
      });
      elList.querySelectorAll('.tc-hapus').forEach(function(btn) {
        btn.addEventListener('click', function() {
          const i = parseInt(btn.dataset.idx);
          if (isNaN(i)) return;
          const dd2 = ambilIdentitasSiswaMulti();
          if (!dd2 || !dd2.teman[i]) return;
          const t = dd2.teman[i];
          tampilkanModal({
            judul: 'Hapus Teman',
            pesan: '<p>Hapus <strong>' + escapeHtml(t.nama || t.username) + '</strong> dari daftar?</p>' +
                   '<p style="font-size:0.85rem;color:#7a6656;">Nilai yang sudah tersimpan di sheet tidak ikut terhapus.</p>',
            tombolLanjut: '✕ Hapus',
            onLanjut: function() {
              dd2.teman.splice(i, 1);
              simpanIdentitasSiswaMulti(dd2);
              refresh();
              renderUserBar();
            }
          });
        });
      });
    }
    refresh();

    // Cek username
    elBtnCek.addEventListener('click', async function() {
      const u = (elInput.value || '').trim().toLowerCase();
      if (!u) { setHint('⚠️ Ketik username dulu.', 'error'); return; }
      if (!/^[a-zA-Z0-9._-]{3,30}$/.test(u)) { setHint('⚠️ Username tidak valid.', 'error'); return; }
      if (u === (s.user_id || '').toLowerCase()) { setHint('⚠️ Itu username kamu sendiri.', 'error'); return; }

      const dd = ambilIdentitasSiswaMulti();
      if (dd && dd.teman && dd.teman.some(function(t) { return (t.username || '').toLowerCase() === u; })) {
        setHint('⚠️ Username sudah ada di daftar.', 'error'); return;
      }
      if (dd && dd.teman && dd.teman.length >= (MAKS_TEMAN - 1)) {
        setHint('⚠️ Maksimal ' + (MAKS_TEMAN - 1) + ' teman.', 'error'); return;
      }

      elBtnCek.disabled = true;
      elBtnCek.textContent = '⏳...';
      setHint('Mencari "' + u + '"...', '');
      elConfirmBox.style.display = 'none';
      userTerverifikasi = null;

      let hasil;
      try {
        hasil = await window.dutaFetch({ action: 'cariUser', username: u });
      } catch (e) { hasil = { ok: false, error: e.message }; }

      elBtnCek.disabled = false;
      elBtnCek.textContent = '🔍 Cek';

      if (!hasil || !hasil.ok) { setHint('⚠️ Gagal: ' + ((hasil && hasil.error) || 'Tidak diketahui'), 'error'); return; }
      if (hasil.tersedia) { setHint('❌ Username belum terdaftar.', 'error'); return; }

      const usr = hasil.user;
      if (!usr) { setHint('⚠️ Data user tidak lengkap.', 'error'); return; }

      const sekolahUtama = (s.sekolah || '').toUpperCase();
      const sekolahTeman = (usr.sekolah || '').toUpperCase();
      if (sekolahUtama && sekolahTeman && sekolahUtama !== sekolahTeman) {
        setHint('❌ "' + usr.nama + '" dari sekolah berbeda.', 'error'); return;
      }

      userTerverifikasi = usr;
      elConfirmUser.innerHTML =
        '<span class="cu-avatar">' + escapeHtml((usr.nama || '?').charAt(0).toUpperCase()) + '</span>' +
        '<span class="cu-body">' +
          '<span class="cu-nama">' + escapeHtml(usr.nama) + '</span>' +
          '<span class="cu-meta">@' + escapeHtml(usr.username) + ' · Kelas ' + escapeHtml(usr.kelas || '—') + '</span>' +
        '</span>';
      elConfirmBox.style.display = 'block';
      elPwd.value = '';
      elPwd.focus();
      setHint('✅ User ditemukan. Masukkan password untuk verifikasi.', 'success');
    });

    elPwd.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); elBtnTambah.click(); }
    });

    elBtnTambah.addEventListener('click', async function() {
      if (!userTerverifikasi) return;
      const pwd = (elPwd.value || '');
      if (!pwd) { setHint('⚠️ Masukkan password teman.', 'error'); return; }
      elBtnTambah.disabled = true;
      elBtnTambah.textContent = '⏳...';
      setHint('Memverifikasi password...', '');

      // Verifikasi via API login — JANGAN timpa session utama
      let hasil;
      try {
        // simpan session utama dulu
        const sessionAsli = localStorage.getItem('duta_session');
        const aktivitasAsli = localStorage.getItem('duta_aktivitas_terakhir');

        const res = await window.dutaFetch({
          action: 'login',
          username: userTerverifikasi.username,
          password: pwd
        });

        // pulihkan session utama (login() di script.js lama akan timpa — hindari dengan fetch langsung)
        if (sessionAsli !== null) localStorage.setItem('duta_session', sessionAsli);
        else localStorage.removeItem('duta_session');
        if (aktivitasAsli !== null) localStorage.setItem('duta_aktivitas_terakhir', aktivitasAsli);
        else localStorage.removeItem('duta_aktivitas_terakhir');

        hasil = res;
      } catch (e) { hasil = { ok: false, error: e.message }; }

      elBtnTambah.disabled = false;
      elBtnTambah.textContent = '✓ Tambah';

      if (!hasil || !hasil.ok) {
        setHint('❌ Password salah atau verifikasi gagal.', 'error');
        return;
      }

      // Simpan teman
      const dd = ambilIdentitasSiswaMulti() || { tipe:'login', utama:{}, teman:[] };
      if (!Array.isArray(dd.teman)) dd.teman = [];
      dd.teman.push({
        username: userTerverifikasi.username,
        nama: userTerverifikasi.nama,
        kelas: userTerverifikasi.kelas,
        sekolah: userTerverifikasi.sekolah
      });
      simpanIdentitasSiswaMulti(dd);
      userTerverifikasi = null;
      elConfirmBox.style.display = 'none';
      elInput.value = '';
      setHint('✅ Teman ditambahkan.', 'success');
      refresh();
      renderUserBar();
    });

    // Tutup
    modal.querySelector('#mBtnTutup').addEventListener('click', function() { modal.remove(); });
    const esc = function(e) { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', esc); } };
    document.addEventListener('keydown', esc);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

    function setHint(msg, tipe) {
      elHint.className = 'tambah-teman-hint' + (tipe ? ' ' + tipe : '');
      elHint.innerHTML = msg;
    }
  }

  // ---------- MODAL TAMU: IDENTITAS MANUAL ----------
  function bukaModalIdentitasTamu() {
    const s = window.ambilSession();
    if (!s) return;
    const d = ambilIdentitasSiswaMulti() || { tipe:'tamu', utama:{}, teman:[], tamu:null };
    const tamu = d.tamu || { sekolah: s.sekolah || '', kelas: s.kelas || '', daftarNama: [s.nama || ''] };

    const modal = document.createElement('div');
    modal.id = 'duta-modal-identitas-tamu';
    modal.className = 'duta-modal-overlay';
    modal.innerHTML =
      '<div class="duta-modal-box duta-modal-identitas-box">' +
        '<h3 class="duta-modal-title">📝 Identitas Tamu</h3>' +
        '<div class="duta-modal-body">' +
          '<p style="font-size:0.88rem;color:#5c4638;margin-bottom:1rem;line-height:1.6;">' +
            'Isi identitas untuk pengiriman nilai. Kode tamu kamu: <strong>' + escapeHtml(s.user_id) + '</strong>' +
          '</p>' +
          '<div class="form-row">' +
            '<label for="mTamuSekolah">Sekolah</label>' +
            '<input type="text" id="mTamuSekolah" maxlength="60" placeholder="SMPN 2 Talegong" value="' + escapeHtml(tamu.sekolah || '') + '">' +
          '</div>' +
          '<div class="form-row">' +
            '<label for="mTamuKelas">Kelas</label>' +
            '<input type="text" id="mTamuKelas" maxlength="10" placeholder="7A" value="' + escapeHtml(tamu.kelas || '') + '">' +
          '</div>' +
          '<div class="form-row">' +
            '<label for="mTamuJumlah">Jumlah Siswa</label>' +
            '<select id="mTamuJumlah">' +
              [1,2,3,4,5].map(function(n) {
                const sel = (tamu.daftarNama && tamu.daftarNama.length === n) ? ' selected' : '';
                return '<option value="' + n + '"' + sel + '>' + n + ' orang</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<div id="mTamuNamaList"></div>' +
          '<div class="form-error" id="mTamuError" style="display:none;"></div>' +
        '</div>' +
        '<div class="duta-modal-actions">' +
          '<button type="button" class="duta-modal-btn duta-modal-batal" id="mTamuBatal">Batal</button>' +
          '<button type="button" class="duta-modal-btn duta-modal-lanjut" id="mTamuSimpan">💾 Simpan</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    const elJumlah = modal.querySelector('#mTamuJumlah');
    const elList = modal.querySelector('#mTamuNamaList');
    const elErr = modal.querySelector('#mTamuError');
    const elSekolah = modal.querySelector('#mTamuSekolah');
    const elKelas = modal.querySelector('#mTamuKelas');
    const elSimpan = modal.querySelector('#mTamuSimpan');

    function renderNama(jumlah, presetNama) {
      const namaArr = Array.isArray(presetNama) ? presetNama.slice() : [];
      let html = '';
      for (let i = 0; i < jumlah; i++) {
        const val = namaArr[i] || (i === 0 ? (s.nama || '') : '');
        html +=
          '<div class="form-row">' +
            '<label>Nama ' + (i + 1) + '</label>' +
            '<input type="text" class="m-tamu-nama" maxlength="40" placeholder="Nama lengkap" value="' + escapeHtml(val) + '">' +
          '</div>';
      }
      elList.innerHTML = html;
    }
    renderNama(parseInt(elJumlah.value), tamu.daftarNama);

    elJumlah.addEventListener('change', function() {
      renderNama(parseInt(elJumlah.value), null);
    });

    elSimpan.addEventListener('click', function() {
      const sekolah = (elSekolah.value || '').trim();
      const kelas = (elKelas.value || '').trim();
      const jumlah = parseInt(elJumlah.value) || 1;
      if (!sekolah) { showErr('Sekolah wajib diisi.'); return; }
      if (!kelas) { showErr('Kelas wajib diisi.'); return; }
      const inputs = elList.querySelectorAll('.m-tamu-nama');
      const daftarNama = [];
      for (let i = 0; i < inputs.length; i++) {
        const v = (inputs[i].value || '').trim();
        if (!v) { showErr('Nama siswa ' + (i + 1) + ' wajib diisi.'); return; }
        daftarNama.push(v);
      }

      const dd = ambilIdentitasSiswaMulti() || { tipe:'tamu', utama:{}, teman:[], tamu:null };
      dd.tipe = 'tamu';
      dd.tamu = { sekolah: sekolah, kelas: kelas, daftarNama: daftarNama };
      // Update utama juga (nama gabungan)
      dd.utama = {
        username: s.user_id,
        nama: daftarNama.join(' & '),
        kelas: kelas,
        sekolah: sekolah
      };
      simpanIdentitasSiswaMulti(dd);

      // Simpan juga ke key lama (kompatibilitas)
      try { window.simpanIdentitasSiswa(sekolah, daftarNama.join(' & '), kelas); } catch (e) {}

      modal.remove();
      renderUserBar();
    });

    modal.querySelector('#mTamuBatal').addEventListener('click', function() { modal.remove(); });
    const esc = function(e) { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', esc); } };
    document.addEventListener('keydown', esc);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

    function showErr(msg) {
      elErr.textContent = '⚠️ ' + msg;
      elErr.style.display = 'block';
      elErr.classList.add('show');
    }
  }

  // ============================================
  // MODAL
  // ============================================
  function tampilkanModal(opts) {
    const lama = document.getElementById('duta-modal');
    if (lama) lama.remove();
    const modal = document.createElement('div');
    modal.id = 'duta-modal';
    modal.className = 'duta-modal-overlay';
    modal.innerHTML =
      '<div class="duta-modal-box">' +
        '<h3 class="duta-modal-title">' + escapeHtml(opts.judul || 'Konfirmasi') + '</h3>' +
        '<div class="duta-modal-body">' + (opts.pesan || '') + '</div>' +
        '<div class="duta-modal-actions">' +
          '<button type="button" class="duta-modal-btn duta-modal-batal">Batal</button>' +
          '<button type="button" class="duta-modal-btn duta-modal-lanjut">' + escapeHtml(opts.tombolLanjut || 'Lanjut') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.querySelector('.duta-modal-batal').addEventListener('click', function() { modal.remove(); });
    modal.querySelector('.duta-modal-lanjut').addEventListener('click', function() {
      modal.remove();
      if (typeof opts.onLanjut === 'function') opts.onLanjut();
    });
    const esc = function(e) { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', esc); } };
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
    el.innerHTML = '<div class="duta-modal-box" style="text-align:center; max-width:220px;">' +
                   '<div class="duta-spinner"></div>' +
                   '<div style="margin-top:0.6rem; font-weight:700; color:#5c2f8a;">Memproses…</div>' +
                   '</div>';
    document.body.appendChild(el);
  }
  window.tampilkanLoading = tampilkanLoading;

  // ============================================
  // FOOTER
  // ============================================
  function renderFooter() {
    const el = document.getElementById('footer-utama');
    if (!el) return;
    const year = new Date().getFullYear();
    el.innerHTML =
      '<div class="container" style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:0.5rem 1rem; padding:0.5rem 1rem;">' +
        '<div><span style="font-weight:600; color:#4d3829;">Kiki Husni Kamil, S.Pd.</span> · Guru Informatika</div>' +
        '<div style="text-align:right;">' +
          '<span>&copy; ' + year + ' SMPN 2 Talegong</span><br>' +
          '<span style="font-size:0.85rem; opacity:0.7;">Terbit: 2026-08-05</span>' +
        '</div>' +
      '</div>';
  }

  // ============================================
  // INFO TOGGLE & SCROLL TOP
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
    btn.addEventListener('click', function() { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    function toggle() { btn.style.display = window.scrollY > 120 ? 'flex' : 'none'; }
    window.addEventListener('scroll', toggle);
    toggle();
  }

  // ============================================
  // TOMBOL LANJUTKAN BELAJAR
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
    if (!hasil || !hasil.ok || !hasil.progress || hasil.progress.length === 0) return;
    const p = hasil.progress[0];
    const bagianTerakhir = p.bagian_terakhir || '';
    const selesai = p.nilai_akhir > 0;
    const btn = document.createElement('a');
    btn.className = 'duta-lanjut-btn';
    btn.href = '#';
    if (selesai) btn.innerHTML = '🔄 <strong>Ulangi Modul Ini</strong> — Nilai akhir: ' + p.nilai_akhir;
    else if (bagianTerakhir) btn.innerHTML = '▶️ <strong>Lanjutkan dari Bagian ' + bagianTerakhir.toUpperCase() + '</strong> — Progres tersimpan';
    else return;
    const mapBagianKeFile = opts.mapBagianKeFile || {};
    const fileTujuan = mapBagianKeFile[bagianTerakhir] || opts.halamanAwal;
    btn.href = fileTujuan;
    btn.addEventListener('click', function(e) { e.preventDefault(); window.location.href = fileTujuan; });
    container.appendChild(btn);
  };

  // ============================================
  // SLIDING EXPIRATION LISTENER
  // ============================================
  function initAktivitasListener() {
    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    let throttleTimer = null;
    function handle() {
      if (throttleTimer) return;
      throttleTimer = setTimeout(function() { throttleTimer = null; catatAktivitas(true); }, THROTTLE_AKTIVITAS_MS);
    }
    events.forEach(function(ev) { document.addEventListener(ev, handle, { passive: true }); });
  }

  // ============================================
  // EKSEKUSI
  // ============================================
  document.addEventListener('DOMContentLoaded', function() {
    // 1. Set root & modul dulu (biar getRoot() benar)
    if (typeof window.DUTA_ROOT !== 'string' || window.DUTA_ROOT === '') {
      window.DUTA_ROOT = autoDetectRoot();
    }
    if (typeof window.DUTA_MODUL_AKTIF !== 'string' || window.DUTA_MODUL_AKTIF === '') {
      window.DUTA_MODUL_AKTIF = autoDetectModulAktif();
    }

    // 2. Render favicon paling awal
    renderFavicon();

    // 3. Render header (yang juga render navbar di dalamnya)
    renderHeader();

    // 4. Render footer, breadcrumb, dll.
    renderFooter();
    renderBreadcrumb();
    initInfoToggle();
    initScrollButton();
    initAktivitasListener();

    // 5. Expose initDutaPage untuk kompatibilitas
    window.initDutaPage = initDutaPage;
  });

  console.log('✅ script.js v3.2 siap. (favicon + navbar + breadcrumb terpusat)');
})();