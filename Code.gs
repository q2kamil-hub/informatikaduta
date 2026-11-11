/**
 * Code.gs � Backend Google Apps Script untuk Portal Informatika DUTA
 * Versi: v3.6 (2026-10-28)
 *   + FIX: nilai_akhir dihitung dari bagian aktivitas yang VALID
 *     (menerima `totalBagianAktif` dari frontend, mis. ['a','b','c'] untuk TIK4)
 *   + FIX: handleSimpanProgressBulk meneruskan totalBagianAktif ke per-user
 *   + TAMBAH: recomputeNilaiAkhirSemua() � util sekali jalan untuk perbaiki data lama
 *
 * Endpoint Action:
 *   A) register          ? daftar siswa baru
 *   B) login             ? login siswa
 *   C) loginGuru         ? login guru
 *   D) cekUser           ? cek username tersedia
 *   D2) cariUser         ? cari identitas user (nama, kelas, sekolah) tanpa password
 *   E) buatTamu          ? buat kode tamu
 *   F) getProgress       ? ambil progress user
 *   G) simpanProgress    ? simpan progress (single user)
 *   G2) simpanProgressBulk ? simpan progress (multi user)
 *   H) resetUser         ? reset tamu (hapus data)
 *   I) getAllProgress    ? ambil semua progress (guru, filter sekolah)
 *   J) unlockModul       ? buka kunci modul untuk user tertentu (guru)
 *   M) updateSiswa       ? edit identitas siswa (guru)
 *   N) hapusTamuBulk     ? hapus tamu massal (guru)
 *   O) getBackupData     ? ambil semua data (guru)
 *   P) restoreBackup     ? restore dari JSON (guru)
 *   Q) getFeedbackAI     ? feedback AI via Gemini
 *   R) listKelasGuru     ? daftar kelas (guru)
 *   S) listSiswaGuru     ? daftar siswa (guru)
 *   T) getPasswordSiswa  ? ambil password siswa (guru)
 *   U) getProgressSiswaDetail ? detail progress siswa (dashboard siswa)
 *   V) listSekolahGuru   ? daftar sekolah unik (publik)
 *   W) registerGuru      ? daftar guru baru (status tunggu)
 *   X) simpanUjian       ? simpan hasil ujian
 *   Y) listSekolahUsers  ? daftar sekolah dari sheet Users
 *   Z) listUjian         ? baca tab DaftarUjian
 *   AA) verifyTokenUjian ? verifikasi token dari DaftarUjian
 *   AB) getUjianXML      ? ambil XML dari Drive setelah verifikasi token
 *   + (tanpa action) + nama ? INSERT baris (lama)
 *   + (tanpa action) + id   ? UPDATE baris (lama)
 *
 * Deploy:
 *   Extensions ? Apps Script ? paste ? Save
 *   Deploy ? Manage deployments ? Version: New version ? Deploy
 *   Execute as: Me � Who has access: Anyone
 */

// ===== KONFIGURASI =====
const NAMA_SHEET_DEFAULT = 'default';
const KOLOM_STATIS = ['id', 'waktu', 'sekolah', 'nama', 'kelas'];
const KOLOM_AKHIR = 'nilai_akhir';
const NAMA_SHEET_USERS    = 'Users';
const NAMA_SHEET_TAMU     = 'Tamu';
const NAMA_SHEET_PROGRESS = 'Progress';
const NAMA_SHEET_GURU     = 'Guru';
const NAMA_SHEET_DAFTAR_UJIAN = 'DaftarUjian';
const FOLDER_UJIAN_DRIVE_ID = '1bTxjoi_zg31i7woYOV0sQsr7Lb43oioC';
const HEADER_DAFTAR_UJIAN = ['id', 'nama_ujian', 'file_ujian', 'token', 'waktu', 'tampil_nilai', 'tampil_pembahasan'];

// Header Users: urutan baru � sekolah di kolom 5 (sebelum waktu_daftar)
const HEADER_USERS        = ['username', 'password', 'nama', 'kelas', 'sekolah', 'waktu_daftar'];
const HEADER_TAMU         = ['kode_tamu', 'sekolah', 'nama', 'kelas', 'waktu_dibuat', 'waktu_kadaluarsa'];

// Header Progress: + status_modul sebelum waktu_update
const HEADER_PROGRESS = [
  'user_id', 'modul', 'bagian_terakhir',
  'skor_a', 'skor_b', 'skor_c', 'skor_d', 'skor_e', 'skor_f',
  'skor_kuis', 'nilai_akhir', 'nama_siswa',
  'status_modul',
  'waktu_update'
];

// Header Guru: + sekolah, kontak, status
const HEADER_GURU         = ['username', 'password', 'nama', 'sekolah', 'kontak', 'status'];
const MASA_BERLAKU_TAMU_JAM = 24;

// ===== RESPONSE HELPER =====
function corsResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function doOptions(e) { return corsResponse({ ok: true }); }
function doGet(e) { return corsResponse({ ok: true, message: 'Endpoint aktif' }); }

// ================================================================
// ================= NORMALISASI INPUT ============================
// ================================================================

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
  var s = String(str || '').trim().toUpperCase().replace(/\s+/g, '');
  var romawiMap = { 'VIII': '8', 'VII': '7', 'IX': '9' };
  var keys = Object.keys(romawiMap).sort(function(a, b) {
    return b.length - a.length;
  });
  for (var i = 0; i < keys.length; i++) {
    var romawi = keys[i];
    if (s.indexOf(romawi) === 0) {
      s = romawiMap[romawi] + s.substring(romawi.length);
      break;
    }
  }
  var match = s.match(/^(\d+)([A-Z]*)$/);
  if (match) return match[1] + match[2];
  return s;
}

function normalisasiSekolah(str) {
  return String(str || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

// ===== MAIN HANDLER =====
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = (data.action || '').toString().trim();

    // FASE A
    if (action === 'register')       return handleRegister(data);
    if (action === 'login')          return handleLogin(data);
    if (action === 'buatTamu')       return handleBuatTamu(data);
    if (action === 'getProgress')        return handleGetProgress(data);
    if (action === 'simpanProgress')     return handleSimpanProgress(data);
    if (action === 'simpanProgressBulk') return handleSimpanProgressBulk(data);
    if (action === 'resetUser')          return handleResetUser(data);
    if (action === 'cekUser')        return handleCekUser(data);
    if (action === 'cariUser')       return handleCariUser(data);
    if (action === 'listSekolahGuru') return handleListSekolahGuru(data);
    if (action === 'registerGuru')    return handleRegisterGuru(data);

    // DASHBOARD
    if (action === 'loginGuru')      return handleLoginGuru(data);
    if (action === 'getAllProgress') return handleGetAllProgress(data);
    if (action === 'unlockModul')    return handleUnlockModul(data);
    if (action === 'updateSiswa')    return handleUpdateSiswa(data);
    if (action === 'hapusTamuBulk')  return handleHapusTamuBulk(data);
    if (action === 'getBackupData')  return handleGetBackupData(data);
    if (action === 'restoreBackup')  return handleRestoreBackup(data);
    if (action === 'getFeedbackAI')  return handleGetFeedbackAI(data);
    if (action === 'listKelasGuru')   return handleListKelasGuru(data);
    if (action === 'listSiswaGuru')   return handleListSiswaGuru(data);
    if (action === 'getPasswordSiswa') return handleGetPasswordSiswa(data);
    if (action === 'getProgressSiswaDetail') return handleGetProgressSiswaDetail(data);

    if (action === 'tambahUjianGuru') return handleTambahUjianGuru(data);
    if (action === 'simpanUjian')    return handleSimpanUjian(data);
    if (action === 'listSekolahUsers') return handleListSekolahUsers(data);
    if (action === 'listUjian') return handleListUjian();
    if (action === 'verifyTokenUjian') return handleVerifyTokenUjian(data);
    if (action === 'getUjianXML') return handleGetUjianXML(data);

    // ALUR LAMA INSERT / UPDATE
    const sheetName = (data.sheetName || NAMA_SHEET_DEFAULT).toString().trim();
    const bagian    = (data.bagian    || '').toString().trim();
    const nilai     = Number(data.nilai) || 0;

    if (!sheetName) return corsResponse({ ok: false, error: 'sheetName wajib diisi' });
    if (!bagian)    return corsResponse({ ok: false, error: 'bagian wajib diisi' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.nama) {
      const sekolah = normalisasiSekolah(data.sekolah);
      const nama    = normalisasiNama(data.nama);
      const kelas   = normalisasiKelas(data.kelas);
      const totalBagian = Array.isArray(data.totalBagian) ? data.totalBagian : [bagian];
      const idDariFrontend = (data.id || '').toString().trim();

      if (!nama)  return corsResponse({ ok: false, error: 'nama wajib diisi untuk mode insert' });
      if (!kelas) return corsResponse({ ok: false, error: 'kelas wajib diisi untuk mode insert' });

      return modeInsert(ss, sheetName, sekolah, nama, kelas, bagian, nilai, totalBagian, idDariFrontend);
    } else {
      const id = (data.id || '').toString().trim();
      if (!id) return corsResponse({ ok: false, error: 'id wajib diisi untuk mode update' });
      return modeUpdate(ss, sheetName, id, bagian, nilai, data.nilaiAkhir);
    }

  } catch (err) {
    return corsResponse({ ok: false, error: err.message });
  }
}

// ================================================================
// ================== MODE INSERT / UPDATE (LAMA) =================
// ================================================================

function modeInsert(ss, sheetName, sekolah, nama, kelas, bagian, nilai, totalBagian, idDariFrontend) {
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const header = buildHeader(totalBagian);
    sheet.appendRow(header);
    sheet.getRange(1, 1, 1, header.length)
      .setFontWeight('bold')
      .setBackground('#e8dcd0');
    sheet.setFrozenRows(1);
    applyColumnWidths(sheet, header);
  } else if (sheet.getLastRow() === 0) {
    const header = buildHeader(totalBagian);
    sheet.appendRow(header);
    sheet.setFrozenRows(1);
    applyColumnWidths(sheet, header);
  }

  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const id = idDariFrontend || generateId(sheetName);

  const row = new Array(header.length).fill('');
  setKolom(row, header, 'id', id);
  setKolom(row, header, 'waktu', formatWaktu(new Date()));
  setKolom(row, header, 'sekolah', sekolah);
  setKolom(row, header, 'nama', nama);
  setKolom(row, header, 'kelas', kelas);
  setKolom(row, header, bagian, nilai);

  if (totalBagian.length === 1) {
    setKolom(row, header, KOLOM_AKHIR, nilai);
  }

  sheet.appendRow(row);

  return corsResponse({
    ok: true, mode: 'insert', id: id, sheet: sheetName, bagian: bagian,
    message: 'Baris baru dibuat'
  });
}

function modeUpdate(ss, sheetName, id, bagian, nilai, nilaiAkhir) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return corsResponse({ ok: false, error: 'Sheet "' + sheetName + '" tidak ditemukan' });

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return corsResponse({ ok: false, error: 'Sheet kosong' });

  const lastCol = sheet.getLastColumn();
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const idColIndex = header.indexOf('id');
  if (idColIndex === -1) return corsResponse({ ok: false, error: 'Kolom "id" tidak ditemukan' });

  const idValues = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1).getValues();
  let targetRow = -1;
  for (let i = 0; i < idValues.length; i++) {
    if (idValues[i][0] === id) { targetRow = i + 2; break; }
  }
  if (targetRow === -1) return corsResponse({ ok: false, error: 'ID "' + id + '" tidak ditemukan' });

  const bagianColIndex = header.indexOf(bagian);
  if (bagianColIndex !== -1) sheet.getRange(targetRow, bagianColIndex + 1).setValue(nilai);

  if (nilaiAkhir !== undefined && nilaiAkhir !== null && nilaiAkhir !== '') {
    const akhirColIndex = header.indexOf(KOLOM_AKHIR);
    if (akhirColIndex !== -1) sheet.getRange(targetRow, akhirColIndex + 1).setValue(Number(nilaiAkhir) || 0);
  }

  const waktuColIndex = header.indexOf('waktu');
  if (waktuColIndex !== -1) sheet.getRange(targetRow, waktuColIndex + 1).setValue(formatWaktu(new Date()));

  return corsResponse({
    ok: true, mode: 'update', id: id, sheet: sheetName, bagian: bagian,
    nilai: nilai, nilaiAkhir: nilaiAkhir || null, message: 'Baris diperbarui'
  });
}

// ===== HELPER LAMA =====
function buildHeader(totalBagian) {
  const bagianArr = Array.isArray(totalBagian) ? totalBagian.slice() : [];
  bagianArr.sort();
  return KOLOM_STATIS.concat(bagianArr).concat([KOLOM_AKHIR]);
}
function setKolom(row, header, namaKolom, value) {
  const idx = header.indexOf(namaKolom);
  if (idx !== -1) row[idx] = value;
}
function formatWaktu(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}
function generateId(sheetName) {
  const kode = (sheetName || 'DUTA').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const now = new Date();
  const tgl = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd');
  const jam = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HHmmss');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return kode + '-' + tgl + '-' + jam + '-' + rand;
}
function applyColumnWidths(sheet, header) {
  header.forEach((nama, i) => {
    const col = i + 1;
    if (nama === 'id')         sheet.setColumnWidth(col, 220);
    else if (nama === 'waktu') sheet.setColumnWidth(col, 160);
    else if (nama === 'sekolah') sheet.setColumnWidth(col, 180);
    else if (nama === 'nama')  sheet.setColumnWidth(col, 240);
    else if (nama === 'kelas') sheet.setColumnWidth(col, 80);
    else if (nama === 'nilai_akhir') sheet.setColumnWidth(col, 100);
    else                       sheet.setColumnWidth(col, 70);
  });
}

// ================================================================
// ==================== FASE A � FUNGSI BARU ======================
// ================================================================

function pastikanSheet(ss, namaSheet, header) {
  let sheet = ss.getSheetByName(namaSheet);
  if (!sheet) {
    sheet = ss.insertSheet(namaSheet);
    sheet.appendRow(header);
    sheet.getRange(1, 1, 1, header.length)
      .setFontWeight('bold')
      .setBackground('#e8dcd0');
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(header);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Pastikan sheet Guru punya kolom 'sekolah', 'kontak', 'status'.
 */
function pastikanHeaderGuru(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.appendRow(HEADER_GURU);
    sheet.setFrozenRows(1);
    return;
  }
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  if (header.indexOf('sekolah') === -1) {
    sheet.getRange(1, lastCol + 1).setValue('sekolah');
    header.push('sekolah');
  }
  if (header.indexOf('kontak') === -1) {
    sheet.getRange(1, header.length + 1).setValue('kontak');
    header.push('kontak');
  }
  if (header.indexOf('status') === -1) {
    sheet.getRange(1, header.length + 1).setValue('status');
    header.push('status');
  }
}

function pastikanHeaderProgress(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.appendRow(HEADER_PROGRESS);
    sheet.setFrozenRows(1);
    return;
  }
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (header.indexOf('status_modul') === -1) {
    const idxWaktu = header.indexOf('waktu_update');
    if (idxWaktu !== -1) {
      sheet.insertColumnBefore(idxWaktu + 1);
      sheet.getRange(1, idxWaktu + 1).setValue('status_modul');
    } else {
      sheet.getRange(1, lastCol + 1).setValue('status_modul');
    }
  }
}

function validasiUsername(username) {
  if (!username) return 'Username wajib diisi';
  if (username.length < 3) return 'Username minimal 3 karakter';
  if (username.length > 30) return 'Username maksimal 30 karakter';
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) return 'Username hanya boleh huruf, angka, titik, garis bawah, dan strip';
  return null;
}

function validasiPassword(password, username) {
  if (!password) return 'Password wajib diisi';
  if (password.length < 4) return 'Password minimal 4 karakter';
  if (password.length > 50) return 'Password maksimal 50 karakter';
  if (/\s/.test(password)) return 'Password tidak boleh mengandung spasi';
  if (password.toLowerCase() === username.toLowerCase()) return 'Password tidak boleh sama dengan username';
  return null;
}

// ===== REGISTER (SISWA) =====
function handleRegister(data) {
  try {
    const username = (data.username || '').toString().trim().toLowerCase();
    const password = (data.password || '').toString();
    const nama     = normalisasiNama(data.nama);
    const kelas    = normalisasiKelas(data.kelas);
    const sekolah  = normalisasiSekolah(data.sekolah);

    const errU = validasiUsername(username);
    if (errU) return corsResponse({ ok: false, error: errU });

    const errP = validasiPassword(password, username);
    if (errP) return corsResponse({ ok: false, error: errP });

    if (!nama)    return corsResponse({ ok: false, error: 'Nama wajib diisi' });
    if (!kelas)   return corsResponse({ ok: false, error: 'Kelas wajib diisi' });
    if (!sekolah) return corsResponse({ ok: false, error: 'Nama sekolah wajib diisi' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = pastikanSheet(ss, NAMA_SHEET_USERS, HEADER_USERS);

    // Cek unik username
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const usernames = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
      if (usernames.map(u => String(u).toLowerCase()).indexOf(username) !== -1) {
        return corsResponse({ ok: false, error: 'Username "' + username + '" sudah terdaftar' });
      }
    }

    // Validasi sekolah harus terdaftar di sheet Guru
    const sheetGuru = ss.getSheetByName(NAMA_SHEET_GURU);
    let sekolahValid = false;
    if (sheetGuru && sheetGuru.getLastRow() >= 2) {
      const lastCol = sheetGuru.getLastColumn();
      const header = sheetGuru.getRange(1, 1, 1, lastCol).getValues()[0];
      const idxSekolah = header.indexOf('sekolah');

      if (idxSekolah !== -1) {
        const valuesGuru = sheetGuru.getRange(2, 1, sheetGuru.getLastRow() - 1, lastCol).getValues();
        for (let i = 0; i < valuesGuru.length; i++) {
          if (normalisasiSekolah(valuesGuru[i][idxSekolah]) === sekolah) {
            sekolahValid = true;
            break;
          }
        }
      }
    }
    if (!sekolahValid) {
      return corsResponse({ ok: false, error: 'Sekolah "' + sekolah + '" belum terdaftar. Pastikan Guru Anda sudah mendaftar.' });
    }

    sheet.appendRow([
      username, password, nama, kelas, sekolah, formatWaktu(new Date())
    ]);

    return corsResponse({
      ok: true,
      user_id: username,
      nama: nama, kelas: kelas, sekolah: sekolah,
      message: 'Pendaftaran berhasil'
    });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal daftar: ' + err.message });
  }
}

// ===== LOGIN SISWA =====
function handleLogin(data) {
  try {
    const username = (data.username || '').toString().trim().toLowerCase();
    const password = (data.password || '').toString();

    if (!username) return corsResponse({ ok: false, error: 'Username wajib diisi' });
    if (!password) return corsResponse({ ok: false, error: 'Password wajib diisi' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(NAMA_SHEET_USERS);
    if (!sheet) return corsResponse({ ok: false, error: 'Belum ada user terdaftar' });

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return corsResponse({ ok: false, error: 'Belum ada user terdaftar' });

    const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();

    for (let i = 0; i < values.length; i++) {
      const rowUser   = (values[i][0] || '').toString().trim().toLowerCase();
      const rowPass   = (values[i][1] || '').toString();
      const rowNama   = normalisasiNama(values[i][2]);
      const rowKelas  = normalisasiKelas(values[i][3]);
      const rowSekolah = normalisasiSekolah(values[i][4]);

      if (rowUser === username) {
        if (rowPass === password) {
          return corsResponse({
            ok: true,
            user_id: username,
            nama: rowNama, kelas: rowKelas, sekolah: rowSekolah,
            message: 'Login berhasil'
          });
        }
        return corsResponse({ ok: false, error: 'Password salah' });
      }
    }

    return corsResponse({ ok: false, error: 'Username tidak ditemukan' });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal login: ' + err.message });
  }
}

// ===== CEK USER =====
function handleCekUser(data) {
  try {
    const username = (data.username || '').toString().trim().toLowerCase();
    if (!username) return corsResponse({ ok: false, error: 'Username wajib diisi' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(NAMA_SHEET_USERS);
    if (!sheet || sheet.getLastRow() < 2) {
      return corsResponse({ ok: true, tersedia: true });
    }

    const usernames = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
    const dipakai = usernames.map(u => String(u).toLowerCase()).indexOf(username) !== -1;

    return corsResponse({ ok: true, tersedia: !dipakai });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal cek user: ' + err.message });
  }
}

// ===== CARI USER (untuk fitur Tambah Teman) =====
function handleCariUser(data) {
  try {
    const username = (data.username || '').toString().trim().toLowerCase();
    if (!username) return corsResponse({ ok: false, error: 'Username wajib diisi' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(NAMA_SHEET_USERS);
    if (!sheet || sheet.getLastRow() < 2) {
      return corsResponse({ ok: true, tersedia: true });
    }

    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
    for (let i = 0; i < values.length; i++) {
      const u = (values[i][0] || '').toString().trim().toLowerCase();
      if (u === username) {
        return corsResponse({
          ok: true,
          tersedia: false,
          user: {
            username: u,
            nama: normalisasiNama(values[i][2]),
            kelas: normalisasiKelas(values[i][3]),
            sekolah: normalisasiSekolah(values[i][4])
          }
        });
      }
    }
    return corsResponse({ ok: true, tersedia: true });
  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal cari user: ' + err.message });
  }
}

/**
 * handleListSekolahGuru
 * Publik � tanpa login. Untuk dropdown sekolah di daftar siswa.
 */
function handleListSekolahGuru(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetGuru = ss.getSheetByName(NAMA_SHEET_GURU);

    if (!sheetGuru || sheetGuru.getLastRow() < 2) {
      return corsResponse({ ok: true, sekolah: [] });
    }

    pastikanHeaderGuru(sheetGuru);

    const lastCol = sheetGuru.getLastColumn();
    const header = sheetGuru.getRange(1, 1, 1, lastCol).getValues()[0];
    const idxSekolah = header.indexOf('sekolah');
    if (idxSekolah === -1) {
      return corsResponse({ ok: true, sekolah: [] });
    }

    const values = sheetGuru.getRange(2, 1, sheetGuru.getLastRow() - 1, lastCol).getValues();
    const setSekolah = {};

    values.forEach(function(r) {
      const sekolah = normalisasiSekolah(r[idxSekolah]);
      if (!sekolah) return;
      setSekolah[sekolah] = true;
    });

    const sekolahArr = Object.keys(setSekolah).sort(function(a, b) {
      return a.localeCompare(b);
    });

    return corsResponse({ ok: true, sekolah: sekolahArr });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal ambil daftar sekolah: ' + err.message });
  }
}

/**
 * handleRegisterGuru
 * Status otomatis 'tunggu'. Cek unik di Users & Guru.
 */
function handleRegisterGuru(data) {
  try {
    const username = (data.username || '').toString().trim().toLowerCase();
    const password = (data.password || '').toString();
    const nama     = normalisasiNama(data.nama);
    const sekolah  = normalisasiSekolah(data.sekolah);
    const kontak   = (data.kontak || '').toString().trim();

    const errU = validasiUsername(username);
    if (errU) return corsResponse({ ok: false, error: errU });

    if (!password) return corsResponse({ ok: false, error: 'Password wajib diisi' });
    if (password.length < 6) return corsResponse({ ok: false, error: 'Password minimal 6 karakter' });
    if (password.length > 50) return corsResponse({ ok: false, error: 'Password maksimal 50 karakter' });
    if (/\s/.test(password)) return corsResponse({ ok: false, error: 'Password tidak boleh mengandung spasi' });
    if (password.toLowerCase() === username.toLowerCase()) return corsResponse({ ok: false, error: 'Password tidak boleh sama dengan username' });

    if (!nama)    return corsResponse({ ok: false, error: 'Nama wajib diisi' });
    if (!sekolah) return corsResponse({ ok: false, error: 'Nama sekolah wajib diisi' });
    if (!kontak)  return corsResponse({ ok: false, error: 'Nomor kontak wajib diisi' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Cek unik di Users
    const sheetUsers = ss.getSheetByName(NAMA_SHEET_USERS);
    if (sheetUsers && sheetUsers.getLastRow() >= 2) {
      const usernames = sheetUsers.getRange(2, 1, sheetUsers.getLastRow() - 1, 1).getValues().flat();
      if (usernames.map(u => String(u).toLowerCase()).indexOf(username) !== -1) {
        return corsResponse({ ok: false, error: 'Username sudah terdaftar sebagai SISWA. Coba yang lain.' });
      }
    }

    // Cek unik di Guru
    const sheetGuru = pastikanSheet(ss, NAMA_SHEET_GURU, HEADER_GURU);
    pastikanHeaderGuru(sheetGuru);

    if (sheetGuru.getLastRow() >= 2) {
      const usernamesGuru = sheetGuru.getRange(2, 1, sheetGuru.getLastRow() - 1, 1).getValues().flat();
      if (usernamesGuru.map(u => String(u).toLowerCase()).indexOf(username) !== -1) {
        return corsResponse({ ok: false, error: 'Username sudah terdaftar sebagai GURU. Coba yang lain.' });
      }
    }

    const row = [username, password, nama, sekolah, kontak, 'tunggu'];
    sheetGuru.appendRow(row);

    return corsResponse({
      ok: true,
      message: 'Pendaftaran guru berhasil. Menunggu persetujuan admin.'
    });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal daftar guru: ' + err.message });
  }
}

// ===== BUAT TAMU =====
function handleBuatTamu(data) {
  try {
    const sekolah = normalisasiSekolah(data.sekolah);
    const nama    = normalisasiNama(data.nama);
    const kelas   = normalisasiKelas(data.kelas);

    if (!nama)  return corsResponse({ ok: false, error: 'Nama wajib diisi' });
    if (!kelas) return corsResponse({ ok: false, error: 'Kelas wajib diisi' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = pastikanSheet(ss, NAMA_SHEET_TAMU, HEADER_TAMU);

    let kodeTamu = '';
    let bentrok = true;
    let percobaan = 0;
    while (bentrok && percobaan < 10) {
      kodeTamu = 'TAMU-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      bentrok = cekKodeTamuAda(sheet, kodeTamu);
      percobaan++;
    }

    const now = new Date();
    const kadaluarsa = new Date(now.getTime() + MASA_BERLAKU_TAMU_JAM * 60 * 60 * 1000);

    sheet.appendRow([
      kodeTamu, sekolah, nama, kelas,
      formatWaktu(now), formatWaktu(kadaluarsa)
    ]);

    return corsResponse({
      ok: true,
      kode_tamu: kodeTamu,
      nama: nama, kelas: kelas, sekolah: sekolah,
      kadaluarsa: formatWaktu(kadaluarsa),
      message: 'Sesi tamu dibuat'
    });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal buat tamu: ' + err.message });
  }
}

function cekKodeTamuAda(sheet, kode) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  const kodes = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  return kodes.map(k => String(k).toUpperCase()).indexOf(kode.toUpperCase()) !== -1;
}

// ===== GET PROGRESS =====
function handleGetProgress(data) {
  try {
    const userId = (data.userId || '').toString().trim();
    const modulFilter = (data.modul || '').toString().trim();

    if (!userId) return corsResponse({ ok: false, error: 'userId wajib diisi' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(NAMA_SHEET_PROGRESS);
    if (!sheet || sheet.getLastRow() < 2) {
      return corsResponse({ ok: true, progress: [], message: 'Belum ada progress' });
    }

    pastikanHeaderProgress(sheet);

    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADER_PROGRESS.length).getValues();
    const hasil = [];

    values.forEach(function(row) {
      const rowUser = (row[0] || '').toString().trim();
      const rowModul = (row[1] || '').toString().trim();

      if (rowUser !== userId) return;
      if (modulFilter && rowModul !== modulFilter) return;

      hasil.push({
        modul: rowModul,
        bagian_terakhir: (row[2] || '').toString(),
        skor_a: Number(row[3]) || 0,
        skor_b: Number(row[4]) || 0,
        skor_c: Number(row[5]) || 0,
        skor_d: Number(row[6]) || 0,
        skor_e: Number(row[7]) || 0,
        skor_f: Number(row[8]) || 0,
        skor_kuis: Number(row[9]) || 0,
        nilai_akhir: Number(row[10]) || 0,
        nama_siswa: normalisasiNama(row[11]),
        status_modul: (row[12] || '').toString().trim(),
        waktu_update: (row[13] || '').toString()
      });
    });

    return corsResponse({ ok: true, progress: hasil });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal ambil progress: ' + err.message });
  }
}

// ===== SIMPAN PROGRESS (single) =====
function handleSimpanProgress(data) {
  try {
    const userId = (data.userId || '').toString().trim();
    if (!userId) return corsResponse({ ok: false, error: 'userId wajib diisi' });

    const hasil = simpanProgressSatuUser(userId, data);
    if (!hasil.ok) {
      return corsResponse({ ok: false, error: hasil.error || 'Gagal simpan progress' });
    }
    return corsResponse({
      ok: true,
      message: 'Progress disimpan',
      modul: hasil.modul,
      status_modul: hasil.status_modul,
      locked: hasil.locked === true,
      nilai_akhir_lama: hasil.nilai_akhir_lama || 0,
      nilai_akhir_baru: hasil.nilai_akhir_baru || 0,
      userId: userId
    });
  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal simpan progress: ' + err.message });
  }
}

// ===== SIMPAN PROGRESS BULK (multi-user) =====
/**
 * handleSimpanProgressBulk
 * Input: {
 *   action: 'simpanProgressBulk',
 *   userIds: ['asep', 'usep', ...],
 *   modul: 'tik4',
 *   bagianTerakhir: 'a' | 'b' | ...,
 *   skor: { a: 80, b: 70, ... },
 *   nilaiAkhir: 0,                       // untuk kunciModul:true, backend hitung ulang
 *   namaSiswa: 'Asep & Usep',
 *   kunciModul: false,
 *   totalBagianAktif: ['a','b','c']      // ?? BARU: bagian yang VALID untuk modul ini
 * }
 */
function handleSimpanProgressBulk(data) {
  try {
    const userIdsRaw = data.userIds;
    if (!Array.isArray(userIdsRaw) || userIdsRaw.length === 0) {
      return corsResponse({ ok: false, error: 'userIds wajib berupa array dan tidak boleh kosong' });
    }

    const seen = {};
    const userIds = [];
    for (let i = 0; i < userIdsRaw.length; i++) {
      const uid = String(userIdsRaw[i] || '').trim();
      if (!uid) continue;
      const key = uid.toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;
      userIds.push(uid);
    }

    if (userIds.length === 0) {
      return corsResponse({ ok: false, error: 'Tidak ada userId valid dalam array' });
    }

    const modul = (data.modul || '').toString().trim();
    if (!modul) return corsResponse({ ok: false, error: 'modul wajib diisi' });

    const namaSiswaBulk = (data.namaSiswa || '').toString().trim();

    // totalBagianAktif validasi
    let totalBagianAktif = null;
    if (Array.isArray(data.totalBagianAktif) && data.totalBagianAktif.length > 0) {
      totalBagianAktif = data.totalBagianAktif
        .map(function(b) { return String(b || '').toLowerCase().trim(); })
        .filter(function(b) { return ['a','b','c','d','e','f'].indexOf(b) !== -1; });
    }

    const payloadDasar = {
      modul: modul,
      bagianTerakhir: data.bagianTerakhir || '',
      skor: data.skor || {},
      nilaiAkhir: data.nilaiAkhir || 0,
      kunciModul: data.kunciModul === true,
      totalBagianAktif: totalBagianAktif
    };

    const results = [];
    let sukses = 0;
    let gagal = 0;

    for (let i = 0; i < userIds.length; i++) {
      const uid = userIds[i];
      try {
        const payload = {
          modul: payloadDasar.modul,
          bagianTerakhir: payloadDasar.bagianTerakhir,
          skor: payloadDasar.skor,
          nilaiAkhir: payloadDasar.nilaiAkhir,
          kunciModul: payloadDasar.kunciModul,
          totalBagianAktif: payloadDasar.totalBagianAktif,
          namaSiswa: namaSiswaBulk || data.namaSiswa || ''
        };

        const hasil = simpanProgressSatuUser(uid, payload);
        if (hasil.ok) {
          sukses++;
          results.push({
            userId: uid,
            ok: true,
            locked: hasil.locked === true,
            status_modul: hasil.status_modul || '',
            nilai_akhir_lama: hasil.nilai_akhir_lama || 0,
            nilai_akhir_baru: hasil.nilai_akhir_baru || 0
          });
        } else {
          gagal++;
          results.push({
            userId: uid,
            ok: false,
            error: hasil.error || 'Gagal simpan'
          });
        }
      } catch (eUser) {
        gagal++;
        results.push({
          userId: uid,
          ok: false,
          error: eUser.message || 'Exception'
        });
      }
    }

    return corsResponse({
      ok: true,
      message: 'Bulk simpan selesai: ' + sukses + ' sukses, ' + gagal + ' gagal.',
      modul: modul,
      sukses: sukses,
      gagal: gagal,
      results: results
    });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal bulk simpan: ' + err.message });
  }
}

// ===== HELPER INTI: simpan progress untuk SATU user =====
/**
 * simpanProgressSatuUser(userId, data)
 * data: {
 *   modul, bagianTerakhir, skor, nilaiAkhir, namaSiswa, kunciModul,
 *   totalBagianAktif: ['a','b','c']  // ?? BARU � bagian aktivitas yang dinilai
 * }
 *
 * Saat kunciModul: true, nilai_akhir DIHITUNG ULANG dari:
 *   rata-rata skor HANYA bagian di totalBagianAktif (fallback: a..f)
 *   � 0.5 + skor_kuis � 0.5
 */
function simpanProgressSatuUser(userId, data) {
  const uid = (userId || '').toString().trim();
  if (!uid) return { ok: false, error: 'userId kosong' };

  const modul = (data.modul || '').toString().trim();
  if (!modul) return { ok: false, error: 'modul kosong' };

  const namaSiswaRaw = (data.namaSiswa || '').toString().trim();
  const namaSiswa = namaSiswaRaw
    .split('&')
    .map(function(s) { return normalisasiNama(s); })
    .filter(Boolean)
    .join(' & ');

  const bagianTerakhir = (data.bagianTerakhir || '').toString().trim();
  const skor = data.skor || {};
  const nilaiAkhir = Number(data.nilaiAkhir) || 0;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = pastikanSheet(ss, NAMA_SHEET_PROGRESS, HEADER_PROGRESS);
  pastikanHeaderProgress(sheet);

  const lastRow = sheet.getLastRow();
  let targetRow = -1;
  let existing = null;

  if (lastRow >= 2) {
    const values = sheet.getRange(2, 1, lastRow - 1, HEADER_PROGRESS.length).getValues();
    for (let i = 0; i < values.length; i++) {
      const rowUser = (values[i][0] || '').toString().trim();
      const rowModul = (values[i][1] || '').toString().trim();
      if (rowUser === uid && rowModul === modul) {
        targetRow = i + 2;
        existing = values[i];
        break;
      }
    }
  }

  const now = formatWaktu(new Date());

  // ---- Cek kunci modul ----
  if (existing) {
    const statusLama = (existing[12] || '').toString().trim().toLowerCase();
    if (statusLama === 'selesai') {
      const waktuColIdx = HEADER_PROGRESS.indexOf('waktu_update') + 1;
      const namaColIdx = HEADER_PROGRESS.indexOf('nama_siswa') + 1;
      if (waktuColIdx > 0) sheet.getRange(targetRow, waktuColIdx).setValue(now);
      if (namaColIdx > 0 && namaSiswa) sheet.getRange(targetRow, namaColIdx).setValue(namaSiswa);

      return {
        ok: true,
        locked: true,
        modul: modul,
        status_modul: 'selesai',
        nilai_akhir_lama: Number(existing[10]) || 0
      };
    }
  }

  const skorLama = existing ? {
    a: Number(existing[3]) || 0,
    b: Number(existing[4]) || 0,
    c: Number(existing[5]) || 0,
    d: Number(existing[6]) || 0,
    e: Number(existing[7]) || 0,
    f: Number(existing[8]) || 0,
    kuis: Number(existing[9]) || 0,
    nilaiAkhir: Number(existing[10]) || 0,
    namaSiswa: (existing[11] || '').toString(),
    statusModul: (existing[12] || '').toString()
  } : { a:0,b:0,c:0,d:0,e:0,f:0,kuis:0,nilaiAkhir:0,namaSiswa:'',statusModul:'' };

  const skorBaru = {
    a: (skor.a !== undefined) ? Number(skor.a) : skorLama.a,
    b: (skor.b !== undefined) ? Number(skor.b) : skorLama.b,
    c: (skor.c !== undefined) ? Number(skor.c) : skorLama.c,
    d: (skor.d !== undefined) ? Number(skor.d) : skorLama.d,
    e: (skor.e !== undefined) ? Number(skor.e) : skorLama.e,
    f: (skor.f !== undefined) ? Number(skor.f) : skorLama.f,
    kuis: (skor.kuis !== undefined) ? Number(skor.kuis) : skorLama.kuis,
    nilaiAkhir: nilaiAkhir || skorLama.nilaiAkhir,
    namaSiswa: namaSiswa || skorLama.namaSiswa,
    statusModul: skorLama.statusModul
  };

  const kunciModul = (data.kunciModul === true) || (data.statusModul === 'selesai');
  if (kunciModul) skorBaru.statusModul = 'selesai';

  // ?? HITUNG ULANG nilai_akhir saat kunciModul:true
  let bagianValid = [];
  let rataAktivitas = 0;
  let skorKuisBaru = 0;
  let nilaiAkhirDihitung = skorBaru.nilaiAkhir;

  if (kunciModul) {
    // Tentukan bagian aktivitas yang valid
    if (Array.isArray(data.totalBagianAktif) && data.totalBagianAktif.length > 0) {
      bagianValid = data.totalBagianAktif
        .map(function(b) { return String(b || '').toLowerCase().trim(); })
        .filter(function(b) { return ['a','b','c','d','e','f'].indexOf(b) !== -1; });
    }
    if (bagianValid.length === 0) {
      // Fallback: pakai semua kolom skor_* yang ada di HEADER_PROGRESS
      bagianValid = ['a','b','c','d','e','f'].filter(function(b) {
        return HEADER_PROGRESS.indexOf('skor_' + b) !== -1;
      });
    }

    const skorArr = bagianValid.map(function(b) { return Number(skorBaru[b]) || 0; });
    rataAktivitas = skorArr.length > 0
      ? skorArr.reduce(function(x, y) { return x + y; }, 0) / skorArr.length
      : 0;

    skorKuisBaru = Number(skorBaru.kuis) || 0;
    nilaiAkhirDihitung = Math.round((rataAktivitas * 0.5) + (skorKuisBaru * 0.5));
    skorBaru.nilaiAkhir = nilaiAkhirDihitung;

    // Log untuk debug (bisa dihapus kalau tidak perlu)
    try {
      console.log('[simpanProgressSatuUser] ' + uid + ' modul=' + modul +
        ' bagianValid=[' + bagianValid.join(',') + ']' +
        ' rata=' + rataAktivitas +
        ' kuis=' + skorKuisBaru +
        ' nilaiAkhir=' + nilaiAkhirDihitung);
    } catch (e) {}
  }

  const row = [
    uid, modul, bagianTerakhir,
    skorBaru.a, skorBaru.b, skorBaru.c, skorBaru.d, skorBaru.e, skorBaru.f,
    skorBaru.kuis, skorBaru.nilaiAkhir,
    skorBaru.namaSiswa,
    skorBaru.statusModul,
    now
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return {
    ok: true,
    modul: modul,
    status_modul: skorBaru.statusModul || 'proses',
    locked: false,
    nilai_akhir_baru: skorBaru.nilaiAkhir
  };
}

// ===== RESET USER (tamu) =====
function handleResetUser(data) {
  try {
    const userId = (data.userId || '').toString().trim();
    if (!userId) return corsResponse({ ok: false, error: 'userId wajib diisi' });

    if (userId.toUpperCase().indexOf('TAMU-') !== 0) {
      return corsResponse({
        ok: false,
        error: 'Reset hanya diizinkan untuk user tamu (kode TAMU-).'
      });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let jumlahHapus = 0;

    const sheetProgress = ss.getSheetByName(NAMA_SHEET_PROGRESS);
    if (sheetProgress && sheetProgress.getLastRow() >= 2) {
      const lastRow = sheetProgress.getLastRow();
      const values = sheetProgress.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = values.length - 1; i >= 0; i--) {
        if ((values[i][0] || '').toString().trim() === userId) {
          sheetProgress.deleteRow(i + 2);
          jumlahHapus++;
        }
      }
    }

    const sheetTamu = ss.getSheetByName(NAMA_SHEET_TAMU);
    if (sheetTamu && sheetTamu.getLastRow() >= 2) {
      const lastRow = sheetTamu.getLastRow();
      const values = sheetTamu.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = values.length - 1; i >= 0; i--) {
        if ((values[i][0] || '').toString().trim() === userId) {
          sheetTamu.deleteRow(i + 2);
          jumlahHapus++;
        }
      }
    }

    return corsResponse({
      ok: true,
      message: 'Reset berhasil. ' + jumlahHapus + ' baris dihapus.',
      user_id: userId
    });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal reset: ' + err.message });
  }
}

// ================================================================
// ============ DASHBOARD � FUNGSI BARU ==========================
// ================================================================

/**
 * Helper: verifikasi guru + ambil info (username, nama, sekolah)
 * Return { ok:true, guru:{username, nama, sekolah} } atau { ok:false, error }
 */
function verifikasiGuru(ss, username, password) {
  const sheetGuru = ss.getSheetByName(NAMA_SHEET_GURU);
  if (!sheetGuru || sheetGuru.getLastRow() < 2) {
    return { ok: false, error: 'Sheet "Guru" belum ada / kosong. Hubungi admin.' };
  }
  pastikanHeaderGuru(sheetGuru);

  const lastCol = sheetGuru.getLastColumn();
  const header = sheetGuru.getRange(1, 1, 1, lastCol).getValues()[0];
  const idxUser = header.indexOf('username');
  const idxPass = header.indexOf('password');
  const idxNama = header.indexOf('nama');
  const idxSekolah = header.indexOf('sekolah');
  const idxStatus = header.indexOf('status');

  const values = sheetGuru.getRange(2, 1, sheetGuru.getLastRow() - 1, lastCol).getValues();
  for (let i = 0; i < values.length; i++) {
    const u = (values[i][idxUser] || '').toString().trim().toLowerCase();
    const p = (values[i][idxPass] || '').toString();
    if (u === username && p === password) {

      const status = idxStatus >= 0 ? (values[i][idxStatus] || '').toString().trim().toLowerCase() : 'tunggu';

      if (status === 'tunggu') {
        return { ok: false, error: 'Akun Anda masih menunggu persetujuan Admin (Kiki Husni Kamil, S.Pd.). Silakan hubungi via WhatsApp.' };
      }
      if (status !== 'disetujui') {
        return { ok: false, error: 'Akun Anda belum disetujui atau dinonaktifkan.' };
      }

      return {
        ok: true,
        guru: {
          username: u,
          nama: (values[i][idxNama] || '').toString().trim(),
          sekolah: idxSekolah >= 0 ? normalisasiSekolah(values[i][idxSekolah]) : ''
        }
      };
    }
  }
  return { ok: false, error: 'Username atau password guru salah' };
}

/**
 * handleLoginGuru
 */
function handleLoginGuru(data) {
  try {
    const username = (data.username || '').toString().trim().toLowerCase();
    const password = (data.password || '').toString();

    if (!username) return corsResponse({ ok: false, error: 'Username guru wajib diisi' });
    if (!password) return corsResponse({ ok: false, error: 'Password guru wajib diisi' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const verif = verifikasiGuru(ss, username, password);
    if (!verif.ok) return corsResponse({ ok: false, error: verif.error });

    return corsResponse({
      ok: true, tipe: 'guru',
      user_id: verif.guru.username,
      nama: verif.guru.nama,
      sekolah: verif.guru.sekolah,
      message: 'Login guru berhasil'
    });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal login guru: ' + err.message });
  }
}

/**
 * handleGetAllProgress
 */
function handleGetAllProgress(data) {
  try {
    const username = (data.username || '').toString().trim().toLowerCase();
    const password = (data.password || '').toString();

    if (!username) return corsResponse({ ok: false, error: 'Username guru wajib diisi' });
    if (!password) return corsResponse({ ok: false, error: 'Password guru wajib diisi' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const verif = verifikasiGuru(ss, username, password);
    if (!verif.ok) return corsResponse({ ok: false, error: verif.error });

    const sekolahGuru = verif.guru.sekolah;

    if (!sekolahGuru) {
      return corsResponse({
        ok: true,
        guru: verif.guru,
        progress: [],
        total: 0,
        message: 'Akun guru belum memiliki data sekolah.'
      });
    }

    const sheetProgress = ss.getSheetByName(NAMA_SHEET_PROGRESS);
    if (!sheetProgress || sheetProgress.getLastRow() < 2) {
      return corsResponse({
        ok: true, guru: verif.guru, progress: [], total: 0,
        message: 'Belum ada progress siswa'
      });
    }

    pastikanHeaderProgress(sheetProgress);

    const values = sheetProgress
      .getRange(2, 1, sheetProgress.getLastRow() - 1, HEADER_PROGRESS.length)
      .getValues();

    // Mapping user_id ? nama
    const mapNama = {};

    const sheetUsers = ss.getSheetByName(NAMA_SHEET_USERS);
    if (sheetUsers && sheetUsers.getLastRow() >= 2) {
      const usersValues = sheetUsers
        .getRange(2, 1, sheetUsers.getLastRow() - 1, 5)
        .getValues();
      usersValues.forEach(function(r) {
        const uname = (r[0] || '').toString().trim().toLowerCase();
        if (!uname) return;
        mapNama[uname] = {
          nama: normalisasiNama(r[2]),
          kelas: normalisasiKelas(r[3]),
          sekolah: normalisasiSekolah(r[4]),
          tipe: 'login'
        };
      });
    }

    const sheetTamu = ss.getSheetByName(NAMA_SHEET_TAMU);
    if (sheetTamu && sheetTamu.getLastRow() >= 2) {
      const tamuValues = sheetTamu
        .getRange(2, 1, sheetTamu.getLastRow() - 1, 4)
        .getValues();
      tamuValues.forEach(function(r) {
        const kode = (r[0] || '').toString().trim();
        if (!kode) return;
        mapNama[kode.toLowerCase()] = {
          nama: normalisasiNama(r[2]),
          kelas: normalisasiKelas(r[3]),
          sekolah: normalisasiSekolah(r[1]),
          tipe: 'tamu'
        };
      });
    }

    const hasil = [];
    values.forEach(function(row) {
      const userId = (row[0] || '').toString().trim();
      if (!userId) return;

      const info = mapNama[userId.toLowerCase()] || null;

      if (!info) return;
      if (info.sekolah !== sekolahGuru) return;

      hasil.push({
        user_id: userId,
        nama: info.nama,
        kelas: info.kelas,
        sekolah: info.sekolah,
        tipe: info.tipe,
        modul: (row[1] || '').toString(),
        bagian_terakhir: (row[2] || '').toString(),
        skor_a: Number(row[3]) || 0,
        skor_b: Number(row[4]) || 0,
        skor_c: Number(row[5]) || 0,
        skor_d: Number(row[6]) || 0,
        skor_e: Number(row[7]) || 0,
        skor_f: Number(row[8]) || 0,
        skor_kuis: Number(row[9]) || 0,
        nilai_akhir: Number(row[10]) || 0,
        nama_siswa: normalisasiNama(row[11]),
        status_modul: (row[12] || '').toString().trim(),
        waktu_update: (row[13] || '').toString()
      });
    });

    hasil.sort(function(a, b) {
      return (b.waktu_update || '').localeCompare(a.waktu_update || '');
    });

    return corsResponse({
      ok: true,
      guru: verif.guru,
      progress: hasil,
      total: hasil.length
    });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal ambil data: ' + err.message });
  }
}

/**
 * handleUnlockModul
 */
function handleUnlockModul(data) {
  try {
    const username = (data.username || '').toString().trim().toLowerCase();
    const password = (data.password || '').toString();
    const targetUserId = (data.userId || '').toString().trim();
    const modul = (data.modul || '').toString().trim();

    if (!username) return corsResponse({ ok: false, error: 'Username guru wajib diisi' });
    if (!password) return corsResponse({ ok: false, error: 'Password guru wajib diisi' });
    if (!targetUserId) return corsResponse({ ok: false, error: 'userId target wajib diisi' });
    if (!modul) return corsResponse({ ok: false, error: 'modul wajib diisi' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const verif = verifikasiGuru(ss, username, password);
    if (!verif.ok) return corsResponse({ ok: false, error: verif.error });

    const cekTarget = cariSiswaDiSekolah(ss, targetUserId, verif.guru.sekolah);
    if (!cekTarget.ok) return corsResponse({ ok: false, error: cekTarget.error });

    const sheetProgress = ss.getSheetByName(NAMA_SHEET_PROGRESS);
    if (!sheetProgress || sheetProgress.getLastRow() < 2) {
      return corsResponse({ ok: false, error: 'Belum ada progress' });
    }

    pastikanHeaderProgress(sheetProgress);

    const lastRow = sheetProgress.getLastRow();
    const values = sheetProgress.getRange(2, 1, lastRow - 1, HEADER_PROGRESS.length).getValues();
    let targetRow = -1;
    for (let i = 0; i < values.length; i++) {
      const u = (values[i][0] || '').toString().trim();
      const m = (values[i][1] || '').toString().trim();
      if (u === targetUserId && m === modul) {
        targetRow = i + 2;
        break;
      }
    }

    if (targetRow === -1) {
      return corsResponse({ ok: false, error: 'Data progress tidak ditemukan untuk user/modul ini' });
    }

    const statusColIdx = HEADER_PROGRESS.indexOf('status_modul') + 1;
    if (statusColIdx > 0) {
      sheetProgress.getRange(targetRow, statusColIdx).setValue('');
    }

    return corsResponse({
      ok: true,
      message: 'Modul dibuka. Siswa bisa mengulang dan nilai akan diperbarui.',
      userId: targetUserId,
      modul: modul
    });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal unlock: ' + err.message });
  }
}

/**
 * Helper: cari user (login/tamu) dan pastikan sekolahnya = sekolahGuru.
 */
function cariSiswaDiSekolah(ss, userId, sekolahGuru) {
  const uid = String(userId || '').trim().toLowerCase();

  const sheetUsers = ss.getSheetByName(NAMA_SHEET_USERS);
  if (sheetUsers && sheetUsers.getLastRow() >= 2) {
    const values = sheetUsers.getRange(2, 1, sheetUsers.getLastRow() - 1, 6).getValues();
    for (let i = 0; i < values.length; i++) {
      const u = (values[i][0] || '').toString().trim().toLowerCase();
      if (u === uid) {
        const sekolah = normalisasiSekolah(values[i][4]);
        if (sekolah !== sekolahGuru) {
          return { ok: false, error: 'Siswa ini bukan dari sekolah Anda' };
        }
        return {
          ok: true,
          tipe: 'login',
          data: {
            user_id: u,
            nama: normalisasiNama(values[i][2]),
            kelas: normalisasiKelas(values[i][3]),
            sekolah: sekolah,
            password: (values[i][1] || '').toString(),
            rowIndex: i + 2
          }
        };
      }
    }
  }

  const sheetTamu = ss.getSheetByName(NAMA_SHEET_TAMU);
  if (sheetTamu && sheetTamu.getLastRow() >= 2) {
    const values = sheetTamu.getRange(2, 1, sheetTamu.getLastRow() - 1, 6).getValues();
    for (let i = 0; i < values.length; i++) {
      const k = (values[i][0] || '').toString().trim().toLowerCase();
      if (k === uid) {
        const sekolah = normalisasiSekolah(values[i][1]);
        if (sekolah !== sekolahGuru) {
          return { ok: false, error: 'Siswa ini bukan dari sekolah Anda' };
        }
        return {
          ok: true,
          tipe: 'tamu',
          data: {
            user_id: k,
            nama: normalisasiNama(values[i][2]),
            kelas: normalisasiKelas(values[i][3]),
            sekolah: sekolah,
            rowIndex: i + 2
          }
        };
      }
    }
  }

  return { ok: false, error: 'Siswa tidak ditemukan' };
}

/**
 * handleUpdateSiswa
 */
function handleUpdateSiswa(data) {
  try {
    const username = (data.username || '').toString().trim().toLowerCase();
    const password = (data.password || '').toString();
    const targetUserId = (data.userId || '').toString().trim();

    if (!username) return corsResponse({ ok: false, error: 'Username guru wajib diisi' });
    if (!password) return corsResponse({ ok: false, error: 'Password guru wajib diisi' });
    if (!targetUserId) return corsResponse({ ok: false, error: 'userId target wajib diisi' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const verif = verifikasiGuru(ss, username, password);
    if (!verif.ok) return corsResponse({ ok: false, error: verif.error });

    const cari = cariSiswaDiSekolah(ss, targetUserId, verif.guru.sekolah);
    if (!cari.ok) return corsResponse({ ok: false, error: cari.error });

    if (cari.tipe === 'tamu') {
      return corsResponse({ ok: false, error: 'Tamu tidak bisa diedit' });
    }

    const namaBaru    = data.nama    !== undefined ? normalisasiNama(data.nama)       : cari.data.nama;
    const kelasBaru   = data.kelas   !== undefined ? normalisasiKelas(data.kelas)     : cari.data.kelas;
    const sekolahBaru = data.sekolah !== undefined ? normalisasiSekolah(data.sekolah) : cari.data.sekolah;
    const passBaru    = data.passwordSiswa !== undefined ? data.passwordSiswa : cari.data.password;

    if (!namaBaru)    return corsResponse({ ok: false, error: 'Nama tidak boleh kosong' });
    if (!kelasBaru)   return corsResponse({ ok: false, error: 'Kelas tidak boleh kosong' });
    if (!sekolahBaru) return corsResponse({ ok: false, error: 'Sekolah tidak boleh kosong' });

    const errP = validasiPassword(passBaru, targetUserId.toLowerCase());
    if (errP) return corsResponse({ ok: false, error: errP });

    const sheetUsers = ss.getSheetByName(NAMA_SHEET_USERS);
    if (!sheetUsers) return corsResponse({ ok: false, error: 'Sheet Users tidak ditemukan' });

    const lastCol = sheetUsers.getLastColumn();
    const header = sheetUsers.getRange(1, 1, 1, lastCol).getValues()[0];
    const idxPass = header.indexOf('password') + 1;
    const idxNama = header.indexOf('nama') + 1;
    const idxKelas = header.indexOf('kelas') + 1;
    const idxSekolah = header.indexOf('sekolah') + 1;

    if (idxNama > 0) sheetUsers.getRange(cari.data.rowIndex, idxNama).setValue(namaBaru);
    if (idxKelas > 0) sheetUsers.getRange(cari.data.rowIndex, idxKelas).setValue(kelasBaru);
    if (idxSekolah > 0) sheetUsers.getRange(cari.data.rowIndex, idxSekolah).setValue(sekolahBaru);
    if (idxPass > 0) sheetUsers.getRange(cari.data.rowIndex, idxPass).setValue(passBaru);

    const sheetProgress = ss.getSheetByName(NAMA_SHEET_PROGRESS);
    if (sheetProgress && sheetProgress.getLastRow() >= 2) {
      const lastRowP = sheetProgress.getLastRow();
      const valuesP = sheetProgress.getRange(2, 1, lastRowP - 1, HEADER_PROGRESS.length).getValues();
      const idxNamaSiswaP = HEADER_PROGRESS.indexOf('nama_siswa') + 1;
      for (let i = 0; i < valuesP.length; i++) {
        const u = (valuesP[i][0] || '').toString().trim().toLowerCase();
        if (u === targetUserId.toLowerCase()) {
          if (idxNamaSiswaP > 0) {
            sheetProgress.getRange(i + 2, idxNamaSiswaP).setValue(namaBaru);
          }
        }
      }
    }

    return corsResponse({
      ok: true,
      message: 'Identitas siswa diperbarui',
      user_id: targetUserId,
      nama: namaBaru,
      kelas: kelasBaru,
      sekolah: sekolahBaru
    });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal update siswa: ' + err.message });
  }
}

/**
 * handleListKelasGuru
 */
function handleListKelasGuru(data) {
  try {
    const username = (data.username || '').toString().trim().toLowerCase();
    const password = (data.password || '').toString();

    if (!username) return corsResponse({ ok: false, error: 'Username guru wajib diisi' });
    if (!password) return corsResponse({ ok: false, error: 'Password guru wajib diisi' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const verif = verifikasiGuru(ss, username, password);
    if (!verif.ok) return corsResponse({ ok: false, error: verif.error });

    const sekolahGuru = verif.guru.sekolah;
    if (!sekolahGuru) {
      return corsResponse({
        ok: true,
        kelas: [],
        message: 'Akun guru belum memiliki data sekolah.'
      });
    }

    const sheetUsers = ss.getSheetByName(NAMA_SHEET_USERS);
    if (!sheetUsers || sheetUsers.getLastRow() < 2) {
      return corsResponse({ ok: true, kelas: [] });
    }

    const values = sheetUsers.getRange(2, 1, sheetUsers.getLastRow() - 1, 5).getValues();
    const setKelas = {};

    values.forEach(function(r) {
      const kelas = normalisasiKelas(r[3]);
      const sekolah = normalisasiSekolah(r[4]);
      if (!kelas) return;
      if (sekolah !== sekolahGuru) return;
      setKelas[kelas] = true;
    });

    const kelasArr = Object.keys(setKelas).sort(function(a, b) {
      const mA = a.match(/^(\d+)([A-Z]*)$/);
      const mB = b.match(/^(\d+)([A-Z]*)$/);
      if (mA && mB) {
        if (Number(mA[1]) !== Number(mB[1])) return Number(mA[1]) - Number(mB[1]);
        return (mA[2] || '').localeCompare(mB[2] || '');
      }
      return a.localeCompare(b);
    });

    return corsResponse({ ok: true, kelas: kelasArr });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal ambil daftar kelas: ' + err.message });
  }
}

/**
 * handleListSiswaGuru
 */
function handleListSiswaGuru(data) {
  try {
    const username = (data.username || '').toString().trim().toLowerCase();
    const password = (data.password || '').toString();
    const filterKelas = normalisasiKelas(data.kelas || '');

    if (!username) return corsResponse({ ok: false, error: 'Username guru wajib diisi' });
    if (!password) return corsResponse({ ok: false, error: 'Password guru wajib diisi' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const verif = verifikasiGuru(ss, username, password);
    if (!verif.ok) return corsResponse({ ok: false, error: verif.error });

    const sekolahGuru = verif.guru.sekolah;
    if (!sekolahGuru) {
      return corsResponse({
        ok: true,
        siswa: [],
        total: 0,
        message: 'Akun guru belum memiliki data sekolah.'
      });
    }

    const sheetUsers = ss.getSheetByName(NAMA_SHEET_USERS);
    if (!sheetUsers || sheetUsers.getLastRow() < 2) {
      return corsResponse({ ok: true, siswa: [], total: 0 });
    }

    const values = sheetUsers.getRange(2, 1, sheetUsers.getLastRow() - 1, 5).getValues();
    const hasil = [];

    values.forEach(function(r) {
      const uname = (r[0] || '').toString().trim().toLowerCase();
      if (!uname) return;

      const nama = normalisasiNama(r[2]);
      const kelas = normalisasiKelas(r[3]);
      const sekolah = normalisasiSekolah(r[4]);

      if (sekolah !== sekolahGuru) return;
      if (filterKelas && kelas !== filterKelas) return;

      hasil.push({
        username: uname,
        nama: nama || '(tanpa nama)',
        kelas: kelas || '�',
        sekolah: sekolah
      });
    });

    hasil.sort(function(a, b) {
      const kA = a.kelas.match(/^(\d+)([A-Z]*)$/);
      const kB = b.kelas.match(/^(\d+)([A-Z]*)$/);
      if (kA && kB) {
        if (Number(kA[1]) !== Number(kB[1])) return Number(kA[1]) - Number(kB[1]);
        const cmpKelas = (kA[2] || '').localeCompare(kB[2] || '');
        if (cmpKelas !== 0) return cmpKelas;
      } else if (kA) {
        return -1;
      } else if (kB) {
        return 1;
      }
      return a.nama.localeCompare(b.nama);
    });

    return corsResponse({ ok: true, siswa: hasil, total: hasil.length });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal ambil daftar siswa: ' + err.message });
  }
}

/**
 * handleGetPasswordSiswa
 */
function handleGetPasswordSiswa(data) {
  try {
    const username = (data.username || '').toString().trim().toLowerCase();
    const password = (data.password || '').toString();
    const targetUserId = (data.userId || '').toString().trim().toLowerCase();

    if (!username) return corsResponse({ ok: false, error: 'Username guru wajib diisi' });
    if (!password) return corsResponse({ ok: false, error: 'Password guru wajib diisi' });
    if (!targetUserId) return corsResponse({ ok: false, error: 'userId siswa wajib diisi' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const verif = verifikasiGuru(ss, username, password);
    if (!verif.ok) return corsResponse({ ok: false, error: verif.error });

    const cari = cariSiswaDiSekolah(ss, targetUserId, verif.guru.sekolah);
    if (!cari.ok) return corsResponse({ ok: false, error: cari.error });

    if (cari.tipe === 'tamu') {
      return corsResponse({ ok: false, error: 'Tamu tidak memiliki password.' });
    }

    return corsResponse({
      ok: true,
      username: cari.data.user_id,
      password: cari.data.password || ''
    });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal ambil password: ' + err.message });
  }
}

/**
 * handleGetProgressSiswaDetail
 */
function handleGetProgressSiswaDetail(data) {
  try {
    const userId = (data.userId || '').toString().trim().toLowerCase();
    if (!userId) return corsResponse({ ok: false, error: 'userId wajib diisi' });

    const temanRaw = Array.isArray(data.temanUserIds) ? data.temanUserIds : [];
    const seen = {};
    const temanIdsBersih = [];
    for (let i = 0; i < temanRaw.length; i++) {
      const u = String(temanRaw[i] || '').trim().toLowerCase();
      if (!u) continue;
      if (u === userId) continue;
      if (seen[u]) continue;
      seen[u] = true;
      temanIdsBersih.push(u);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const sheetUsers = ss.getSheetByName(NAMA_SHEET_USERS);
    let siswaInfo = null;
    const mapUsers = {};

    if (sheetUsers && sheetUsers.getLastRow() >= 2) {
      const values = sheetUsers.getRange(2, 1, sheetUsers.getLastRow() - 1, 5).getValues();
      values.forEach(function(r) {
        const u = (r[0] || '').toString().trim().toLowerCase();
        if (!u) return;
        mapUsers[u] = {
          nama: normalisasiNama(r[2]) || u,
          kelas: normalisasiKelas(r[3]),
          sekolah: normalisasiSekolah(r[4])
        };
        if (u === userId) siswaInfo = { username: u, nama: mapUsers[u].nama, kelas: mapUsers[u].kelas, sekolah: mapUsers[u].sekolah };
      });
    }

    if (!siswaInfo) {
      siswaInfo = { username: userId, nama: userId, kelas: '', sekolah: '' };
    }

    const temanValid = [];
    const sekolahUtama = siswaInfo.sekolah;
    temanIdsBersih.forEach(function(uid) {
      const info = mapUsers[uid];
      if (!info) return;
      if (sekolahUtama && info.sekolah && info.sekolah !== sekolahUtama) return;
      temanValid.push({ username: uid, nama: info.nama, kelas: info.kelas, sekolah: info.sekolah });
    });

    const sheetProgress = ss.getSheetByName(NAMA_SHEET_PROGRESS);
    const progressAll = [];

    const allIds = [userId].concat(temanValid.map(function(t) { return t.username; }));
    const idSet = {};
    allIds.forEach(function(u) { idSet[u] = true; });

    if (sheetProgress && sheetProgress.getLastRow() >= 2) {
      pastikanHeaderProgress(sheetProgress);
      const values = sheetProgress.getRange(2, 1, sheetProgress.getLastRow() - 1, HEADER_PROGRESS.length).getValues();

      values.forEach(function(row) {
        const rowUser = (row[0] || '').toString().trim().toLowerCase();
        if (!idSet[rowUser]) return;

        const info = mapUsers[rowUser];
        const namaTampil = info ? info.nama : rowUser;

        progressAll.push({
          user_id: rowUser,
          modul: (row[1] || '').toString(),
          bagian_terakhir: (row[2] || '').toString(),
          skor_a: Number(row[3]) || 0,
          skor_b: Number(row[4]) || 0,
          skor_c: Number(row[5]) || 0,
          skor_d: Number(row[6]) || 0,
          skor_e: Number(row[7]) || 0,
          skor_f: Number(row[8]) || 0,
          skor_kuis: Number(row[9]) || 0,
          nilai_akhir: Number(row[10]) || 0,
          status_modul: (row[12] || '').toString().trim(),
          waktu_update: (row[13] || '').toString(),
          nama_tampil: namaTampil,
          is_utama: rowUser === userId
        });
      });
    }

    progressAll.sort(function(a, b) {
      if (a.is_utama !== b.is_utama) return a.is_utama ? -1 : 1;
      if (a.user_id !== b.user_id) return a.user_id.localeCompare(b.user_id);
      return a.modul.localeCompare(b.modul);
    });

    return corsResponse({
      ok: true,
      siswa: siswaInfo,
      teman: temanValid,
      progress: progressAll,
      total: progressAll.length
    });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal ambil progress detail: ' + err.message });
  }
}

/**
 * handleHapusTamuBulk
 */
function handleHapusTamuBulk(data) {
  try {
    const username = (data.username || '').toString().trim().toLowerCase();
    const password = (data.password || '').toString();
    const userIds = Array.isArray(data.userIds) ? data.userIds : [];

    if (!username) return corsResponse({ ok: false, error: 'Username guru wajib diisi' });
    if (!password) return corsResponse({ ok: false, error: 'Password guru wajib diisi' });
    if (userIds.length === 0) return corsResponse({ ok: false, error: 'Tidak ada userId yang dikirim' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const verif = verifikasiGuru(ss, username, password);
    if (!verif.ok) return corsResponse({ ok: false, error: verif.error });

    const targetSet = {};
    userIds.forEach(function(u) {
      const uid = String(u || '').trim().toLowerCase();
      if (uid) targetSet[uid] = true;
    });

    let dihapus = 0;
    let dilewati = 0;

    const sheetProgress = ss.getSheetByName(NAMA_SHEET_PROGRESS);
    if (sheetProgress && sheetProgress.getLastRow() >= 2) {
      const lastRow = sheetProgress.getLastRow();
      const values = sheetProgress.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = values.length - 1; i >= 0; i--) {
        const uid = (values[i][0] || '').toString().trim().toLowerCase();
        if (targetSet[uid]) {
          sheetProgress.deleteRow(i + 2);
        }
      }
    }

    const sheetTamu = ss.getSheetByName(NAMA_SHEET_TAMU);
    if (sheetTamu && sheetTamu.getLastRow() >= 2) {
      const lastRow = sheetTamu.getLastRow();
      const values = sheetTamu.getRange(2, 1, lastRow - 1, 6).getValues();

      for (let i = values.length - 1; i >= 0; i--) {
        const kode = (values[i][0] || '').toString().trim();
        const kodeLower = kode.toLowerCase();

        if (!targetSet[kodeLower]) continue;

        const sekolah = normalisasiSekolah(values[i][1]);
        if (sekolah !== verif.guru.sekolah) {
          dilewati++;
          continue;
        }

        if (kodeUpper(kode).indexOf('TAMU-') !== 0) {
          dilewati++;
          continue;
        }

        sheetTamu.deleteRow(i + 2);
        dihapus++;
      }
    }

    return corsResponse({
      ok: true,
      message: dihapus + ' data tamu dihapus' + (dilewati > 0 ? ', ' + dilewati + ' dilewati (bukan tamu sekolah Anda)' : ''),
      dihapus: dihapus,
      dilewati: dilewati
    });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal hapus tamu: ' + err.message });
  }
}

function kodeUpper(s) { return String(s || '').toUpperCase(); }

/**
 * handleGetBackupData
 */
function handleGetBackupData(data) {
  try {
    const username = (data.username || '').toString().trim().toLowerCase();
    const password = (data.password || '').toString();

    if (!username) return corsResponse({ ok: false, error: 'Username guru wajib diisi' });
    if (!password) return corsResponse({ ok: false, error: 'Password guru wajib diisi' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const verif = verifikasiGuru(ss, username, password);
    if (!verif.ok) return corsResponse({ ok: false, error: verif.error });

    function bacaSheet(nama, headerLen) {
      const sheet = ss.getSheetByName(nama);
      if (!sheet || sheet.getLastRow() < 2) return [];
      return sheet.getRange(2, 1, sheet.getLastRow() - 1, headerLen).getValues();
    }

    const backup = {
      users:    bacaSheet(NAMA_SHEET_USERS, 6),
      tamu:     bacaSheet(NAMA_SHEET_TAMU, 6),
      progress: bacaSheet(NAMA_SHEET_PROGRESS, HEADER_PROGRESS.length),
      guru:     bacaSheet(NAMA_SHEET_GURU, 4),
      waktu:    formatWaktu(new Date())
    };

    return corsResponse({ ok: true, backup: backup });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal backup: ' + err.message });
  }
}

/**
 * handleRestoreBackup
 */
function handleRestoreBackup(data) {
  try {
    const username = (data.username || '').toString().trim().toLowerCase();
    const password = (data.password || '').toString();
    const backup = data.backup || {};

    if (!username) return corsResponse({ ok: false, error: 'Username guru wajib diisi' });
    if (!password) return corsResponse({ ok: false, error: 'Password guru wajib diisi' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const verif = verifikasiGuru(ss, username, password);
    if (!verif.ok) return corsResponse({ ok: false, error: verif.error });

    if (Array.isArray(backup.users)) {
      restoreSheet(ss, NAMA_SHEET_USERS, HEADER_USERS, backup.users);
    }
    if (Array.isArray(backup.tamu)) {
      restoreSheet(ss, NAMA_SHEET_TAMU, HEADER_TAMU, backup.tamu);
    }
    if (Array.isArray(backup.progress)) {
      restoreSheet(ss, NAMA_SHEET_PROGRESS, HEADER_PROGRESS, backup.progress);
    }
    if (Array.isArray(backup.guru)) {
      restoreSheet(ss, NAMA_SHEET_GURU, HEADER_GURU, backup.guru);
    }

    return corsResponse({
      ok: true,
      message: 'Restore berhasil. Semua sheet telah ditimpa.'
    });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal restore: ' + err.message });
  }
}

function restoreSheet(ss, namaSheet, header, rows) {
  let sheet = ss.getSheetByName(namaSheet);
  if (!sheet) {
    sheet = ss.insertSheet(namaSheet);
  }
  sheet.clearContents();
  sheet.getRange(1, 1, 1, header.length).setValues([header])
    .setFontWeight('bold').setBackground('#e8dcd0');
  if (rows.length > 0) {
    const normalized = rows.map(function(r) {
      const row = new Array(header.length).fill('');
      for (let i = 0; i < Math.min(r.length, header.length); i++) {
        row[i] = r[i];
      }
      return row;
    });
    sheet.getRange(2, 1, normalized.length, header.length).setValues(normalized);
  }
  sheet.setFrozenRows(1);
}

// ================================================================
// ============ FEEDBACK AI (GEMINI) ==============================
// ================================================================

const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';

function ambilGeminiApiKey() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY belum diset di Script Properties.');
  return key;
}

function bangunPromptFeedbackAI(data) {
  const bagian = (data.bagian || '').toString().trim();
  const modul  = (data.modul  || '').toString().trim();
  const level  = (data.level  || '').toString().trim();

  const skorTes   = Number(data.skorTes)   || 0;
  const totalTes  = Number(data.totalTes)  || 0;
  const benarTes  = Number(data.benarTes)  || 0;

  const ringkasHasil = (data.ringkasHasil || '').toString().trim();
  const mindful = data.mindful || {};
  const refleksi = data.refleksi || {};
  const exitTicket = (data.exitTicket || '').toString().trim();

  function potong(s, n) {
    s = String(s || '').trim();
    if (s.length <= n) return s;
    return s.substring(0, n) + '�';
  }

  const j1 = potong(mindful.j1, 400);
  const j2 = potong(mindful.j2, 400);
  const j3 = potong(mindful.j3, 400);
  const jPilih = potong(mindful.pilih, 200);
  const refPel = potong(refleksi.pelajaran, 500);
  const refPen = potong(refleksi.penerapan, 500);
  const exitT = potong(exitTicket, 300);

  const bagianLabel = bagian ? bagian.toUpperCase() : '(akhir)';
  const levelLabel = level ? level.toUpperCase() : '(tidak dipilih)';

  const prompt =
    'Kamu adalah guru Informatika SMP di Indonesia. ' +
    'Beri umpan balik singkat untuk siswa berdasarkan data belajar berikut.\n\n' +
    'ATURAN OUTPUT (WAJIB):\n' +
    '- Bahasa Indonesia, hangat, tidak menghakimi, cocok untuk siswa SMP.\n' +
    '- Panjang 3�4 kalimat. Maksimal ~90 kata.\n' +
    '- Struktur: (1) apresiasi singkat, (2) 1 hal yang sudah bagus, (3) 1 saran konkret & spesifik.\n' +
    '- JANGAN membocorkan jawaban kuis/tes.\n' +
    '- JANGAN memakai markdown, bullet, atau emoji berlebihan (maks 1 emoji).\n' +
    '- Langsung tulis feedback, tanpa pembuka seperti "Berikut feedback...".\n\n' +
    'DATA SISWA:\n' +
    '- Modul: ' + modul + '\n' +
    '- Bagian: ' + bagianLabel + '\n' +
    '- Tingkat tantangan yang dipilih: ' + levelLabel + '\n' +
    '- Hasil Tes Pemahaman: ' + benarTes + '/' + totalTes + ' benar (skor ' + skorTes + ')\n' +
    (ringkasHasil ? '- Ringkasan hasil simulasi: ' + potong(ringkasHasil, 400) + '\n' : '') +
    (jPilih ? '- Alasan memilih level: ' + jPilih + '\n' : '') +
    (j1 ? '- Jeda Sadar 1: ' + j1 + '\n' : '') +
    (j2 ? '- Jeda Sadar 2: ' + j2 + '\n' : '') +
    (j3 ? '- Jeda Sadar 3: ' + j3 + '\n' : '') +
    (refPel ? '- Refleksi PELAJARAN: ' + refPel + '\n' : '') +
    (refPen ? '- Refleksi PENERAPAN: ' + refPen + '\n' : '') +
    (exitT ? '- Exit Ticket: ' + exitT + '\n' : '') +
    '\nTulis feedbacknya sekarang:';

  return prompt;
}

function panggilGemini(prompt) {
  const apiKey = ambilGeminiApiKey();
  const url = GEMINI_ENDPOINT + GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(apiKey);

  const payload = {
    contents: [
      { role: 'user', parts: [ { text: prompt } ] }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 300,
      topP: 0.9
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
    ]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const res = UrlFetchApp.fetch(url, options);
  const code = res.getResponseCode();
  const body = res.getContentText();

  if (code !== 200) {
    throw new Error('Gemini API error (' + code + '): ' + body.substring(0, 300));
  }

  let json;
  try { json = JSON.parse(body); } catch (e) {
    throw new Error('Respons Gemini tidak valid: ' + body.substring(0, 200));
  }

  if (json.promptFeedback && json.promptFeedback.blockReason) {
    throw new Error('Konten diblokir: ' + json.promptFeedback.blockReason);
  }

  const candidates = json.candidates || [];
  if (candidates.length === 0) throw new Error('Gemini tidak mengembalikan jawaban.');

  const parts = (candidates[0].content && candidates[0].content.parts) || [];
  let teks = '';
  parts.forEach(function(p) { if (p && p.text) teks += p.text; });

  teks = teks.trim();
  if (!teks) throw new Error('Feedback kosong dari Gemini.');

  if (teks.length > 700) teks = teks.substring(0, 700).trim() + '�';

  return teks;
}

function handleGetFeedbackAI(data) {
  try {
    const userId = (data.userId || '').toString().trim();
    const modul  = (data.modul  || '').toString().trim();
    const bagian = (data.bagian || '').toString().trim();

    if (!modul)  return corsResponse({ ok: false, error: 'modul wajib diisi' });
    if (!bagian) return corsResponse({ ok: false, error: 'bagian wajib diisi' });

    const refPel = ((data.refleksi || {}).pelajaran || '').toString().trim();
    const refPen = ((data.refleksi || {}).penerapan || '').toString().trim();
    const exitT  = (data.exitTicket || '').toString().trim();

    if (!refPel && !refPen && !exitT) {
      return corsResponse({
        ok: false,
        error: 'Isi dulu Refleksi (PELAJARAN / PENERAPAN) atau Exit Ticket sebelum minta feedback.'
      });
    }

    const prompt = bangunPromptFeedbackAI(data);
    const feedback = panggilGemini(prompt);

    return corsResponse({
      ok: true,
      feedback: feedback,
      modul: modul,
      bagian: bagian,
      userId: userId,
      model: GEMINI_MODEL,
      waktu: formatWaktu(new Date())
    });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal minta feedback: ' + err.message });
  }
}

// ================================================================
// ============ UTIL: RECOMPUTE NILAI AKHIR (SEKALI JALAN) ========
// ================================================================
/**
 * recomputeNilaiAkhirSemua()
 * Jalankan MANUAL dari editor Apps Script (bukan lewat doPost).
 * Untuk memperbaiki data lama yang nilai_akhir-nya salah karena bug
 * pembagian 6 kolom.
 *
 * Peta modul ? bagian aktivitas yang valid (TANPA kuis akhir).
 * Sesuaikan dengan modul yang ada di proyek Anda.
 */
// ================================================================
// ============ UJIAN BARU: SIMPAN JAWABAN ==========================
// ================================================================

function pastikanSheetDaftarUjian() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(NAMA_SHEET_DAFTAR_UJIAN);
    if (!sheet) sheet = ss.insertSheet(NAMA_SHEET_DAFTAR_UJIAN);

    const lastColumn = sheet.getLastColumn();
    let header = lastColumn
      ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(value) {
          return String(value || '').trim().toLowerCase();
        })
      : [];
    if (!header.some(function(value) { return Boolean(value); })) {
      header = HEADER_DAFTAR_UJIAN.slice();
      sheet.getRange(1, 1, 1, header.length).setValues([header]);
      sheet.getRange(1, 1, 1, header.length)
        .setFontWeight('bold')
        .setBackground('#e8dcd0');
      sheet.setFrozenRows(1);
    } else {
      HEADER_DAFTAR_UJIAN.forEach(function(column) {
        if (header.indexOf(column) === -1) {
          header.push(column);
          sheet.getRange(1, header.length).setValue(column);
        }
      });
    }
    return { sheet: sheet, header: header };
  } finally {
    lock.releaseLock();
  }
}

function ambilUjianDariSheet(idUjian) {
  const daftar = pastikanSheetDaftarUjian();
  const idxId = daftar.header.indexOf('id');
  const idxNama = daftar.header.indexOf('nama_ujian');
  const idxFile = daftar.header.indexOf('file_ujian');
  const idxToken = daftar.header.indexOf('token');
  const idxWaktu = daftar.header.indexOf('waktu');
  const idxTampilNilai = daftar.header.indexOf('tampil_nilai');
  const idxTampilPembahasan = daftar.header.indexOf('tampil_pembahasan');
  const lastRow = daftar.sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = daftar.sheet.getRange(2, 1, lastRow - 1, daftar.header.length).getValues();
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const nama = String(row[idxNama] || '').trim();
    const file = String(row[idxFile] || '').trim();
    if (!nama || !file) continue;

    let id = String(row[idxId] || '').trim();
    if (!id) {
      id = Utilities.getUuid();
      daftar.sheet.getRange(i + 2, idxId + 1).setValue(id);
    }
    if (id === idUjian) {
      return {
        id: id,
        nama: nama,
        file: file,
        token: String(row[idxToken] || '').trim(),
        waktu: row[idxWaktu],
        tampilNilai: row[idxTampilNilai],
        tampilPembahasan: row[idxTampilPembahasan]
      };
    }
  }
  return null;
}

function bacaWaktuUjian(value, nilaiDefault, label) {
  if (value === null || typeof value === 'undefined' || String(value).trim() === '') return nilaiDefault;
  const waktu = Number(value);
  if (!Number.isInteger(waktu) || waktu < 0) {
    throw new Error('Kolom ' + label + ' harus berupa bilangan bulat menit >= 0.');
  }
  return waktu;
}

function bacaFlagUjian(value, nilaiDefault, label) {
  if (value === null || typeof value === 'undefined' || String(value).trim() === '') return nilaiDefault;
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const nilai = String(value).trim().toLowerCase();
  if (['1', 'true', 'ya', 'yes'].indexOf(nilai) !== -1) return true;
  if (['0', 'false', 'tidak', 'no'].indexOf(nilai) !== -1) return false;
  throw new Error('Kolom ' + label + ' hanya menerima 1 atau 0.');
}

function cariFileUjianDrive(namaFile) {
  if (!/^[^\\/:*?"<>|]+\.xml$/i.test(namaFile)) {
    throw new Error('Nama file_ujian harus berupa nama file XML yang valid.');
  }
  const folder = DriveApp.getFolderById(FOLDER_UJIAN_DRIVE_ID);
  const files = folder.getFilesByName(namaFile);
  if (!files.hasNext()) throw new Error('File "' + namaFile + '" tidak ditemukan di folder Drive ujian.');
  const file = files.next();
  if (files.hasNext()) throw new Error('Ada lebih dari satu file bernama "' + namaFile + '" di folder Drive ujian.');
  return file;
}

function otorisasiAksesDriveUjian() {
  const folder = DriveApp.getFolderById(FOLDER_UJIAN_DRIVE_ID);
  const namaFolder = folder.getName();
  Logger.log('Akses Drive berhasil. Folder ujian: ' + namaFolder);
  return 'Akses Drive berhasil: ' + namaFolder;
}

function handleListUjian() {
  try {
    const daftar = pastikanSheetDaftarUjian();
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const idxId = daftar.header.indexOf('id');
      const idxNama = daftar.header.indexOf('nama_ujian');
      const idxFile = daftar.header.indexOf('file_ujian');
      const idxToken = daftar.header.indexOf('token');
      const lastRow = daftar.sheet.getLastRow();
      if (lastRow < 2) return corsResponse({ ok: true, ujian: [] });

      const values = daftar.sheet.getRange(2, 1, lastRow - 1, daftar.header.length).getValues();
      const ujian = [];
      values.forEach(function(row, i) {
        const nama = String(row[idxNama] || '').trim();
        const file = String(row[idxFile] || '').trim();
        if (!nama || !file) return;

        let id = String(row[idxId] || '').trim();
        if (!id) {
          id = Utilities.getUuid();
          daftar.sheet.getRange(i + 2, idxId + 1).setValue(id);
        }
        ujian.push({
          id: id,
          nama: nama,
          pakaiToken: Boolean(String(row[idxToken] || '').trim())
        });
      });
      return corsResponse({ ok: true, ujian: ujian });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal memuat DaftarUjian: ' + err.message });
  }
}

function handleVerifyTokenUjian(data) {
  try {
    const id = String(data.id || '').trim();
    const token = String(data.token || '').trim();
    if (!id) return corsResponse({ ok: false, error: 'id ujian wajib diisi' });

    const ujian = ambilUjianDariSheet(id);
    if (!ujian) return corsResponse({ ok: false, error: 'Ujian tidak ditemukan.' });
    if (!ujian.token) return corsResponse({ ok: true, valid: true });
    if (!token || token.length > 80) {
      return corsResponse({ ok: true, valid: false, message: 'Token kosong atau terlalu panjang.' });
    }
    const valid = ujian.token.toLowerCase() === token.toLowerCase();
    return corsResponse({
      ok: true,
      valid: valid,
      message: valid ? 'Token valid' : 'Token salah. Coba lagi.'
    });
  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal memverifikasi token ujian: ' + err.message });
  }
}

function handleGetUjianXML(data) {
  try {
    const id = String(data.id || '').trim();
    const token = String(data.token || '').trim();
    if (!id) return corsResponse({ ok: false, error: 'id ujian wajib diisi' });

    const ujian = ambilUjianDariSheet(id);
    if (!ujian) return corsResponse({ ok: false, error: 'Ujian tidak ditemukan atau belum memiliki file XML.' });
    if (ujian.token && ujian.token.toLowerCase() !== token.toLowerCase()) {
      return corsResponse({ ok: false, error: 'Token ujian tidak valid.' });
    }

    const file = cariFileUjianDrive(ujian.file);
    if (file.getSize() > 5 * 1024 * 1024) {
      return corsResponse({ ok: false, error: 'Ukuran file XML ujian melebihi batas 5 MB.' });
    }
    const xml = file.getBlob().getDataAsString('UTF-8');
    if (!xml || !/<ujian(?:\s|>)/i.test(xml)) {
      return corsResponse({ ok: false, error: 'Isi file bukan dokumen XML ujian yang valid.' });
    }
    let dokumenXml;
    try {
      dokumenXml = XmlService.parse(xml);
    } catch (xmlErr) {
      return corsResponse({
        ok: false,
        error: 'XML file "' + ujian.file + '" tidak valid: ' + xmlErr.message
      });
    }
    const rootXml = dokumenXml.getRootElement();
    const konfigurasiXml = rootXml.getChild('konfigurasi');
    const waktuXml = bacaWaktuUjian(
      konfigurasiXml ? konfigurasiXml.getChildText('waktu') : '',
      0,
      'konfigurasi XML waktu'
    );
    const waktu = bacaWaktuUjian(ujian.waktu, waktuXml, 'waktu');
    const tampilNilai = bacaFlagUjian(ujian.tampilNilai, true, 'tampil_nilai');
    const tampilPembahasan = bacaFlagUjian(ujian.tampilPembahasan, true, 'tampil_pembahasan');
    return corsResponse({
      ok: true,
      nama: ujian.nama,
      xml: xml,
      pengaturan: {
        waktu: waktu,
        tampilNilai: tampilNilai,
        tampilPembahasan: tampilPembahasan
      }
    });
  } catch (err) {
    const pesan = String(err.message || err);
    if (pesan.indexOf('permissions are not sufficient') !== -1 ||
        pesan.indexOf('Required permissions') !== -1) {
      return corsResponse({
        ok: false,
        error: 'GAS belum mendapat otorisasi Google Drive. Jalankan fungsi otorisasiAksesDriveUjian dari editor Apps Script dan setujui izin Drive, lalu coba lagi.'
      });
    }
    return corsResponse({ ok: false, error: 'Gagal memuat file ujian: ' + pesan });
  }
}

function handleTambahUjianGuru(data) {
  try {
    const username = String(data.username || '').trim().toLowerCase();
    const password = String(data.password || '');
    const nama = String(data.namaUjian || '').trim();
    const file = String(data.fileUjian || '').trim();
    const token = String(data.token || '').trim().toUpperCase();
    const waktu = Number(data.waktu);

    if (!username || !password) {
      return corsResponse({ ok: false, error: 'Sesi guru tidak valid. Silakan login ulang.' });
    }
    if (!nama || nama.length > 100) {
      return corsResponse({ ok: false, error: 'Nama ujian wajib diisi (maksimal 100 karakter).' });
    }
    if (!/^[^\\/:*?"<>|]+\.xml$/i.test(file)) {
      return corsResponse({ ok: false, error: 'Nama file ujian harus berupa nama file XML, misalnya ujian_kelas7.xml.' });
    }
    if (!Number.isInteger(waktu) || waktu < 0 || waktu > 1440) {
      return corsResponse({ ok: false, error: 'Waktu harus bilangan bulat antara 0 sampai 1440 menit.' });
    }
    if (token && !/^[A-Z0-9-]{4,40}$/.test(token)) {
      return corsResponse({ ok: false, error: 'Token hanya boleh berisi 4-40 huruf, angka, atau tanda hubung.' });
    }
    const tampilNilai = bacaFlagUjian(data.tampilNilai, true, 'tampil_nilai');
    const tampilPembahasan = bacaFlagUjian(data.tampilPembahasan, true, 'tampil_pembahasan');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const verif = verifikasiGuru(ss, username, password);
    if (!verif.ok) return corsResponse({ ok: false, error: verif.error });

    const fileDrive = cariFileUjianDrive(file);
    if (fileDrive.getSize() > 5 * 1024 * 1024) {
      return corsResponse({ ok: false, error: 'Ukuran file XML ujian melebihi batas 5 MB.' });
    }
    const xml = fileDrive.getBlob().getDataAsString('UTF-8');
    const dokumenXml = XmlService.parse(xml);
    if (dokumenXml.getRootElement().getName() !== 'ujian') {
      return corsResponse({ ok: false, error: 'Root dokumen XML harus berupa <ujian>.' });
    }

    const daftar = pastikanSheetDaftarUjian();
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const idxFile = daftar.header.indexOf('file_ujian');
      const lastRow = daftar.sheet.getLastRow();
      if (lastRow >= 2) {
        const files = daftar.sheet.getRange(2, idxFile + 1, lastRow - 1, 1).getValues();
        if (files.some(function(row) { return String(row[0] || '').trim().toLowerCase() === file.toLowerCase(); })) {
          return corsResponse({ ok: false, error: 'File ini sudah terdaftar di DaftarUjian.' });
        }
      }

      const row = new Array(daftar.header.length).fill('');
      row[daftar.header.indexOf('id')] = Utilities.getUuid();
      row[daftar.header.indexOf('nama_ujian')] = nama;
      row[idxFile] = file;
      row[daftar.header.indexOf('token')] = token;
      row[daftar.header.indexOf('waktu')] = waktu;
      row[daftar.header.indexOf('tampil_nilai')] = tampilNilai ? 1 : 0;
      row[daftar.header.indexOf('tampil_pembahasan')] = tampilPembahasan ? 1 : 0;
      daftar.sheet.appendRow(row);

      return corsResponse({
        ok: true,
        message: 'Ujian berhasil ditambahkan ke DaftarUjian.',
        id: row[daftar.header.indexOf('id')]
      });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal menambahkan ujian: ' + err.message });
  }
}

/**
 * handleSimpanUjian
 * Simpan hasil ujian siswa ke sheet "Ujian" (dibuat otomatis jika belum ada).
 * Kolom: id, waktu, sekolah, nama, kelas, fileUjian, nilai, waktuPengerjaan, jawabanJSON
 */
function handleSimpanUjian(data) {
  try {
    const sekolah = normalisasiSekolah(data.sekolah || '');
    const nama    = normalisasiNama(data.nama || '');
    const kelas   = normalisasiKelas(data.kelas || '');
    const fileUjian = (data.fileUjian || '').toString().trim();
    const nilai   = Number(data.nilai);
    const waktuPengerjaan = (data.waktuPengerjaan || '').toString().trim();
    const jawabanJSON = (data.jawabanJSON || '{}').toString();

    if (!nama)  return corsResponse({ ok: false, error: 'nama wajib diisi' });
    if (!kelas) return corsResponse({ ok: false, error: 'kelas wajib diisi' });
    if (!sekolah) return corsResponse({ ok: false, error: 'sekolah wajib diisi' });
    if (!fileUjian) return corsResponse({ ok: false, error: 'fileUjian wajib diisi' });
    if (nama.length > 100 || kelas.length > 20 || sekolah.length > 150 || fileUjian.length > 150) {
      return corsResponse({ ok: false, error: 'Data identitas atau nama ujian terlalu panjang' });
    }
    if (!Number.isFinite(nilai) || nilai < 0 || nilai > 100) {
      return corsResponse({ ok: false, error: 'nilai harus berupa angka antara 0 dan 100' });
    }
    if (waktuPengerjaan.length > 100 || jawabanJSON.length > 50000) {
      return corsResponse({ ok: false, error: 'Data hasil ujian terlalu panjang' });
    }
    let jawaban;
    try {
      jawaban = JSON.parse(jawabanJSON);
    } catch (err) {
      return corsResponse({ ok: false, error: 'jawabanJSON bukan JSON yang valid' });
    }
    if (!jawaban || typeof jawaban !== 'object' || Array.isArray(jawaban)) {
      return corsResponse({ ok: false, error: 'jawabanJSON harus berupa objek jawaban' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const NAMA_SHEET_UJIAN_BARU = 'Ujian';
    const HEADER_UJIAN = ['id', 'waktu', 'sekolah', 'nama', 'kelas', 'fileUjian', 'nilai', 'waktuPengerjaan', 'jawabanJSON'];

    let sheet = ss.getSheetByName(NAMA_SHEET_UJIAN_BARU);
    if (!sheet) {
      sheet = ss.insertSheet(NAMA_SHEET_UJIAN_BARU);
    }
    let header = sheet.getLastColumn() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(v) { return String(v || '').trim(); })
      : [];
    if (!header.some(function(v) { return Boolean(v); })) {
      header = HEADER_UJIAN.slice();
      sheet.getRange(1, 1, 1, header.length).setValues([header]);
      sheet.getRange(1, 1, 1, header.length)
        .setFontWeight('bold')
        .setBackground('#e8dcd0');
      sheet.setFrozenRows(1);
    } else {
      HEADER_UJIAN.forEach(function(kolom) {
        if (header.indexOf(kolom) === -1) {
          header.push(kolom);
          sheet.getRange(1, header.length).setValue(kolom);
        }
      });
    }

    const id = generateId(NAMA_SHEET_UJIAN_BARU);
    const waktu = formatWaktu(new Date());

    const row = new Array(header.length).fill('');
    setKolom(row, header, 'id', id);
    setKolom(row, header, 'waktu', waktu);
    setKolom(row, header, 'sekolah', sekolah);
    setKolom(row, header, 'nama', nama);
    setKolom(row, header, 'kelas', kelas);
    setKolom(row, header, 'fileUjian', fileUjian);
    setKolom(row, header, 'nilai', nilai);
    setKolom(row, header, 'waktuPengerjaan', waktuPengerjaan);
    setKolom(row, header, 'jawabanJSON', JSON.stringify(jawaban));

    sheet.appendRow(row);

    return corsResponse({
      ok: true, id: id, sheet: NAMA_SHEET_UJIAN_BARU,
      nilai: nilai, message: 'Hasil ujian berhasil disimpan'
    });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal simpan ujian: ' + err.message });
  }
}

/**
 * handleListSekolahUsers
 * Publik — tanpa login. Ambil daftar sekolah unik dari sheet Users kolom sekolah.
 */
function handleListSekolahUsers(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(NAMA_SHEET_USERS);

    if (!sheet || sheet.getLastRow() < 2) {
      return corsResponse({ ok: true, sekolah: [] });
    }

    const lastCol = sheet.getLastColumn();
    const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const idxSekolah = header.indexOf('sekolah');
    if (idxSekolah === -1) {
      return corsResponse({ ok: true, sekolah: [] });
    }

    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();
    const setSekolah = {};

    for (let i = 0; i < values.length; i++) {
      const s = normalisasiSekolah(values[i][idxSekolah]);
      if (s) setSekolah[s] = true;
    }

    const sekolahList = Object.keys(setSekolah).sort();

    return corsResponse({ ok: true, sekolah: sekolahList });

  } catch (err) {
    return corsResponse({ ok: false, error: 'Gagal ambil sekolah: ' + err.message });
  }
}

function recomputeNilaiAkhirSemua() {
  const PETA_BAGIAN = {
    'tik2': ['a','b','c','d','e'],   // f = kuis akhir
    'tik3': ['a','b','c'],            // d = kuis akhir
    'tik4': ['a','b','c'],            // d = kuis akhir
    'dsi1': ['a','b','c','d'],        // e = kuis akhir
    'dsi2': ['a','b','c'],            // d = kuis akhir
    'bk6':  ['a','b','c']             // d = kuis akhir
    // tambahkan modul lain sesuai kebutuhan
  };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(NAMA_SHEET_PROGRESS);
  if (!sheet || sheet.getLastRow() < 2) {
    console.log('Sheet Progress kosong / tidak ada.');
    return;
  }

  pastikanHeaderProgress(sheet);

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  const idxModul = header.indexOf('modul');
  const idxA     = header.indexOf('skor_a');
  const idxB     = header.indexOf('skor_b');
  const idxC     = header.indexOf('skor_c');
  const idxD     = header.indexOf('skor_d');
  const idxE     = header.indexOf('skor_e');
  const idxF     = header.indexOf('skor_f');
  const idxKuis  = header.indexOf('skor_kuis');
  const idxNilai = header.indexOf('nilai_akhir');
  const idxStatus = header.indexOf('status_modul');

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  let updated = 0;
  let skipped = 0;
  let noPeta = 0;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const modul = (row[idxModul] || '').toString().trim();
    const status = (row[idxStatus] || '').toString().trim().toLowerCase();

    if (status !== 'selesai') { skipped++; continue; }
    if (!PETA_BAGIAN[modul]) { noPeta++; continue; }

    const skorMap = {
      a: Number(row[idxA]) || 0,
      b: Number(row[idxB]) || 0,
      c: Number(row[idxC]) || 0,
      d: Number(row[idxD]) || 0,
      e: Number(row[idxE]) || 0,
      f: Number(row[idxF]) || 0
    };
    const skorKuis = Number(row[idxKuis]) || 0;

    const bagianValid = PETA_BAGIAN[modul];
    const skorArr = bagianValid.map(function(b) { return skorMap[b]; });
    const rata = skorArr.length > 0
      ? skorArr.reduce(function(x, y) { return x + y; }, 0) / skorArr.length
      : 0;
    const nilaiBaru = Math.round((rata * 0.5) + (skorKuis * 0.5));
    const nilaiLama = Number(row[idxNilai]) || 0;

    if (nilaiBaru !== nilaiLama) {
      sheet.getRange(i + 2, idxNilai + 1).setValue(nilaiBaru);
      updated++;
      console.log('UPDATE ' + modul + ' user=' + row[0] + ': ' + nilaiLama + ' ? ' + nilaiBaru +
        ' (bagian=' + bagianValid.join(',') + ', rata=' + rata + ', kuis=' + skorKuis + ')');
    }
  }

  console.log('=== SELESAI ===');
  console.log('Diperbarui: ' + updated);
  console.log('Dilewati (status != selesai): ' + skipped);
  console.log('Dilewati (modul tidak ada di PETA_BAGIAN): ' + noPeta);
  console.log('Total baris: ' + values.length);
}