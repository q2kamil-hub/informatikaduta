## Perubahan dari v3.8 → v3.9

1. **Peta portal TIK3 direvisi** — portal kini menggunakan bagian a–d sesuai file yang tersedia; bagian d adalah kuis akhir.
2. **Catatan konsistensi diperjelas** — daftar portal dan aktivitas yang masih memakai pola lama ditambahkan di §19.8.

Berikut dokumen lengkapnya:

```markdown
# 📋 CATATAN KONFIGURASI LENGKAP — PORTAL INFORMATIKA DUTA

> **Dokumen ini adalah "peta" proyek.** Saat pindah ke chat baru, cukup lampirkan dokumen ini + file sampel (script.js, desain.css, Code.gs, script aktivitas, css aktivitas, dan file yang relevan). AI akan langsung memahami arsitektur tanpa perlu membaca semua file.
>
> **Versi dokumen:** v3.9 (2026-11-10) — Revisi Peta TIK3 + Catatan Konsistensi Pola
> **Status migrasi DSI2 + BK6 + TIK4 + BK7:** ✅ LENGKAP
> **Status fitur Siswa:** ⚠️ Ada isu rollback proteksi URL (ditunda)

---

## 1. IDENTITAS PROYEK

| Item | Nilai |
|---|---|
| **Nama** | Portal Informatika DUTA |
| **Sekolah** | SMPN 2 Talegong |
| **Guru** | Kiki Husni Kamil, S.Pd. |
| **Mata Pelajaran** | Informatika SMP (Kurikulum Merdeka, Fase D) |
| **Root URL** | `/informatikaduta/` |
| **Bahasa** | Indonesia |
| **Encoding** | UTF-8 |
| **Versi script.js** | v3.4 (Multi-Bagian + Bulk Progress + PWA) |
| **Versi Code.gs** | v3.6 (Fix nilai_akhir + totalBagianAktif) |
| **Versi PWA** | v1.0.0 |
| **File PWA** | `manifest.json`, `sw.js`, `versi.json` |
| **Terbit** | 2026-10-29 |

---

## 2. STRUKTUR FOLDER

```
/informatikaduta/
├── index.html                      # Beranda portal
├── login.html                      # Login siswa/guru/tamu (v3.4: + dropdown + form tamu)
├── daftar.html                     # Daftar akun siswa (v3.5: + dropdown sekolah + 2 dropdown kelas + FAB guru)
├── daftarguru.html                 # Daftar akun guru (v3.5: BARU — form pendaftaran guru)
├── 404.html                        # Halaman error
├── desain.css                      # CSS global (semua halaman)
├── script.js                       # JS global (v3.4: totalBagianAktif)
├── favicon.png
├── manifest.json                 # Web App Manifest (PWA v1.0.0)
├── sw.js                         # Service Worker (PWA offline + cache)
├── versi.json                    # Versi aplikasi (untuk deteksi update)
│
├── partials/
│   └── breadcrumb.json             # Mapping URL → breadcrumb
│
├── dashboard/
│   ├── guru.html                   # Dashboard guru (v3.4: + modal Lihat Data Siswa)
│   └── siswa.html                  # Dashboard siswa (v3.4: JOIN Users + Progress; ⚠️ proteksi URL ditunda)
│
├── ujian/
│   └── daftarujian.html
│
├── tik/                            # Modul TIK (10 modul × 4-6 bagian)
│   ├── materitik.html
│   ├── tik1.html ... tik10.html    # Portal modul
│   ├── materitik1.html ... 10      # Materi lengkap
│   ├── aktivitastik1a.html ...
│   ├── aktivitastik2a.html ... f    # ✅ MIGRASI (6 bagian)
│   ├── aktivitastik3a.html ... d    # ✅ MIGRASI (4 bagian; d = kuis akhir)
│   ├── aktivitastik4a.html ... d    # ✅ MIGRASI v3.6 (4 bagian)
│   ├── desaintik2.css               # CSS mandiri TIK2
│   ├── desaintik3.css               # CSS mandiri TIK3
│   ├── desaintik4.css               # ✅ BARU — CSS mandiri TIK4 (v3.6)
│   └── scripttik.js                 # Helper global TIK (DUTA_TIK)
│
├── sk/                             # Sistem Komputer (10 modul)
├── jki/                            # Jaringan Komputer & Internet (10 modul)
│
├── dsi/                            # Dampak Sosial Informatika
│   ├── materidsi.html
│   ├── dsi1.html ... dsi6.html     # Portal modul
│   ├── materidsi1.html ... 6       # Materi lengkap
│   ├── aktivitasdsi1a.html ... e   # ✅ MIGRASI v3.3 (5 bagian)
│   ├── aktivitasdsi2a.html ... d   # ✅ MIGRASI v3.3.1 (4 bagian)
│   ├── desaindsi1.css
│   ├── desaindsi2.css
│   └── scriptdsi.js                # ✅ TIDAK BERUBAH
│
├── ad/                             # Analisis Data (10 modul)
│
├── bk/                             # Berpikir Komputasional (9 topik)
│   ├── materibk6.html              # Materi Stack
│   ├── bk6.html                    # Portal Stack
│   ├── aktivitasbk6a.html ... d    # ✅ MIGRASI v3.3.1
│   ├── desainbk6.css
│   ├── materibk7.html              # ✅ BARU — Materi Pohon & Jaringan
│   ├── bk7.html                    # ✅ BARU — Portal Pohon & Jaringan
│   ├── aktivitasbk7a.html          # ✅ BARU — Pohon (drag-drop silsilah)
│   ├── aktivitasbk7b.html          # ✅ BARU — Jaringan (drag-drop peta jalan)
│   ├── aktivitasbk7c.html          # ✅ BARU — Beda keduanya (klasifikasi 8 kartu)
│   ├── aktivitasbk7d.html          # ✅ BARU — Kuis akhir + sertifikat
│   ├── desainbk7.css               # ✅ BARU — CSS mandiri BK7
│   └── scriptbk.js                 # ✅ TIDAK BERUBAH (generik untuk bk6, bk7)
│
└── ap/                             # Algoritma Pemrograman (10 modul)
```

---

## 3. BACKEND — Google Apps Script (Code.gs v3.6)

### 3.1 Deploy
- Deploy sebagai **Web App**: Execute as **Me**, Who has access **Anyone**.
- URL API disimpan di `window.DUTA_API.url` (lihat `script.js`).
- API Key Gemini di Script Properties: `GEMINI_API_KEY`.
- **Setiap patch `Code.gs` → WAJIB deploy ulang (New version).**
- ⚠️ **Jeda ~10 detik** setelah deploy sebelum API bisa diakses (kalau tidak: error `Unexpected token '<'`).

### 3.2 Sheet yang Digunakan

| Sheet | Header | Fungsi |
|---|---|---|
| `Users` | `username, password, nama, kelas, sekolah, waktu_daftar` | Akun siswa |
| `Tamu` | `kode_tamu, sekolah, nama, kelas, waktu_dibuat, waktu_kadaluarsa` | Akun tamu (24 jam) |
| `Progress` | `user_id, modul, bagian_terakhir, skor_a...skor_f, skor_kuis, nilai_akhir, nama_siswa, status_modul, waktu_update` | Progres belajar |
| `Guru` | `username, password, nama, sekolah, kontak, status` | Akun guru (v3.5: + kontak, status) |
| `LinkUjian` | `No, Nama_Ujian, Link_Ujian, Token` | Daftar ujian |

### 3.3 Daftar Action API (v3.6)

| Action | Input | Output |
|---|---|---|
| `register` | username, password, nama, kelas, sekolah | `{ok, user_id, nama, kelas, sekolah}` — cek sekolah di sheet Guru |
| `registerGuru` | username, password, nama, sekolah, kontak | `{ok, message}` — status `tunggu` |
| `login` | username, password | `{ok, user_id, nama, kelas, sekolah}` |
| `loginGuru` | username, password | `{ok, tipe:'guru', user_id, nama, sekolah}` — tolak jika status != `disetujui` |
| `cekUser` | username | `{ok, tersedia}` |
| `cariUser` | username | `{ok, tersedia:false, user:{...}}` |
| `buatTamu` | sekolah, nama, kelas | `{ok, kode_tamu, ...}` |
| `getProgress` | userId, modul | `{ok, progress:[...]}` |
| `simpanProgress` | userId, modul, bagianTerakhir, skor, nilaiAkhir, **totalBagianAktif** | `{ok, locked?, status_modul, nilai_akhir_baru}` — single |
| `simpanProgressBulk` | userIds:[...], modul, ..., **totalBagianAktif** | `{ok, sukses, gagal, results:[...]}` |
| `resetUser` | userId (TAMU-) | `{ok, message}` |
| `getAllProgress` | username, password | `{ok, guru, progress:[...]}` — filter by sekolah |
| `unlockModul` | username, password, userId, modul | `{ok}` |
| `updateSiswa` | username, password, userId, nama, kelas, sekolah, passwordSiswa | `{ok}` |
| `hapusTamuBulk` | username, password, userIds:[...] | `{ok, dihapus, dilewati}` |
| `getBackupData` | username, password | `{ok, backup:{...}}` |
| `restoreBackup` | username, password, backup | `{ok}` — overwrite semua sheet |
| `getFeedbackAI` | userId, modul, bagian, level, skorTes, ... | `{ok, feedback, model, waktu}` |
| `listKelasGuru` | username, password | `{ok, kelas:['7A',...]}` |
| `listSiswaGuru` | username, password, kelas | `{ok, siswa:[...], total}` |
| `getPasswordSiswa` | username, password, userId | `{ok, username, password}` |
| `listSekolahGuru` | (tanpa login) | `{ok, sekolah:[...]}` |
| `getProgressSiswaDetail` | userId, temanUserIds:[...] | `{ok, siswa, teman[], progress[]}` |
| `listUjian` | — | `{ok, ujian:[...]}` |
| `verifyToken` | namaUjian, token | `{ok, valid, link, message}` |

### 3.4 Aturan Penting Backend

- **Normalisasi**: nama (Title Case), kelas (romawi→angka, uppercase), sekolah (UPPERCASE), kontak (buang non-digit, `08` → `628`).
- **Validasi password**: Siswa min 4, Guru min 6. Max 50, no spasi, ≠ username.
- **Validasi username**: min 3, max 30, `[a-zA-Z0-9._-]`.
- **Pengecekan Username Unik**: `registerGuru` mengecek dua sheet (`Users` & `Guru`).
- **Pendaftaran Siswa**: Sekolah yang diinput **wajib** sudah terdaftar di sheet `Guru`.
- **Login Guru**: `verifikasiGuru` menolak login jika kolom `status` bukan `disetujui`.
- **Kunci modul**: `kunciModul: true` → `status_modul = 'selesai'`. Jika sudah selesai, return `{locked:true}` dan tidak menimpa nilai.
- **`simpanProgressBulk`**: Duplikat userIds dibuang, per-user independen, return `{sukses, gagal, results}`.
- **Filter sekolah**: `getAllProgress`, `unlockModul`, `listKelasGuru`, `listSiswaGuru`, `getPasswordSiswa` strict filter by sekolah guru.

### 3.5 ⚠️ ATURAN KRITIS: `nilai_akhir` Multi-Bagian (v3.6)

**Bug lama:** Saat `kunciModul: true`, backend menghitung rata-rata dari **6 kolom** (a–f) hardcoded, bukan dari bagian yang benar-benar dinilai. Untuk TIK4 (hanya a, b, c dinilai + kuis d), hasilnya:
```
rata = (100+100+100+0+0+0)/6 = 50
nilai_akhir = round(50×0.5 + 100×0.5) = 75  ← SALAH
```

**Fix v3.6:** Frontend kirim `totalBagianAktif: [...]`, backend pakai untuk menghitung rata-rata hanya dari bagian valid:
```
totalBagianAktif = ['a','b','c']
rata = (100+100+100)/3 = 100
nilai_akhir = round(100×0.5 + 100×0.5) = 100  ← BENAR
```

**Aturan untuk modul baru:**

| Modul | `TOTAL_BAGIAN` | Bagian kuis | `totalBagianAktif` |
|-------|----------------|-------------|---------------------|
| TIK2 | `['a','b','c','d','e','f']` | `f` | `['a','b','c','d','e']` |
| TIK3 | `['a','b','c','d']` | `d` | `['a','b','c']` |
| TIK4 | `['a','b','c','d']` | `d` | `['a','b','c']` |
| TIK5 (contoh) | `['a','b','c','d','e','f']` | `f` | `['a','b','c','d','e']` |
| DSI1 | `['a','b','c','d','e']` | `e` | `['a','b','c','d']` |
| DSI2 | `['a','b','c','d']` | `d` | `['a','b','c']` |
| DSI3 (contoh) | `['a','b','c','d']` | `d` | `['a','b','c']` |
| BK6 | `['a','b','c','d']` | `d` | `['a','b','c']` |
| BK7 | `['a','b','c','d']` | `d` | `['a','b','c']` |
| BK8 (contoh) | `['a','b','c','d','e','f']` | `f` | `['a','b','c','d','e']` |

**Rumus:** `totalBagianAktif` = semua bagian **kecuali** bagian kuis akhir.

### 3.6 Util: `recomputeNilaiAkhirSemua()`

Fungsi manual untuk memperbaiki data lama yang `nilai_akhir`-nya salah (dari bug pembagian 6 kolom).

**Cara pakai:**
1. Buka Apps Script editor.
2. Pilih fungsi `recomputeNilaiAkhirSemua` dari dropdown.
3. Klik **Run** → lihat log (`Ctrl+Enter`).

**Peta bagian** (`PETA_BAGIAN` di dalam fungsi) — sesuaikan jika ada modul baru:
```js
const PETA_BAGIAN = {
  'tik2': ['a','b','c','d','e'],   // f = kuis
  'tik3': ['a','b','c','d','e'],   // f = kuis
  'tik4': ['a','b','c'],            // d = kuis
  'dsi1': ['a','b','c','d'],        // e = kuis
  'dsi2': ['a','b','c'],            // d = kuis
  'bk6':  ['a','b','c'],            // d = kuis
  'bk7':  ['a','b','c']             // d = kuis
};
```

**Kapan perlu dijalankan?**
- ✅ Setelah patch `Code.gs` v3.6 untuk memperbaiki data lama.
- ❌ Tidak perlu untuk modul baru (backend langsung pakai `totalBagianAktif` dari frontend).

---

## 4. FRONTEND GLOBAL — script.js (v3.4)

### 4.1 Konfigurasi Awal
```js
window.DUTA_API.url       // URL Apps Script
window.DUTA_BOBOT         // { aktivitas: 0.5, kuis: 0.5 };
window.DUTA_ROOT          // auto-detect (bisa di-override di subfolder)
window.DUTA_MODUL_AKTIF   // auto-detect dari pathname
```

### 4.2 Fungsi Global Utama

**Root & Modul:** `getRoot()`, `getModulAktif()`

**Normalisasi:** `window.dutaNormalisasi = { nama, kelas, sekolah }`

**Hitung Nilai:** `hitungNilaiAkhir(arr, kuis)`, `hitungRataAktivitas(arr)`

**Identitas Multi-User (v3.3):**
- `ambilIdentitasSiswaMulti()`, `simpanIdentitasSiswaMulti(obj)`, `hapusIdentitasSiswaMulti()`
- `sinkronkanIdentitasDenganSession()`
- `ambilUserIdsUntukProgress()` → `{userIds: [...], namaGabung: '...'}`

**Session (localStorage `duta_session`):**
- `simpanSession(s)`, `ambilSession()`, `hapusSession()`
- `sudahLogin()`, `modeTamu()`, `ambilUserId()`
- Sliding expiration **60 menit**

**Session Guru (sessionStorage `duta_guru`):**
- `simpanSessionGuru(guru)`, `ambilSessionGuru()`, `hapusSessionGuru()`

**API (Global):**
- `dutaFetch(payload)`, `dutaLogin(u,p)`, `dutaDaftar(...)`, `dutaCekUser(u)`
- `dutaBuatTamu(...)`, `dutaPastikanPunyaKode(...)`, `dutaLoginGuru(u,p)`
- `cekAksesDashboard()` — validasi login sebelum masuk dashboard via navbar

**Progress (v3.4):**
- `dutaAmbilProgress(modul)`
- `dutaSimpanProgress(modul, bagian, skor, nilaiAkhir, opsi)` — **single**, v3.4: terima `opsi.totalBagianAktif`
- `dutaSimpanProgressBulk(modul, bagian, skor, nilaiAkhir, opsi)` — **multi**, v3.4: terima `opsi.totalBagianAktif`
- `dutaCekStatusModul(modul, {refresh})` → cache 60s

**State Save/Restore (localStorage, TTL 24 jam):**
- `dutaSimpanState(keyBase, obj, {force})`, `dutaAmbilState(keyBase)`
- `dutaHapusState(keyBase)`, `dutaAutoSave`, `dutaPasangAutoSaveInput`

**Dashboard Guru:** `dutaGetAllProgress`, `dutaUnlockModul`, `dutaUpdateSiswa`, `dutaHapusTamuBulk`, `dutaBackupData`, `dutaRestoreBackup`

**UI Helper:**
- `tampilkanModal({judul, pesan, tombolLanjut, onLanjut})`
- `tampilkanLoading(aktif)`
- `renderTombolLanjut({...})`
- `renderUserBar()` — render isi `.duta-user-bar`
- `bukaModalIdentitas()` — modal Kelola Identitas / Identitas Tamu

### 4.3 ⚠️ Patch Kritis v3.4 — `totalBagianAktif`

Kedua fungsi progress harus meneruskan `opsi.totalBagianAktif` ke payload:

```js
window.dutaSimpanProgress = async function(modul, bagianTerakhir, skor, nilaiAkhir, opsi) {
  const o = opsi || {};
  return await window.dutaFetch({
    // ...
    kunciModul: o.kunciModul === true,
    totalBagianAktif: Array.isArray(o.totalBagianAktif) ? o.totalBagianAktif : null  // ⬅️ WAJIB
  });
};

window.dutaSimpanProgressBulk = async function(modul, bagianTerakhir, skor, nilaiAkhir, opsi) {
  const o = opsi || {};
  const totalBagianAktif = Array.isArray(o.totalBagianAktif) ? o.totalBagianAktif : null;
  // Kirim ke fallback single & bulk
};
```

---

## 5. CSS GLOBAL — desain.css (v3.3)

### 5.1 Variabel CSS (`:root`)
```css
--bg: #fdf6ec; --bg-soft: #fff9f2;
--ink: #2b1d2e; --ink-soft: #5b4a55;
--c-tik: #ff8a5b; --c-sk: #4fb0c6; --c-jki: #6ecb8f;
--c-dsi: #f4b942; --c-ad: #b07be0; --c-bk: #f26d8a;
--c-ap: #5c7cfa; --c-ujian: #ef476f;
--c-tamu: #e8a020; --c-login: #2d7d46; --c-danger: #b33c3c;
```

### 5.2 Kelas Utama
`.banner`, `.duta-user-bar`, `.duta-navbar`, `.auth-wrapper`, `.duta-modal-*`, `.banner-tamu`, `#scrollTopBtn`

### 5.3 Kelas User Bar & Modal Identitas (v3.3)
- **User Bar:** `.ub-trigger`, `.ub-info`, `.ub-badge-teman`, `.ub-caret`
- **Dropdown:** `.ub-dropdown`, `.ub-drop-header`, `.ub-drop-section`, `.ub-chip`, `.ub-chip-hapus`, `.ub-drop-btn`
- **Modal Login:** `.duta-modal-identitas-box`, `.identitas-utama-card`, `.teman-chip`, `.tambah-teman-row`, `.btn-cek`, `.btn-tambah`

---

## 6. POLA AKTIVITAS — 4 LAPIS (STRUKTUR STANDAR)

Setiap aktivitas modul punya **4 lapis**:

| Lapis | Nama | Isi |
|---|---|---|
| **1** | Menjelajah Bebas | Simulasi/game + Jeda Sadar 1 |
| **2** | Tantangan Terarah | Level (Dasar/Reguler/Tantangan) → 3-4 tantangan + Jeda Sadar 2 |
| **3** | Penamaan Konsep | Modal baca (timer 12s) + tabel istilah + Jeda Sadar 3 + Kuis Kilat |
| **4** | Tes Pemahaman | 4 soal (min 3 benar) + Hasil + Refleksi + Exit Ticket + Feedback AI |

**Diferensiasi Level:** 🟢 Dasar (3 terbimbing), 🟡 Reguler (3 standar), 🔴 Tantangan (3 + 1 bonus esai ≥80 char).

### 6.1 ⚠️ Identitas di File Aktivitas (v3.7)

**Aturan identitas di file aktivitas:**
- **File pertama (a)** dari setiap modul — **WAJIB** punya `.info-identitas-box` + tombol "🚀 Mulai Aktivitas" + `mulaiAktivitas()`
- **File terakhir (kuis)** — **WAJIB** punya `.info-identitas-box` untuk menampilkan penerima sertifikat
- **File tengah (b, c, d, ...)** — **TIDAK BOLEH** punya form identitas. Area simulasi langsung aktif (`#area-simulasi.active` di markup).

**Contoh:** BK7
- `aktivitasbk7a.html` → ada `.info-identitas-box` + `mulaiAktivitas()` ✅
- `aktivitasbk7b.html` → tidak ada form, langsung simulasi ✅
- `aktivitasbk7c.html` → tidak ada form, langsung simulasi ✅
- `aktivitasbk7d.html` → ada `.info-identitas-box` (untuk sertifikat) ✅

**Alasan:** Identitas cukup dikelola sekali di awal (User Bar) dan ditampilkan sekali di akhir (sertifikat). File tengah yang punya form identitas akan membuat siswa mengisi berulang-ulang — mengganggu pengalaman.

---

## 7. IDENTITAS MULTI-USER (v3.3) — SENTRALISASI DI USER BAR

### 7.1 Konsep
Form identitas lokal di setiap file aktivitas **DIHAPUS** (kecuali file pertama & terakhir modul — lihat §6.1). Identitas dikelola dari **User Bar** (pojok kanan atas). Struktur `localStorage.duta_identitas_siswa`:
```json
{
  "tipe": "login" | "tamu",
  "utama": { "username", "nama", "kelas", "sekolah" },
  "teman": [ { "username", "nama", "kelas", "sekolah" }, ... ],
  "tamu": { "sekolah", "kelas", "daftarNama": ["..."] } | null
}
```

### 7.2 Alur Data
- **Login**: `teman` maks 4. Progress dikirim ke `[utama.username, ...teman.username]`.
- **Tamu**: pakai `tamu.daftarNama`. Progress dikirim ke `[session.user_id]`.
- **Tambah/Hapus Teman**: via modal `⚙️ Identitas` → `cariUser` + verifikasi password → update array `teman`.

---

## 8. PENGIRIMAN NILAI MULTI-USER — BULK PROGRESS

### 8.1 Alur Frontend
```text
Tes lulus → D.onLulus(correct, total)
  → refreshIdentitasUI() (jika ada)
  → dutaSimpanProgressBulk(modul, bagian, skor, nilaiAkhir, {kunciModul, totalBagianAktif})
    → ambilUserIdsUntukProgress() → {userIds, namaGabung}
    → jika 1 user → fallback dutaSimpanProgress
    → jika >1 user → dutaFetch({action:'simpanProgressBulk', ...})
```

### 8.2 Alur Backend
```text
handleSimpanProgressBulk(data)
  → validasi userIds (array, dedup, trim)
  → untuk setiap userId:
      simpanProgressSatuUser(userId, payload)
        → cek existing row di sheet Progress
        → jika status_modul === 'selesai' → return {locked:true}
        → else → merge skor lama + skor baru → update/insert row
        → jika kunciModul: true → hitung ulang nilai_akhir dari totalBagianAktif
  → return agregat {ok, sukses, gagal, results:[...]}
```

### 8.3 ⚠️ Rumus `nilai_akhir` (v3.6)

```js
// Saat kunciModul: true
bagianValid = data.totalBagianAktif || ['a','b','c','d','e','f']  // fallback lama
skorArr = bagianValid.map(b => skorBaru[b])
rata = sum(skorArr) / skorArr.length
nilai_akhir = round(rata × 0.5 + skor_kuis × 0.5)
```

### 8.4 Contoh Pemanggilan di File Kuis Akhir

```js
// Konfigurasi modul
const TOTAL_BAGIAN = ['a', 'b', 'c', 'd'];
const BAGIAN_KUIS = 'd';
const TOTAL_BAGIAN_AKTIVITAS = TOTAL_BAGIAN.filter(b => b !== BAGIAN_KUIS);  // ['a','b','c']

// Di simpanNilaiKuis():
const hasil = await window.dutaSimpanProgressBulk(
  MODUL_KEY, BAGIAN_KUIS, { kuis: skorKuis }, 0,
  { kunciModul: true, totalBagianAktif: TOTAL_BAGIAN_AKTIVITAS }
);
```

---

## 9. SCRIPT AKTIVITAS — scriptdsi.js / scriptbk.js / scripttik.js

### 9.1 API Modul (`DUTA_TIK` / `DUTA_DSI` / `DUTA_BK`)
- **Config & State:** `D.config`, `D.state`
- **Helper:** `escapeHtml`, `formatWaktuDetik`, `tampilFeedback`, `updateProgressLapis`
- **Diferensiasi:** `pilihLevel`, `lanjutKeLapis2`, `buildTantangan`, `periksaTantangan`
- **Lapis 3:** `lanjutKeLapis3`, `tampilkanModalPenamaan`, `buildKuisKilat`, `submitKuisKilat`
- **Tes:** `lanjutKeTesPemahaman`, `renderSoal`, `pilihJawabanTes`, `periksaTes`
- **Kirim & Navigasi:** `kirimNilaiBagian`, `tampilkanGagalKirim`, `lanjutKeBagianBerikutnya`
- **Feedback AI:** `cekTombolFeedback`, `renderFeedbackAi`, `mintaFeedbackGuru`
- **State:** `kumpulkanState`, `restoreState`, `tawarkanRestore`
- **Init:** `D.init(opts)`

### 9.2 Callback Wajib File Aktivitas
| Callback | Wajib? | Fungsi |
|---|---|---|
| `stateKustom()` | ✅ | Return objek state spesifik bagian |
| `pulihkanTampilan(s)` | ✅ | Render ulang UI dari state tersimpan |
| `onLulus(correct, total)` | ✅ | Simpan skor ke localStorage + `dutaSimpanProgressBulk` |
| `ringkasHasilUntukAI()` | ⚪ | Ringkasan hasil simulasi |
| `bolehTawarkanRestore(s)` | ⚪ | Return false jika state belum "layak" |
| `onLapis2Selesai()` | ⚪ | Simpan state saat lapis 2 selesai |
| `onKlikLanjutBagian()` | ⚪ | Override handler tombol "Lanjut" |

### 9.3 ⚠️ Konstanta WAJIB Sebelum `init()`

Untuk menghindari `ReferenceError`, pastikan **semua konstanta** yang dipakai di `DUTA_TIK.init({...})` dideklarasikan **sebelum** init dipanggil:

```js
const kuisKilatData = [...];        // WAJIB
const soalTesData = [...];          // WAJIB (bukan soalData!)
const tantanganDasar = [...];       // WAJIB
const tantanganReguler = [...];     // WAJIB
const tantanganBonus = [...];       // WAJIB (boleh kosong [])

DUTA_TIK.init({
  kuisKilatData: kuisKilatData,
  soalTesData: soalTesData,
  tantanganDasar: tantanganDasar,
  tantanganReguler: tantanganReguler,
  tantanganBonus: tantanganBonus,
  // ...
});
```

> ⚠️ **Catatan:** nama parameter `soalTesData` berbeda dengan nama konstanta lokal `soalData` yang biasa dipakai. Jangan lupa mapping: `soalTesData: soalData`.

### 9.4 ⚠️ Bug yang Sudah Diperbaiki di BK7a (v3.7)

**Bug:** `Uncaught SyntaxError: Identifier 'offsetX' has already been declared`

**Penyebab:** Di fungsi `mulaiDrag`, ada deklarasi ganda:
```js
// SALAH
function mulaiDrag(e, id) {
  let offsetX, offsetY;
  if (dariPalet) {
    const offsetX = ...; // ⬅️ deklarasi ulang di scope yang sama (error!)
    const offsetY = ...;
  }
  // ...
}
```

**Fix:** Gunakan satu set variabel `let offsetX = 0; let offsetY = 0;` di awal fungsi, lalu assign (bukan deklarasi ulang) di dalam blok `if`.

**Efek samping:** Jika bug ini ada, seluruh IIFE gagal parse → `window.mulaiAktivitas` tidak ter-assign → `ReferenceError: mulaiAktivitas is not defined` saat tombol diklik.

---

## 10. CSS AKTIVITAS — desaindsi1.css / desaindsi2.css / desainbk6.css / desainbk7.css / desaintik3.css / desaintik4.css

**Semua CSS aktivitas independen** — tidak saling impor. Panggil SETELAH `desain.css`.

### 10.1 Struktur Umum (semua CSS aktivitas)
1. `.progress-lapis` — 4 step pill
2. `.lapis-header` — `.lapis-1` (biru), `.lapis-2` (kuning), `.lapis-3` (hijau/ungu)
3. `#area-simulasi`, `.scenario-panel`, `.misi-info`, `.stats-bar`
4. `.feedback-box` — `.success`, `.error`, `.info`, `.warn`
5. `.btn-game`, `.game-actions`, `.mindful-box`
6. `#areaPilihLevel`, `.pilih-level-box`, `.level-option`
7. `.tantangan-list`, `.tantangan-item`
8. `.penamaan-box`, `.tabel-istilah`, `.duta-penamaan-overlay`
9. `.tes-section`, `.soal-kuis`, `.opsi-kuis`, `.hasil-tes`
10. `.refleksi-box`, `.exit-ticket`
11. `.status-kirim`, `.nav-bottom`, `.feedback-ai-box`

### 10.2 CSS Unik per Aktivitas
- **desainbk6.css:** aksen hijau (#6ecb8f), `.stack-sim`, `.rak-stack`, `.elemen-stack`, `.btn-operasi`, `.log-aktivitas`
- **desainbk7.css:** aksen biru-ungu (#5c7cfa → #8a4bbf), `.kanvas-area`, `.kartu-nama` (tree/graph/root/leaf), `.palet-kartu`, `.sim-actions`, `.kanvas-status`, `.pembanding-grid`, `.pohon-atau-jaringan`
- **desaindsi1.css:** aksen ungu, `.warung-sim`, `.pesanan-list`, `.timeline-jadwal`
- **desaindsi2.css:** aksen ungu, `.mode-selector`, `.sim-panel`, `.tim-anggota`, `.think-grid`
- **desaintik3.css:** aksen biru-hijau (#4fb0c6 → #6ecb8f), `.ikon-grid`, `.ikon-app`, `.jendela-sim`, `.path-bar`, `.folder-view`, `.toolbar`, `.search-result-list`
- **desaintik4.css:** aksen oranye (#ff8a5b → #f4b942), `.folder-sim`, `.file-grid`, `.file-item`, `.file-sim`, `.file-row`, `.explorer-sim`, `.path-bar`, `.folder-view`, `.toolbar`, `.search-result-list`, `.sertifikat-box`, `.sf-*`, `.gagal-box`, `.gb-*`, `.btn-sertifikat`

### 10.3 Aturan CSS Mandiri
- **Satu file CSS per modul** (mis. `desaintik4.css`, `desainbk7.css`).
- Panggil **hanya** `../desain.css` + `<modul>.css` (tidak impor CSS modul lain).
- Semua kelas yang dipakai di file aktivitas modul harus ada di CSS modul tersebut.

---

## 11. STRUKTUR FILE AKTIVITAS (TEMPLATE v3.7)

### 11.1 Template File Pertama (a) — DENGAN Form Identitas

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <title>...</title>
  <link rel="stylesheet" href="../desain.css">
  <link rel="stylesheet" href="desain<modul>.css">
  <style>/* CSS unik bagian ini (jika ada) */</style>
</head>
<body>
  <header id="header-utama"></header>
  <div id="duta-breadcrumb-host"></div>
  <main class="container" id="konten-utama">
    <article class="card">
      <div class="aktivitas-wrapper">
        <!-- progress bar -->
        <!-- [BAGIAN a] INFO IDENTITAS (read-only) -->
        <div class="info-identitas-box" id="infoIdentitasBox">...</div>
        <!-- AREA SIMULASI -->
        <!-- ... -->
      </div>
    </article>
  </main>
  <footer id="footer-utama"></footer>
  <script src="../script.js"></script>
  <script src="script<mapel>.js"></script>
  <script>/* kode + DUTA_TIK.init({...}) */</script>
</body>
</html>
```

### 11.2 Template File Tengah (b, c) — TANPA Form Identitas

```html
<div id="area-simulasi" class="active">
  <!-- langsung simulasi, tidak ada form identitas -->
</div>
```

Init langsung di `DOMContentLoaded`:
```js
document.addEventListener('DOMContentLoaded', function() {
  DUTA_BK.init({...});
  elAreaSimulasi.classList.add('active');
  initSimulasi();
  setTimeout(function() { DUTA_BK.tawarkanRestore(); }, 60);
});
```

### 11.3 Template File Akhir (kuis) — DENGAN Form Identitas

Untuk sertifikat, form identitas tetap ada (menampilkan penerima). Sama seperti template file pertama, tapi:
- Tidak ada tombol "Mulai Aktivitas" (langsung tampil soal setelah klik "🏆 Mulai Kuis Akhir")
- `.info-identitas-box` menampilkan nama penerima sertifikat

### 11.4 Elemen ID Wajib
- `progressLapis`, `feedbackBox`, `fbIcon`, `fbText`
- `area-simulasi`, `areaPilihLevel`, `areaLapis2`, `areaLapis3`
- `levelOptions`, `levelBadge`, `mindfulPilihLevel`, `btnLanjutLapis2`
- `lapis2LevelLabel`, `lapis2JumlahTantangan`, `tantanganList`, `mindful2`, `btnLanjutLapis3`
- `penamaanKonten`, `mindful3`, `kuisKilatBox`, `btnLanjutTes`
- `tesSection`, `soalContainer`, `tesProgress`, `btnPeriksaTes`, `hasilTes`, `refleksiBox`
- `btnLanjutBagian`, `statusKirim`
- **File pertama dan kuis akhir (pola baru, jika memakai kartu identitas):** `infoIdentitasBox`, `iibBadge`, `iibNama`, `iibMeta`, `btnUbahIdentitas`, `btnMulai`

### 11.5 Patch File Aktivitas Tanpa Kartu Identitas (bagian tengah)
- **A**: Tambah `let daftarSiswa = [];` + `refreshIdentitasUI()` (jika perlu untuk AI/ringkasan).
- **B**: `simpanSkorBagianX()` → gunakan `dutaSimpanProgressBulk`.
- **C**: `DOMContentLoaded` panggil `refreshIdentitasUI()` (jika ada) + listener `storage`.
- **Pola baru**: Tidak ada `.info-identitas-box`, langsung `#area-simulasi.active`. Umumnya bagian di antara aktivitas pertama dan kuis akhir (b–c atau b–e, sesuai modul).

### 11.6 JS — File Pertama dan Kuis Akhir (pola baru)
- Sertakan `#infoIdentitasBox`, listener `btnUbahIdentitas`, dan logic `mulaiAktivitas()`.
- Kirim `dutaSimpanProgressBulk(..., {kunciModul: true, totalBagianAktif: [...]})` di bagian kuis akhir.

---

## 12. ALUR DATA (v3.7)

### 12.1 Login Siswa
```
login.html → dutaLogin(u,p) → simpanSession({tipe:'login'}) → redirect
```

### 12.2 Login Guru
```
login.html → dutaLoginGuru(u,p) → verifikasiGuru (cek status='disetujui') → simpanSessionGuru → redirect dashboard/guru
```

### 12.3 Tamu (via login.html)
```
login.html → klik "Lanjut sebagai Tamu" → isi form → dutaBuatTamu() → simpanSession + identitas → redirect
```

### 12.4 Tambah Teman (Login)
```
User Bar → ⚙️ Identitas → cariUser → verifikasi password → tambah ke array teman → renderUserBar()
```

### 12.5 Simpan Progress
```
Tes lulus → onLulus() → dutaSimpanProgressBulk() → simpanProgressSatuUser (loop) → sheet Progress
```

### 12.6 Dashboard Siswa
```
siswa.html → ambilSessionSiswa() → API getProgressSiswaDetail(userId, temanIds) → join Users + Progress → render
```

### 12.7 Dashboard Guru — Lihat Data Siswa
```
guru.html → List Data Siswa → listKelasGuru + listSiswaGuru → tabel
Aksi: getPasswordSiswa / updateSiswa
```

### 12.8 Pendaftaran Guru
```
daftarguru.html → registerGuru → simpan ke sheet Guru (status='tunggu') → modal sukses + tombol WA Admin
```

### 12.9 Pendaftaran Siswa
```
daftar.html → pilih sekolah dari dropdown (listSekolahGuru) → register → cek sekolah di sheet Guru → simpan Users
```

### 12.10 Kuis Akhir (v3.6)
```
File aktivitas akhir → jawab kuis → simpanNilaiKuis()
  → dutaSimpanProgressBulk(modul, bagianKuis, {kuis: skorKuis}, 0,
      { kunciModul: true, totalBagianAktif: [bagian aktivitas] })
  → backend simpanProgressSatuUser → hitung ulang nilai_akhir
  → status_modul = 'selesai'
```

### 12.11 Portal Modul (v3.7) — Modal "Mulai Belajar"
```
Portal <modul>.html → klik "Materi + Aktivitas"
  → modal terbuka
  → [opsional] klik "🔍 Tes Asesmen Diagnostik"
      → 5 soal → "Cek Hasil" → rekomendasi level (dasar/reguler/tantangan)
      → simpan di localStorage.<modul>_rekomendasi_level
  → [jika login + ada progress] klik "▶️ Lanjutkan dari Bagian X"
      → MAP_FILE[berikutnya]
  → [jika sudah selesai] klik "🔄 Ulangi Modul Ini"
      → modal peringatan → MAP_FILE['a']
  → [selalu] klik "🚀 Langsung ke Aktivitas + Materi"
      → MAP_FILE['a']
```

---

## 13. KONVENSI PENAMAAN FILE

| Pola | Contoh | Keterangan |
|---|---|---|
| `materi<mapel>.html` | `materibk.html` | Halaman grid kartu modul |
| `<mapel><nomor>.html` | `bk6.html` | Portal modul |
| `materi<mapel><nomor>.html` | `materibk6.html` | Materi lengkap |
| `aktivitas<mapel><nomor><bagian>.html` | `aktivitasbk6a.html` | Aktivitas per bagian |
| `desain<mapel><nomor>.css` | `desainbk6.css` | CSS global modul |
| `script<mapel>.js` | `scriptbk.js`, `scriptdsi.js`, `scripttik.js` | JS global aktivitas |

---

## 14. BREADCRUMB.JSON — FORMAT

```json
{
  "": [],
  "login": [{"label": "Beranda", "href": ""}, {"label": "Login"}],
  "daftar": [{"label": "Beranda", "href": ""}, {"label": "Daftar"}],
  "daftarguru": [{"label": "Beranda", "href": ""}, {"label": "Daftar Guru"}],
  "bk/bk6": [
    {"label": "Beranda", "href": ""},
    {"label": "Berpikir Komputasional", "href": "bk/materibk"},
    {"label": "Tumpukan (Stack)"}
  ],
  "bk/bk7": [
    {"label": "Beranda", "href": ""},
    {"label": "Berpikir Komputasional", "href": "bk/materibk"},
    {"label": "Pohon & Jaringan"}
  ]
}
```

**Catatan v3.7:** Portal TIK2, TIK3, TIK4 memakai breadcrumb **statis** di HTML (bukan dari JSON) karena file ada di subfolder `tik/` dan DUTA_ROOT di-set eksplisit.

---

## 15. DASHBOARD GURU — FITUR

### 15.1 Halaman `dashboard/guru.html`
- Cek session `ambilSessionGuru()`.
- Muat via `dutaGetAllProgress()`.
- Filter, Sort, Pagination.
- Aksi baris: **hanya 🔓 Unlock**.
- Bulk action: hapus tamu massal.
- Export CSV, Backup/Restore JSON.
- **Auto-refresh:** checkbox 60 detik.
- **Tombol "👥 Lihat Data Siswa"** di header.

### 15.2 Modal "👥 Lihat Data Siswa"
- Filter kelas (dropdown dari `listKelasGuru`).
- Tombol Ambil (`listSiswaGuru`).
- Tabel siswa: Nama | Username | Kelas | Aksi.
- Aksi per siswa: 👁️ (getPasswordSiswa), 🔑 (updateSiswa ganti password), ✏️ (updateSiswa edit nama+kelas).

---

## 16. DASHBOARD SISWA — FITUR

### 16.1 Halaman `dashboard/siswa.html`
- Cek session `duta_siswa_dash` / `ambilSession()`.
- Muat via `getProgressSiswaDetail` (JOIN Users + Progress).
- **Baris utama:** user login (👤).
- **Baris teman:** user di `duta_identitas_siswa.teman` (👥), tanda "teman belajar".
- Filter modul.
- Stats dari user utama.
- ⚠️ **Catatan Bug (v3.5):** Proteksi URL (tendang tamu/belum login) sempat di-*rollback* ke versi awal, sehingga saat ini **tamu bisa mengakses via URL langsung**. Perlu dipatch ulang (lihat §20).

---

## 17. DAFTAR UJIAN & FORM DAFTAR

### 17.1 Daftar Ujian
- Muat via `listUjian`, render kartu, modal token → `verifyToken` → redirect.

### 17.2 Pendaftaran Siswa (`daftar.html` v3.5)
- **Sekolah:** `<select>` dropdown dari `listSekolahGuru` (**tidak bisa ketik manual**).
- **Kelas:** 2 dropdown (Angka 7/8/9 + Huruf —/A-G).
- **FAB Guru:** Tombol melayang 👨‍🏫 kanan bawah → `daftarguru.html`.
- Rate limit: max 3 akun / 5 menit.
- Modal sukses: kartu kredensial + tombol salin.

### 17.3 Pendaftaran Guru (`daftarguru.html` v3.5)
- **Form:** Username, Nama, Sekolah (Datalist), Kontak WA, Password (min 6).
- **Normalisasi:** Nama Title Case, Sekolah UPPERCASE, Kontak `08` → `628`.
- **Modal Sukses:** Menampilkan status "tunggu" + Tombol WhatsApp ke Admin (`wa.me/6285222250973`).
- **FAB Siswa:** Tombol melayang 🎓 kanan bawah → `daftar.html`.

---

## 18. NILAI & BOBOT

**Rumus Nilai Akhir (frontend & backend):**
```
nilai_akhir = round(rata_skor_aktivitas × 0.5 + skor_kuis × 0.5)
```
- Skor bagian/kuis = `round(40 + (benar/total) × 60)` → range 40-100.
- Bobot: 50% : 50%.
- Ambang Lulus Tes: 3/4. Ambang Kuis: 7/10.
- Level Sertifikat: 10=Emas, 9=Perak, 8=Perunggu, 7=Dasar.

**⚠️ Rata-rata hanya dari `totalBagianAktif`** (bukan semua kolom a–f):
```
rata = sum(skor[b] untuk b di totalBagianAktif) / len(totalBagianAktif)
```

---

## 19. TIPS & CATATAN PENTING

### 19.1 Jangan Lupa
- `<header id="header-utama">` + `<footer id="footer-utama">`.
- `<script src="../script.js">` — wajib.
- File `a` wajib punya `#infoIdentitasBox` + `mulaiAktivitas()` + `dutaSimpanProgressBulk` di `onLulus`.
- File `d` (kuis) wajib punya `#infoIdentitasBox` (untuk sertifikat) + `dutaSimpanProgressBulk` dengan `kunciModul: true` + `totalBagianAktif`.
- File `b/c/...` (tengah) **tidak boleh** punya form identitas — langsung simulasi.
- `DUTA_TIK.init({...})` / `DUTA_DSI.init({...})` / `DUTA_BK.init({...})` di DOMContentLoaded.
- **Semua konstanta** yang dipakai `init()` harus dideklarasikan **sebelum** init.
- **File kuis akhir** wajib kirim `totalBagianAktif: [...]` (tanpa bagian kuis).
- **File di subfolder (`tik/`, `dsi/`, `bk/`)** wajib set `window.DUTA_ROOT = '../';` **sebelum** `script.js`? Tidak — sesudah `script.js` juga boleh, karena DUTA_ROOT dibaca saat DOMContentLoaded. **Namun** lebih aman **sebelum** karena `renderHeader` dipanggil saat DOMContentLoaded (jadi DUTA_ROOT sudah di-set). **Catatan:** di `tik2.html`/`tik3.html`/`tik4.html`, DUTA_ROOT di-set **sesudah** `script.js` — ini berfungsi karena `renderHeader` baru jalan saat DOMContentLoaded.

### 19.2 Kesalahan Umum & Solusi

| Masalah | Solusi |
|---|---|
| Breadcrumb kosong | Cek key di `breadcrumb.json` match path. |
| Nilai tidak masuk | Cek `dutaSimpanProgressBulk` payload & `Code.gs` deploy ulang. |
| Guru tidak bisa login (padahal password benar) | Cek kolom `status` di sheet Guru. Harus `disetujui`. |
| Siswa gagal daftar (Sekolah belum terdaftar) | Pastikan guru dengan sekolah tersebut sudah daftar & disetujui. |
| **Nilai akhir 75 padahal semua 100** | ⚠️ **Fix v3.6**: kirim `totalBagianAktif: [...]` (tanpa kuis). Jalankan `recomputeNilaiAkhirSemua()` untuk data lama. |
| **Tamu bisa akses `dashboard/siswa` via URL** | ⚠️ **Bug ditunda.** Perlu patch JS agar langsung `window.location.href = '../login'` jika tipe bukan 'login'. |
| **`Unexpected token '<'` saat login** | Deploy `Code.gs` belum selesai. Tunggu ~10 detik. |
| **Modal Lihat Data Siswa kosong** | Pastikan `Code.gs` v3.5 sudah deploy ulang. |
| **`X is not defined` saat pilih level** | Pastikan `kuisKilatData`, `soalTesData`, `tantanganDasar/Reguler/Bonus` dideklarasikan **sebelum** `DUTA_TIK.init()`. |
| **`nilai_akhir` salah untuk modul baru** | Pastikan `totalBagianAktif` di file kuis akhir sesuai (semua bagian kecuali kuis). |
| **`Identifier 'offsetX' has already been declared`** | ⚠️ **Fix v3.7**: deklarasi `let offsetX = 0; let offsetY = 0;` di awal fungsi, **assign** di dalam blok (jangan `const` ulang). Lihat §9.4. |
| **`mulaiAktivitas is not defined`** | Penyebab: IIFE gagal parse karena SyntaxError. Cek console untuk error pertama — biasanya bug `offsetX` di atas. |

### 19.3 Saat Menambah Modul Baru
1. Siapkan file (folder, materi, aktivitas, css, js).
2. Tambahkan entri di `breadcrumb.json` (atau breadcrumb statis).
3. Terapkan pola:
   - File **a** → form identitas + `mulaiAktivitas()`.
   - File **b/c/...** → **tanpa** form identitas, langsung `#area-simulasi.active`.
   - File **akhir** → form identitas (sertifikat) + `dutaSimpanProgressBulk` dengan `kunciModul: true` + `totalBagianAktif`.
4. Cek `TOTAL_BAGIAN`, `NAMA_SHEET`, `MODUL_KEY`, `totalBagianAktif`.
5. Di file kuis akhir:
   ```js
   const TOTAL_BAGIAN = ['a', 'b', 'c', 'd'];   // semua halaman
   const BAGIAN_KUIS = 'd';                      // bagian kuis
   const TOTAL_BAGIAN_AKTIVITAS = TOTAL_BAGIAN.filter(b => b !== BAGIAN_KUIS);
   // ...
   dutaSimpanProgressBulk(MODUL_KEY, BAGIAN_KUIS, {kuis: skorKuis}, 0,
     { kunciModul: true, totalBagianAktif: TOTAL_BAGIAN_AKTIVITAS });
   ```
6. **Backend & `script.js` TIDAK perlu diubah** — sudah generik untuk semua modul.
7. **Portal modul** — pakai pola modal "Mulai Belajar" (lihat §19.6).

### 19.4 Saat Mengubah Backend
- Deploy ulang **Code.gs** (Manage deployments → New version) → tunggu ~10 detik.
- Jangan ubah urutan header sheet yang sudah ada data. Tambah kolom baru di akhir.
- `restoreBackup` bersifat overwrite — hati-hati.
- `registerGuru` mengecek dua sheet (`Users` & `Guru`). `register` memvalidasi sekolah.
- **`recomputeNilaiAkhirSemua()`** — jalankan manual di editor jika ada bug nilai historis. Sesuaikan `PETA_BAGIAN` untuk modul baru.

### 19.5 Cache & Deploy
- Hard reload (`Ctrl+Shift+R`) setiap kali ubah `script.js` / `.css` / `.html`.
- Deploy ulang `Code.gs` setiap ubah backend.

### 19.6 PWA — Progressive Web App (v1.0.0)

**File PWA:**
| File | Fungsi |
|------|--------|
| `manifest.json` | Web App Manifest — nama app, ikon, warna tema, display standalone, lang ID |
| `sw.js` | Service Worker — cache aset statis (HTML, CSS, JS, gambar), offline fallback, versi.json tidak dicache |
| `versi.json` | Berisi `versi`, `daftarFile`, dan `pesanUpdate` untuk deteksi update aplikasi |

**Cara Kerja Notifikasi Update:**
1. Setiap halaman yang memuat `script.js` akan fetch `versi.json` (bypass cache SW)
2. Bandingkan `versi` di `versi.json` dengan `localStorage['duta_versi_terpasang']`
3. Jika berbeda → tampilkan popup: "Ada Update Fitur dan Perbaikan, update sekarang"
4. User klik **Update** → `reg.update()` + `location.reload(true)` → halaman dimuat ulang (kesamaannya dengan hard refresh)
5. `localStorage['duta_versi_terpasang']` diupdate, notifikasi tidak muncul lagi sampai versi berikutnya

**Cara Kerja PWA-Only Access:**
- `manifest.json` dan Service Worker didaftarkan pada semua halaman sebelum pemeriksaan mode aplikasi. Ini memungkinkan browser menilai kelayakan instalasi saat situs dibuka.
- Aplikasi terpasang dikenali melalui `display-mode: standalone`, `display-mode: window-controls-overlay`, atau `navigator.standalone` (iOS).
- Jika belum berjalan sebagai aplikasi terpasang, overlay PWA-only muncul dan konten disembunyikan.
- Pengguna wajib install PWA terlebih dahulu untuk mengakses portal
- Jika PWA di-uninstall dan diakses ulang via browser biasa → overlay PWA-only akan muncul lagi (deteksi ulang setiap page load)
- Tombol **Instal Aplikasi InformatikaDuta** selalu tersedia. Browser yang mendukung `beforeinstallprompt` membuka dialog instalasi; jika tidak, tombol menampilkan petunjuk manual sesuai platform.
- `appinstalled` menandai instalasi selesai dan memuat ulang halaman ke mode aplikasi.
- Petunjuk: Windows/Chromebook gunakan Chrome atau Edge dan pilih opsi/ikon instalasi; Android gunakan menu Chrome; iPhone/iPad buka di Safari, pilih **Bagikan → Tambahkan ke Layar Utama**.
- Tombol "Buka di Browser Lain" saat ini hanya menutup overlay dan melewati pembatasan PWA-only pada halaman tersebut; tombol ini tidak membuka aplikasi browser lain.
- Instalasi memerlukan origin aman (HTTPS; `localhost` untuk pengembangan) dan browser yang mendukung PWA. Dialog instalasi otomatis tidak tersedia di semua browser/perangkat; iOS menggunakan langkah manual di Safari.

**Auto Logout:** 60 menit (`BATAS_SESI_MENIT = 60` di `script.js`)

**Cara Deploy Update:**
- Ubah `versi` di `versi.json` (misal `1.0.0` → `1.0.1`)
- Pengguka akan melihat popup notifikasi update saat membuka halaman

**Ikon PWA:** `informatikaduta-192.png` dan `informatikaduta-512.png` di root folder.

### 19.7 ⚠️ ATURAN ASESMEN DIAGNOSTIK & PORTAL MODAL (v3.7)

**Berlaku untuk SEMUA modul:** BK6, BK7, DSI1, DSI2, TIK2, TIK3, TIK4, dan modul-modul berikutnya.

**Struktur modal "Materi + Aktivitas":**
1. Judul + **Pertanyaan Pemantik** (dari dokumen materi).
2. Tombol **🔍 Tes Asesmen Diagnostik** → toggle spoiler berisi 5 soal + tombol "Cek Hasil Rekomendasi".
3. Tombol **▶️ Lanjutkan dari Bagian X** (dinamis, dari `dutaAmbilProgress`).
   Jika `status_modul === 'selesai'` → ganti jadi **🔄 Ulangi Modul Ini** + modal peringatan (nilai tidak berubah).
4. Tombol **🚀 Langsung ke Aktivitas + Materi** (link ke `aktivitas<modul>a`).
5. Jika belum login/tamu → tombol Lanjut/Ulangi **disembunyikan**, tampil pesan "Login dulu".

**Aturan asesmen diagnostik:**
- 5 soal pilihan A/B/C, **semua wajib dijawab** sebelum tombol "Cek Hasil" aktif.
- Skor mayoritas: A → Dasar, B → Reguler, C → Tantangan.
- **Tie-break:** jika dua/lebih level punya jumlah suara tertinggi yang sama, pilih **level TERENDAH** (Dasar < Reguler < Tantangan).
- Hasil = **rekomendasi saja**, disimpan di `localStorage.<modulKey>_rekomendasi_level`.
- Siswa tetap bisa memilih level sendiri saat aktivitas dimulai.

**Map bagian per modul:**

| Modul | Urutan Bagian | Bagian Kuis | Aksen Warna |
|-------|---------------|-------------|-------------|
| BK6 | a, b, c, d | d | Hijau `#6ecb8f` |
| BK7 | a, b, c, d | d | Biru-ungu `#5c7cfa` → `#8a4bbf` |
| DSI1 | a, b, c, d, e | e | Ungu `#b07be0` |
| DSI2 | a, b, c, d | d | Ungu `#b07be0` |
| TIK2 | a, b, c, d, e, f | f | Oranye `#ff8a5b` |
| TIK3 | a, b, c, d | d | Cyan-teal `#4fb0c6` |
| TIK4 | a, b, c, d | d | Oranye `#ff8a5b` |

**Subfolder & DUTA_ROOT:**
- File di `tik/`, `dsi/`, `bk/` — set `window.DUTA_ROOT = '../';` setelah `<script src="../script.js">`.
- Breadcrumb: **statis di HTML** (bukan dari JSON) untuk file di subfolder.

**Tombol di portal:**
- **"Materi Lengkap"** → link biasa ke `materi<modul>.html` (tanpa modal).
- **"Materi + Aktivitas"** → **membuka modal** (`id="btnBukaModalMulai"`).

### 19.8 Catatan Konsistensi Portal dan Aktivitas

Berikut pola yang saat ini berbeda dan perlu dipertimbangkan saat migrasi/penyuntingan:

| Cakupan | Halaman | Pola saat ini |
|---------|---------|---------------|
| Portal lama | `bk/bk2.html`–`bk/bk5.html`, `jki/jki1.html`–`jki/jki3.html`, `tik/tik1.html` | Tombol Materi + Aktivitas membuka bagian pertama langsung; belum memakai modal asesmen diagnostik dan progress seperti portal BK6/BK7, DSI1/DSI2, TIK2–TIK4. |
| Aktivitas lama | `bk/aktivitasbk2*.html`–`aktivitasbk5*.html`, `jki/aktivitasjki*.html`, `tik/aktivitastik1*.html` | Polanya belum seragam. Sebagian halaman masih memakai form/identitas lokal dan metode simpan progress yang berbeda; belum memakai pola `dutaSimpanProgressBulk` yang seragam seperti modul baru. |
| Aktivitas baru | BK6/BK7, DSI1/DSI2, TIK2/TIK3/TIK4 | Pola identitas dan progress sudah seragam: halaman pertama dan kuis akhir menampilkan identitas; bagian tengah langsung ke aktivitas; progress memakai `dutaSimpanProgressBulk`. Simulasi dan tampilan tetap khusus per modul. |

**Peta file TIK3 yang berlaku:** `a`–`c` adalah aktivitas belajar, `d` adalah kuis akhir & sertifikat. Portal dan peta progress harus menggunakan urutan `['a','b','c','d']`; jangan menautkan ke `aktivitastik3e.html` atau `aktivitastik3f.html` karena file tersebut tidak tersedia.

---

## 20. FILE SAMPEL YANG WAJIB DILAMPIRKAN SAAT PINDAH CHAT

Minimal lampirkan **10 file** ini:

| # | File | Fungsi |
|---|---|---|
| 1 | **CATATAN_KONFIGURASI.md** (dokumen ini) | Peta proyek |
| 2 | **script.js** | JS global v3.4 |
| 3 | **desain.css** | CSS global |
| 4 | **Code.gs** | Backend v3.6 |
| 5 | **scriptbk.js** | JS global aktivitas BK |
| 6 | **desainbk7.css** | CSS modul BK7 (contoh CSS mandiri) |
| 7 | **bk7.html** | Portal BK7 (contoh modal asesmen) |
| 8 | **aktivitasbk7a.html** | Contoh file a (dengan identitas) |
| 9 | **aktivitasbk7c.html** | Contoh file tengah (tanpa identitas) |
| 10 | **aktivitasbk7d.html** | Contoh file kuis (dengan identitas + kunciModul) |

**Opsional:**
- `index.html`, `daftar.html`, `siswa.html`, `404.html`.
- `breadcrumb.json`.
- `materibk7.html` (contoh materi).
- `tik2.html` / `tik3.html` / `tik4.html` (contoh portal subfolder).
- `dsi1.html` / `dsi2.html`.
- `login.html` + `guru.html` + `daftarguru.html`.

---

## 21. QUICK REFERENCE — FUNGSI PALING SERING DIPAKAI

```js
// Session
window.ambilSession()           // {user_id, nama, kelas, sekolah, tipe}
window.ambilSessionGuru()       // {username, nama, sekolah, password}
window.hapusSession()
window.hapusSessionGuru()

// Identitas Multi-User
window.ambilIdentitasSiswaMulti()
window.simpanIdentitasSiswaMulti(obj)
window.ambilUserIdsUntukProgress()
window.bukaModalIdentitas()

// API Global
window.dutaFetch(payload)
window.dutaLogin(u,p)
window.dutaLoginGuru(u,p)
window.dutaDaftar(...)
window.dutaCekUser(u)

// Progress
window.dutaSimpanProgress(modul, bagian, skor, nilaiAkhir, {kunciModul, totalBagianAktif})
window.dutaSimpanProgressBulk(modul, bagian, skor, nilaiAkhir, {kunciModul, totalBagianAktif})
window.dutaAmbilProgress(modul)

// Guru
window.dutaFetch({action:'listKelasGuru', ...})
window.dutaFetch({action:'listSiswaGuru', ...})
window.dutaFetch({action:'getPasswordSiswa', ...})
window.dutaFetch({action:'registerGuru', ...})
window.dutaFetch({action:'listSekolahGuru'})
```

---

## 22. RECIPE — TAMBAH MODUL BARU (TIK5, DSI3, dst.)

### Langkah 1: File CSS
Buat `desain<modul>.css` baru (self-contained), copy pola dari `desainbk7.css` atau `desaintik4.css`, sesuaikan aksen warna.

### Langkah 2: File Aktivitas
- **File a** (form identitas + `mulaiAktivitas()`): copy pola `aktivitasbk7a.html`, ubah `NAMA_SHEET`, `MODUL_KEY`, `TOTAL_BAGIAN`, `STATE_KEY`.
- **File b/c/...** (tanpa form identitas): copy pola `aktivitasbk7c.html`, ubah konstanta & simulasi.
- **File akhir** (kuis + sertifikat): copy pola `aktivitasbk7d.html`, ubah `BAGIAN_KUIS`, `TOTAL_BAGIAN_AKTIVITAS`, 10 soal.

### Langkah 3: File Kuis Akhir (WAJIB)
```js
const TOTAL_BAGIAN = ['a', 'b', 'c', 'd', 'e'];        // semua halaman
const BAGIAN_KUIS = 'e';
const TOTAL_BAGIAN_AKTIVITAS = TOTAL_BAGIAN.filter(b => b !== BAGIAN_KUIS);

// Di simpanNilaiKuis():
const hasil = await window.dutaSimpanProgressBulk(
  MODUL_KEY, BAGIAN_KUIS, { kuis: skorKuis }, 0,
  { kunciModul: true, totalBagianAktif: TOTAL_BAGIAN_AKTIVITAS }
);
```

### Langkah 4: Portal Modul (v3.7 — WAJIB)
Copy pola `bk7.html` atau `tik2.html`. Sesuaikan:
- `MODUL_KEY`
- `MAP_FILE` (map bagian → file)
- `URUTAN_BAGIAN`
- `SOAL_ASESMEN` (5 soal khas modul)
- Aksen warna

### Langkah 5: breadcrumb.json (atau breadcrumb statis)
Tambahkan entri untuk path baru.

### Langkah 6: Backend & script.js
**TIDAK PERLU diubah** — sudah generik.

### Langkah 7: (Opsional) Recompute Data Lama
Jika modul baru punya data lama yang salah, tambahkan ke `PETA_BAGIAN` di `recomputeNilaiAkhirSemua()`.

---

**Dokumen ini dibuat berdasarkan analisis kode aktual per 2026-10-29.**
**Simpan sebagai `CATATAN_KONFIGURASI.md` di root proyek.**

---

## 📝 CHANGELOG v3.9 (2026-11-10)

### Revisi Portal TIK3 dan Catatan Konsistensi
- **`tik/tik3.html`**: Peta aktivitas dan urutan progress diubah menjadi a–d; bagian d dikenali sebagai kuis akhir & sertifikat.
- **Catatan konfigurasi**: Peta bagian TIK3 diperbarui; pola portal/aktivitas lama dan baru dicatat di §19.8.
- **BK6**: Keterangan aktivitas mengikuti kondisi aktual; file `aktivitasbk6e.html` sudah dihapus manual.

## 📝 CHANGELOG v3.8 (2026-11-10)

### Perbaikan PWA
- **`script.js`**: Daftarkan manifest dan Service Worker sebelum menampilkan overlay PWA-only agar browser dapat mengevaluasi instalasi.
- **Tombol instal**: Selalu tampil dengan label "Instal Aplikasi InformatikaDuta"; gunakan prompt native jika tersedia atau tampilkan petunjuk manual jika tidak.
- **Kompatibilitas perangkat**: Tambah deteksi mode standalone iOS serta petunjuk instal untuk Windows/Chromebook, Android, dan iPhone/iPad.
- **Status instalasi**: Jangan menganggap aplikasi terinstal hanya karena prompt diterima; gunakan event `appinstalled` dan deteksi mode aplikasi.

## 📝 CHANGELOG v3.7 (2026-10-29)

### Yang Berubah

#### Portal Semua Modul — MODAL ASESMEN SERAGAM
- **`bk6.html`**: Tombol "Materi + Aktivitas" → **modal** dengan pemantik + asesmen + lanjut/ulang + langsung.
- **`bk7.html`**: BARU — portal Pohon & Jaringan dengan modal + asesmen (5 soal khas).
- **`dsi1.html`**: Tombol "Materi + Aktivitas" → **modal** + asesmen (5 soal produktivitas).
- **`dsi2.html`**: Tombol "Materi + Aktivitas" → **modal** + asesmen (5 soal kolaborasi + etika).
- **`tik2.html`**: Tombol "Materi + Aktivitas" → **modal** + asesmen (5 soal surel).
- **`tik3.html`**: Tombol "Materi + Aktivitas" → **modal** + asesmen (5 soal peramban).
- **`tik4.html`**: Tombol "Materi + Aktivitas" → **modal** + asesmen (5 soal folder & file).

#### BK7 — MODUL LENGKAP (BARU)
- `materibk7.html` — Materi Pohon & Jaringan (peta konsep, A–F, 6 referensi).
- `bk7.html` — Portal dengan modal asesmen.
- `desainbk7.css` — CSS mandiri aksen biru-ungu + kelas unik (kanvas, kartu-nama, pembanding-grid).
- `aktivitasbk7a.html` — Pohon (drag-drop silsilah + deteksi siklus).
- `aktivitasbk7b.html` — Jaringan (drag-drop peta jalan + BFS jalur).
- `aktivitasbk7c.html` — Beda keduanya (klasifikasi 8 kartu + alasan).
- `aktivitasbk7d.html` — Kuis akhir + sertifikat.

#### File Aktivitas BK7 — TANPA Form Identitas (b/c)
- `aktivitasbk7a.html` — **DENGAN** `.info-identitas-box` + `mulaiAktivitas()` (file pertama).
- `aktivitasbk7b.html` — **TANPA** form, langsung `#area-simulasi.active`.
- `aktivitasbk7c.html` — **TANPA** form, langsung `#area-simulasi.active`.
- `aktivitasbk7d.html` — **DENGAN** `.info-identitas-box` (untuk sertifikat).

#### Bug Fix BK7a
- **`Identifier 'offsetX' has already been declared`** — deklarasi ganda di `mulaiDrag`. Fix: `let offsetX = 0; let offsetY = 0;` di awal, **assign** (bukan deklarasi ulang) di blok `if`.

#### Aturan Baru (§19.6)
- **Asesmen diagnostik seragam** untuk semua modul: 5 soal, wajib semua, mayoritas A→Dasar/B→Reguler/C→Tantangan, tie-break level terendah.
- **Modal "Mulai Belajar"** standar: pemantik + asesmen + lanjut/ulang + langsung.
- **Sembunyikan tombol lanjut/ulang** jika belum login.
- **Map bagian per modul saat v3.7** (BK: a–d, DSI1: a–e, DSI2: a–d, TIK2/3: a–f, TIK4: a–d; peta TIK3 diperbarui ke a–d di v3.9).
- **Aksen warna per modul** (BK6 hijau, BK7 biru-ungu, DSI ungu, TIK2/4 oranye, TIK3 cyan-teal).
- **File tengah (b/c) tanpa form identitas** — identitas cukup di awal & akhir.

#### PWA (v1.0.0)
- **`manifest.json`**: BARU — Web App Manifest PWA
- **`sw.js`**: BARU — Service Worker (cache aset statis, offline fallback)
- **`versi.json`**: BARU — File versi untuk deteksi update aplikasi
- **`script.js`**: Tambah logika PWA (install prompt, notifikasi update, PWA-only access)
- **`desain.css`**: Tambah styling popup notifikasi update dan overlay PWA-only

### Yang TIDAK Berubah
- `desain.css`, `script.js` (v3.4), `Code.gs` (v3.6).
- `scriptbk.js`, `scriptdsi.js`, `scripttik.js`.
- `desaindsi1.css`, `desaindsi2.css`, `desainbk6.css`, `desaintik3.css`, `desaintik4.css`.
- Struktur sheet Progress, Tamu, Users, LinkUjian.
- Logika Session, User Bar, Modal Identitas.

---

## 📝 CHANGELOG v3.6 (2026-10-28)

### Yang Berubah
- **`Code.gs` v3.6**: Fix `simpanProgressSatuUser` — hitung `nilai_akhir` dari `totalBagianAktif` (bukan 6 kolom hardcoded). Util `recomputeNilaiAkhirSemua()`.
- **`script.js` v3.4**: `dutaSimpanProgress` & `dutaSimpanProgressBulk` teruskan `totalBagianAktif`.
- **`aktivitastik4d.html`**: Tambah `totalBagianAktif: ['a','b','c']`.
- **`desaintik4.css`**: BARU — CSS mandiri TIK4.
- **TIK4a/b/c/d**: MIGRASI — form identitas → `#infoIdentitasBox`, bulk progress.

---

## 📝 CHANGELOG v3.5 (2026-10-25)

### Yang Berubah
- **`Code.gs` v3.5**: Header Sheet Guru baru, endpoint `registerGuru`, `listSekolahGuru`, `getProgressSiswaDetail`.
- **`login.html` v3.4**: Dropdown Login Sebagai + form Tamu.
- **`daftarguru.html` v3.5 BARU**: Form pendaftaran guru + WA admin.
- **`daftar.html` v3.5**: Dropdown sekolah + kelas 2 kolom + FAB guru.
- **`dashboard/guru.html` v3.4**: Tombol "👥 Lihat Data Siswa" + modal.
- **`dashboard/siswa.html` v3.4**: JOIN Progress + Users.

---

## 📝 CHANGELOG v3.4 (2026-10-25)

### Yang Berubah
- **`login.html` v3.4**: Dropdown login, form tamu.
- **`Code.gs` v3.2**: `listKelasGuru`, `listSiswaGuru`, `getPasswordSiswa`, `getProgressSiswaDetail`.
- **`guru.html`**: Modal Lihat Data Siswa.
- **`siswa.html`**: Dashboard baru.
- **`daftar.html`**: Datalist sekolah, Dropdown kelas.

---

**Dokumen ini dibuat berdasarkan analisis kode aktual per 2026-10-29.**
**Simpan sebagai `CATATAN_KONFIGURASI.md` di root proyek.**
```

## 🎯 Ringkasan Perubahan Utama v3.7

| Area | Sebelum (v3.6) | Sesudah (v3.7) |
|------|----------------|----------------|
| **Portal BK6** | Tombol link langsung | **Modal** dengan asesmen + lanjut |
| **Portal BK7** | Belum ada | **BARU** — modal + asesmen + materi + 4 aktivitas |
| **Portal DSI1/DSI2** | Tombol link langsung | **Modal** + asesmen |
| **Portal TIK2/TIK3/TIK4** | Tombol link langsung | **Modal** + asesmen |
| **File tengah (b/c)** | Ada form identitas lokal | **TANPA** form — langsung simulasi |
| **Aturan asesmen** | Belum ada | **Seragam** untuk semua modul (§19.6) |
| **Bug `offsetX`** | Sering error di drag-drop | **Fixed** (§9.4) |
| **Map bagian per modul** | Tidak terdokumentasi | **Terdokumentasi** (§19.6) |
| **Aksen warna per modul** | Tidak terdokumentasi | **Terdokumentasi** (§19.6) |
| **File sampel untuk chat baru** | 10 file | **10 file** (diperbarui) |

### Status Modul

| Modul | Portal | Materi | CSS | Aktivitas | Kuis |
|-------|--------|--------|-----|-----------|------|
| **BK6** | ✅ (v3.7 modal) | ✅ | ✅ | ✅ a–d | ✅ |
| **BK7** | ✅ (BARU) | ✅ (BARU) | ✅ (BARU) | ✅ a–d (BARU) | ✅ |
| **DSI1** | ✅ (v3.7 modal) | ✅ | ✅ | ✅ a–e | ✅ |
| **DSI2** | ✅ (v3.7 modal) | ✅ | ✅ | ✅ a–d | ✅ |
| **TIK2** | ✅ (v3.7 modal) | ✅ | ✅ | ✅ a–f | ✅ |
| **TIK3** | ✅ (v3.7 modal) | ✅ | ✅ | ✅ a–d | ✅ |
| **TIK4** | ✅ (v3.7 modal) | ✅ | ✅ | ✅ a–d | ✅ |

**Pola lama yang belum dimigrasikan:** portal BK2–BK5, JKI1–JKI3, TIK1 dan aktivitasnya. Rincian ada di §19.8.

Simpan dokumen ini sebagai `CATATAN_KONFIGURASI.md`. Untuk pindah ke chat baru, lampirkan dokumen ini + 10 file sampel (§20). 🚀