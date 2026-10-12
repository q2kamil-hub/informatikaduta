// script.js — versi Fase C v2.9
// Bar user di dalam header. + normalisasi + kunci modul + DUTA_MODUL_AKTIF.
// + Dashboard Guru v2: updateSiswa, hapusTamuBulk, backup, restore.
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

  // Modul aktif — diisi oleh halaman (mis. 'tik1', 'tik2', 'tik3', 'bk4')
  function getModulAktif() {
    return (typeof window.DUTA_MODUL_AKTIF === 'string') ? window.DUTA_MODUL_AKTIF : '';
  }
  window.getModulAktif = getModulAktif;

  // ============================================
  // NORMALISASI INPUT (NAMA, KELAS, SEKOLAH)
  // ============================================
  function normalisasiNama(str) {
    return String(str || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(function(kata) {
        if (!kata) return '';
        return kata.charAt(0).toUpperCase() + kata.slice(1);
      })
      .join(' ')
      .trim();
  }

  function normalisasiKelas(str) {
    let s = String(str || '').trim().toUpperCase().replace(/\s+/g, '');
    const romawiMap = { 'VIII': '8', 'VII': '7', 'IX': '9' };
    const keys = Object.keys(romawiMap).sort(function(a, b) {
      return b.length - a.length;
    });
    for (let i = 0; i < keys.length; i++) {
      const romawi = keys[i];
      if (s.indexOf(romawi) === 0) {
        s = romawiMap[romawi] + s.substring(romawi.length);
        break;
      }
    }
    const match = s.match(/^(\d+)([A-Z]*)$/);
    if (match) return match[1] + match[2];
    return s;
  }

  function normalisasiSekolah(str) {
    return String(str || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }

  window.dutaNormalisasi = {
    nama: normalisasiNama,
    kelas: normalisasiKelas,
    sekolah: normalisasiSekolah
  };

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
  // SESSION GURU (sessionStorage)
  // ============================================
  window.simpanSessionGuru = function(guru) {
    try {
      sessionStorage.setItem('duta_guru', JSON.stringify(guru || {}));
    } catch (e) {}
  };
  window.ambilSessionGuru = function() {
    try {
      const raw = sessionStorage.getItem('duta_guru');
      if (!raw) return null;
      const g = JSON.parse(raw);
      if (!g || !g.username) return null;
      return g;
    } catch (e) { return null; }
  };
  window.hapusSessionGuru = function() {
    try { sessionStorage.removeItem('duta_guru'); } catch (e) {}
  };

  // ============================================
  // HELPER: ambil nama siswa gabungan untuk dikirim ke sheet
  // ============================================
  function ambilNamaSiswaUntukSheet() {
    try {
      const modulAktif = getModulAktif();
      if (modulAktif) {
        const keyModul = 'lab' + modulAktif + '_siswa';
        try {
          const arr = JSON.parse(localStorage.getItem(keyModul) || '[]');
          if (Array.isArray(arr) && arr.length > 0) {
            const namaArr = arr
              .map(function(s) { return (s && s.nama) ? String(s.nama).trim() : ''; })
              .filter(Boolean);
            if (namaArr.length > 0) {
              return namaArr.join(' & ');
            }
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
            if (!terbaik || arr.length > terbaik.length) {
              terbaik = arr;
            }
          }
        } catch (e) {}
      }

      if (terbaik && terbaik.length > 0) {
        const namaArr = terbaik
          .map(function(s) { return (s && s.nama) ? String(s.nama).trim() : ''; })
          .filter(Boolean);
        if (namaArr.length > 0) {
          return namaArr.join(' & ');
        }
      }
    } catch (e) {}

    const ids = window.ambilIdentitasSiswa();
    if (ids && ids.nama) return ids.nama;

    return '';
  }
  window.ambilNamaSiswaUntukSheet = ambilNamaSiswaUntukSheet;

  // ============================================
  // API CALL (dasar)
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

  // ============================================
  // AUTH — SISWA
  // ============================================
  window.dutaLogin = async function(username, password) {
    const hasil = await window.dutaFetch({
      action: 'login', username: username, password: password
    });
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
      action: 'register',
      username: username,
      password: password,
      nama: normalisasiNama(nama),
      kelas: normalisasiKelas(kelas),
      sekolah: normalisasiSekolah(sekolah)
    });
  };

  window.dutaCekUser = async function(username) {
    return await window.dutaFetch({ action: 'cekUser', username: username });
  };

  window.dutaBuatTamu = async function(sekolah, nama, kelas) {
    const sekolahN = normalisasiSekolah(sekolah);
    const namaN = normalisasiNama(nama);
    const kelasN = normalisasiKelas(kelas);

    const hasil = await window.dutaFetch({
      action: 'buatTamu',
      sekolah: sekolahN,
      nama: namaN,
      kelas: kelasN
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

    if (session && session.tipe === 'login') {
      return { ok: true, tipe: 'login', user_id: session.user_id, sudah_ada: true };
    }
    if (session && session.tipe === 'tamu' && session.user_id) {
      return { ok: true, tipe: 'tamu', user_id: session.user_id, sudah_ada: true };
    }

    const hasil = await window.dutaBuatTamu(sekolah, nama, kelas);
    if (hasil && hasil.ok) {
      return { ok: true, tipe: 'tamu', user_id: hasil.kode_tamu, sudah_ada: false };
    }
    return { ok: false, error: (hasil && hasil.error) || 'Gagal membuat kode tamu' };
  };

  // ============================================
  // AUTH — GURU
  // ============================================
  /**
   * Login guru. Simpan session ke sessionStorage.duta_guru.
   * Return hasil API apa adanya.
   */
  window.dutaLoginGuru = async function(username, password) {
    const hasil = await window.dutaFetch({
      action: 'loginGuru',
      username: username,
      password: password
    });
    if (hasil && hasil.ok) {
      window.simpanSessionGuru({
        username: hasil.user_id,
        nama: hasil.nama,
        sekolah: normalisasiSekolah(hasil.sekolah || ''),
        password: password // untuk refresh di dashboard/guru.html
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
    return await window.dutaFetch({
      action: 'getProgress', userId: userId, modul: modul || ''
    });
  };

  window.dutaSimpanProgress = async function(modul, bagianTerakhir, skor, nilaiAkhir, opsi) {
    const userId = window.ambilUserId();
    if (!userId) return { ok: false, error: 'Belum login/tamu' };

    const namaSiswa = ambilNamaSiswaUntukSheet();
    const kunciModul = opsi && opsi.kunciModul === true;

    return await window.dutaFetch({
      action: 'simpanProgress',
      userId: userId,
      modul: modul,
      bagianTerakhir: bagianTerakhir || '',
      skor: skor || {},
      nilaiAkhir: nilaiAkhir || 0,
      namaSiswa: namaSiswa,
      kunciModul: kunciModul
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
            return {
              ok: true,
              terkunci: c.status === 'selesai',
              status: c.status || '',
              nilai_akhir: c.nilai_akhir || 0,
              skor_kuis: c.skor_kuis || 0,
              fromCache: true
            };
          }
        }
      } catch (e) {}
    }

    const userId = window.ambilUserId();
    if (!userId) return { ok: false, terkunci: false, status: '' };

    try {
      const hasil = await window.dutaFetch({
        action: 'getProgress', userId: userId, modul: modul
      });
      if (hasil && hasil.ok && hasil.progress && hasil.progress.length > 0) {
        const p = hasil.progress[0];
        const status = (p.status_modul || '').toString().trim().toLowerCase();
        const data = {
          ok: true,
          terkunci: status === 'selesai',
          status: status,
          nilai_akhir: Number(p.nilai_akhir) || 0,
          skor_kuis: Number(p.skor_kuis) || 0
        };
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            status: data.status,
            nilai_akhir: data.nilai_akhir,
            skor_kuis: data.skor_kuis,
            ts: Date.now()
          }));
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
  // RESET USER (tamu)
  // ============================================
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
        sekolah: normalisasiSekolah(siswa.sekolah || ''),
        nama: normalisasiNama(siswa.nama || ''),
        kelas: normalisasiKelas(siswa.kelas || ''),
        bagian: bagian,
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
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          sheetName: sheetName,
          nama: normalisasiNama(nama),
          kelas: normalisasiKelas(kelas),
          nilai: nilai,
          bagian: 'nilai_akhir', totalBagian: ['nilai_akhir']
        })
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  // ============================================
  // ===== DASHBOARD GURU — API BARU (v2.9) =====
  // ============================================

  /**
   * Ambil semua progress (guru). Filter by sekolah dilakukan di backend.
   * Return { ok:true, guru:{username,nama,sekolah}, progress:[...], total:N }
   */
  window.dutaGetAllProgress = async function(username, password) {
    if (!username) return { ok: false, error: 'Username guru wajib diisi' };
    return await window.dutaFetch({
      action: 'getAllProgress',
      username: username,
      password: password || ''
    });
  };

  /**
   * Unlock modul (guru). Buka kunci agar siswa bisa mengulang.
   * Return { ok:true, message }
   */
  window.dutaUnlockModul = async function(guruUsername, guruPassword, userIdTarget, modul) {
    if (!guruUsername) return { ok: false, error: 'Username guru wajib diisi' };
    if (!userIdTarget) return { ok: false, error: 'userId target wajib diisi' };
    if (!modul) return { ok: false, error: 'modul wajib diisi' };
    return await window.dutaFetch({
      action: 'unlockModul',
      username: guruUsername,
      password: guruPassword || '',
      userId: userIdTarget,
      modul: modul
    });
  };

  /**
   * Update identitas siswa (login only).
   * @param {object} opts
   *   - username (guru)
   *   - password (guru)
   *   - userId   (siswa target)
   *   - nama, kelas, sekolah, passwordSiswa (opsional, hanya yang ingin diubah)
   * Return { ok:true, message }
   */
  window.dutaUpdateSiswa = async function(opts) {
    const o = opts || {};
    if (!o.username) return { ok: false, error: 'Username guru wajib diisi' };
    if (!o.userId) return { ok: false, error: 'userId target wajib diisi' };

    const payload = {
      action: 'updateSiswa',
      username: o.username,
      password: o.password || '',
      userId: o.userId
    };
    if (o.nama !== undefined)          payload.nama          = normalisasiNama(o.nama);
    if (o.kelas !== undefined)         payload.kelas         = normalisasiKelas(o.kelas);
    if (o.sekolah !== undefined)       payload.sekolah       = normalisasiSekolah(o.sekolah);
    if (o.passwordSiswa !== undefined) payload.passwordSiswa = String(o.passwordSiswa);

    return await window.dutaFetch(payload);
  };

  /**
   * Hapus tamu massal. Hanya tamu.
   * @param {string} username guru
   * @param {string} password guru
   * @param {string[]} userIds array kode tamu (TAMU-XXXX)
   */
  window.dutaHapusTamuBulk = async function(username, password, userIds) {
    if (!username) return { ok: false, error: 'Username guru wajib diisi' };
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return { ok: false, error: 'Tidak ada userId yang dikirim' };
    }
    return await window.dutaFetch({
      action: 'hapusTamuBulk',
      username: username,
      password: password || '',
      userIds: userIds
    });
  };

  /**
   * Backup semua data. Return { ok:true, backup:{users,tamu,progress,guru,waktu} }
   */
  window.dutaBackupData = async function(username, password) {
    if (!username) return { ok: false, error: 'Username guru wajib diisi' };
    return await window.dutaFetch({
      action: 'getBackupData',
      username: username,
      password: password || ''
    });
  };

  /**
   * Restore dari JSON backup. HATI-HATI: overwrite semua sheet.
   * @param {object} backupObj objek backup (hasil dari dutaBackupData)
   */
  window.dutaRestoreBackup = async function(username, password, backupObj) {
    if (!username) return { ok: false, error: 'Username guru wajib diisi' };
    if (!backupObj || typeof backupObj !== 'object') {
      return { ok: false, error: 'Data backup tidak valid' };
    }
    return await window.dutaFetch({
      action: 'restoreBackup',
      username: username,
      password: password || '',
      backup: backupObj
    });
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
      barHtml = `
        <span class="ub-info ub-guest">👤 Tamu</span>
        <a href="javascript:void(0)" class="ub-btn ub-login" id="ubAksiLogin">🔑 Login</a>
      `;
    } else if (session.tipe === 'login') {
      barHtml = `
        <span class="ub-info ub-login" title="Login: ${escapeHtml(session.user_id)}">
          👤 ${escapeHtml(session.nama || session.user_id)}
        </span>
        <button type="button" class="ub-btn ub-logout" id="ubAksiLogout">🚪 Logout</button>
      `;
    } else {
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

  function aksiLogin() {
    const currentPath = window.location.pathname + window.location.search;
    try { sessionStorage.setItem('duta_redirect_after_login', currentPath); } catch (e) {}
    window.location.href = getRoot() + 'login.html';
  }

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
  window.tampilkanLoading = tampilkanLoading;

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

  console.log('✅ script.js Fase C v2.9 siap. (+ Dashboard Guru API: updateSiswa, hapusTamuBulk, backup, restore)');
})();