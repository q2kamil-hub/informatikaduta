/* ================================================================
   scripttik.js — modul global Aktivitas TIK (tik1, tik2, tik3, ...)
   Berisi helper, modal Lapis 3, diferensiasi level, kuis kilat,
   tes pemahaman, kirim nilai, feedback guru, dan pemulihan state.
   Dipakai oleh aktivitastik2a.html s/d f.html (dan modul TIK lain).
   Panggil SETELAH script.js:
     <script src="../script.js"></script>
     <script src="scripttik.js"></script>
   encoding: UTF-8
   ================================================================ */

(function () {
  "use strict";

  if (window.DUTA_TIK) return; // hindari dobel

  const D = {};
  window.DUTA_TIK = D;

  // ============================================================
  // 1. KONFIGURASI DEFAULT (bisa ditimpa via init())
  // ============================================================
  D.config = {
    namaSheet: 'tik2',
    modulKey: 'tik2',
    totalBagian: ['a', 'b', 'c', 'd', 'e', 'f'],
    ambangLulus: 3,
    durasiBacaDetik: 12,
    stateKey: 'labtik2_state_a',
    bagianAktif: 'a',        // 'a' | 'b' | 'c' | 'd' | 'e' | 'f'
    fileBerikutnya: '',      // mis. 'aktivitastik2b'
    fileSebelumnya: ''       // mis. 'aktivitastik2a'
  };

  // ============================================================
  // 2. STATE INTERNAL
  // ============================================================
  const S = {
    levelTantangan: null,
    tantanganSelesai: {},
    jawabanKuisKilat: {},
    kuisKilatSubmitted: false,
    kuisKilatBenar: 0,
    jawabanTes: {},
    tesSubmitted: false,
    tesBenar: 0,
    tesSelesai: false,
    lapis3Dibaca: false,
    aiFeedback: '',
    aiFeedbackLoading: false
  };
  D.state = S;

  // Data yang di-inject via init()
  let kuisKilatData = [];
  let soalTesData = [];
  let tantanganDasar = [];
  let tantanganReguler = [];
  let tantanganBonus = [];

  // Referensi DOM (diisi saat init)
  let E = {};

  // Timer modal Lapis 3
  let modalPenamaanEl = null;
  let bacaTimerInterval = null;
  let bacaCountdown = 0;

  // ============================================================
  // 3. HELPER UMUM
  // ============================================================
  D.escapeHtml = function (s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  D.formatWaktuDetik = function (detik) {
    const m = Math.floor(detik / 60);
    const s = detik % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  };

  D.tampilFeedback = function (type, icon, text) {
    if (!E.feedbackBox) return;
    E.feedbackBox.className = 'feedback-box show ' + type;
    if (E.fbIcon) E.fbIcon.textContent = icon || '💡';
    if (E.fbText) E.fbText.innerHTML = text;
  };

  D.updateProgressLapis = function (step) {
    if (!E.progressLapis) return;
    const steps = ['lapis1', 'lapis2', 'lapis3', 'tes'];
    const targetIdx = steps.indexOf(step);
    if (targetIdx === -1) return;
    E.progressLapis.querySelectorAll('.pl-step').forEach(function (el, i) {
      el.classList.remove('active', 'done');
      if (i < targetIdx) el.classList.add('done');
      else if (i === targetIdx) el.classList.add('active');
    });
  };

  // ============================================================
  // 4. DIFERENSIASI LEVEL
  // ============================================================
  D.pilihLevel = function (level) {
    if (!E.levelOptions) return;
    S.levelTantangan = level;
    if (window.dutaSimpanState) window.dutaSimpanState(D.config.stateKey, D.kumpulkanState(), { force: true });

    E.levelOptions.querySelectorAll('.level-option').forEach(function (el) {
      el.classList.remove('terpilih');
    });
    const elTerpilih = E.levelOptions.querySelector('[data-level="' + level + '"]');
    if (elTerpilih) elTerpilih.classList.add('terpilih');

    let namaLevel = '';
    if (level === 'dasar') namaLevel = '🟢 Dasar';
    else if (level === 'reguler') namaLevel = '🟡 Reguler';
    else if (level === 'tantangan') namaLevel = '🔴 Tantangan';

    if (E.levelBadgeText) E.levelBadgeText.textContent = 'Kamu memilih level: ' + namaLevel;
    if (E.levelBadge) E.levelBadge.classList.add('show');
    if (E.mindfulPilihLevel) E.mindfulPilihLevel.classList.add('show');
    if (E.btnLanjutLapis2) E.btnLanjutLapis2.disabled = false;

    try { localStorage.setItem('labtik2_level', level); } catch (e) {}
  };

  D.lanjutKeLapis2 = function () {
    if (!S.levelTantangan) {
      alert('⚠️ Pilih tingkat tantangan dulu ya!');
      return;
    }
    const jawab = (document.getElementById('mindfulPilihJawab') || {}).value || '';
    if (jawab.trim().length < 3) {
      alert('📝 Tulis dulu alasanmu memilih level ini!');
      const el = document.getElementById('mindfulPilihJawab');
      if (el) el.focus();
      return;
    }
    if (E.areaPilihLevel) E.areaPilihLevel.classList.remove('active');
    if (E.areaLapis2) E.areaLapis2.style.display = 'block';

    D.updateProgressLapis('lapis2');

    let namaLevel = '';
    if (S.levelTantangan === 'dasar') namaLevel = '🟢 Dasar';
    else if (S.levelTantangan === 'reguler') namaLevel = '🟡 Reguler';
    else namaLevel = '🔴 Tantangan';
    if (E.lapis2LevelLabel) E.lapis2LevelLabel.textContent = namaLevel;
    if (E.lapis2JumlahTantangan) {
      E.lapis2JumlahTantangan.textContent = S.levelTantangan === 'tantangan'
        ? '4 tantangan (3 inti + 1 bonus)'
        : '3 tantangan';
    }

    D.buildTantangan();
    if (window.dutaSimpanState) window.dutaSimpanState(D.config.stateKey, D.kumpulkanState(), { force: true });

    setTimeout(function () {
      if (E.areaLapis2) E.areaLapis2.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  };

  D.buildTantangan = function () {
    if (!E.tantanganList) return;
    E.tantanganList.innerHTML = '';
    S.tantanganSelesai = {};

    let daftar = [];
    if (S.levelTantangan === 'dasar') daftar = tantanganDasar.slice();
    else if (S.levelTantangan === 'reguler') daftar = tantanganReguler.slice();
    else daftar = tantanganReguler.slice().concat(tantanganBonus);

    daftar.forEach(function (t, idx) {
      const isBonus = t.id.charAt(0) === 'B';
      const div = document.createElement('div');
      div.className = 'tantangan-item';
      div.id = 'tantangan_' + t.id;
      div.dataset.id = t.id;
      if (isBonus) {
        div.style.background = 'linear-gradient(135deg, #fff8e6, #ffe8c2)';
        div.style.borderColor = '#d4a030';
      }

      let inputHtml = '';
      if (t.tipe === 'teks') {
        inputHtml =
          '<div class="t-input-row">' +
            '<textarea id="input_' + t.id + '" placeholder="Tulis jawabanmu di sini..." maxlength="600"></textarea>' +
            '<button id="btn_' + t.id + '">Periksa</button>' +
          '</div>';
      } else if (t.tipe === 'pilihan') {
        inputHtml = '<div class="t-opsi-col">';
        t.opsi.forEach(function (o) {
          inputHtml +=
            '<label>' +
              '<input type="radio" name="opsi_' + t.id + '" value="' + o.v + '">' +
              '<span>' + o.label + '</span>' +
            '</label>';
        });
        inputHtml += '</div><div class="t-input-row" style="justify-content:flex-end; margin-top:0.5rem;">' +
          '<button id="btn_' + t.id + '">Periksa</button></div>';
      }

      div.innerHTML =
        '<div class="t-header">' +
          '<span class="t-num">' + (isBonus ? '🔥' : (idx + 1)) + '</span>' +
          '<span>' + (isBonus ? 'Tantangan Bonus' : 'Tantangan ' + (idx + 1)) + '</span>' +
        '</div>' +
        '<div class="t-text">' + t.teks + '</div>' +
        inputHtml +
        '<div class="t-feedback" id="fb_' + t.id + '"></div>';

      E.tantanganList.appendChild(div);

      const btn = document.getElementById('btn_' + t.id);
      if (btn) btn.addEventListener('click', function () { D.periksaTantangan(t); });
    });
  };

  D.periksaTantangan = function (t) {
    const fb = document.getElementById('fb_' + t.id);
    const item = document.getElementById('tantangan_' + t.id);
    if (!fb || !item) return;

    if (t.tipe === 'teks') {
      const inp = document.getElementById('input_' + t.id);
      const val = inp ? inp.value.trim() : '';
      if (!val) {
        fb.className = 't-feedback show hint';
        fb.innerHTML = '⚠️ Tulis jawabanmu dulu ya!';
        return;
      }
      if (val.length < 30) {
        fb.className = 't-feedback show hint';
        fb.innerHTML = '🤔 Jawabanmu terlalu pendek. ' + t.hint;
        return;
      }
      if (t.validasi(val)) {
        fb.className = 't-feedback show ok';
        fb.innerHTML = '✅ <strong>Bagus!</strong> Jawabanmu sudah menyentuh inti masalahnya.';
        item.classList.add('selesai');
        const btn = document.getElementById('btn_' + t.id);
        if (btn) btn.disabled = true;
        S.tantanganSelesai[t.id] = true;
      } else {
        fb.className = 't-feedback show no';
        fb.innerHTML = '❌ ' + t.feedbackSalah + '<br><br>💡 ' + t.hint;
      }
    } else if (t.tipe === 'pilihan') {
      const selected = document.querySelector('input[name="opsi_' + t.id + '"]:checked');
      if (!selected) {
        fb.className = 't-feedback show hint';
        fb.innerHTML = '⚠️ Pilih salah satu jawaban dulu!';
        return;
      }
      const opsi = t.opsi.find(function (o) { return o.v === selected.value; });
      if (opsi && opsi.benar) {
        fb.className = 't-feedback show ok';
        fb.innerHTML = '✅ <strong>Benar!</strong>';
        item.classList.add('selesai');
        const btn = document.getElementById('btn_' + t.id);
        if (btn) btn.disabled = true;
        S.tantanganSelesai[t.id] = true;
      } else {
        fb.className = 't-feedback show no';
        fb.innerHTML = '❌ ' + t.feedbackSalah;
      }
    }

    D.cekSemuaTantangan();
    if (window.dutaSimpanState) window.dutaSimpanState(D.config.stateKey, D.kumpulkanState(), { force: true });
  };

  D.cekSemuaTantangan = function () {
    const items = document.querySelectorAll('.tantangan-item');
    if (items.length === 0) return;
    let semuaSelesai = true;
    items.forEach(function (i) { if (!i.classList.contains('selesai')) semuaSelesai = false; });
    if (semuaSelesai) {
      if (E.mindful2) { E.mindful2.classList.add('show'); E.mindful2.style.display = 'block'; }
      if (E.btnLanjutLapis3) E.btnLanjutLapis3.disabled = false;
      setTimeout(function () {
        if (E.mindful2) E.mindful2.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    }
  };

  // ============================================================
  // 5. MODAL LAPIS 3
  // ============================================================
  D.lanjutKeLapis3 = function () {
    const jawab = (document.getElementById('mindful2Jawab') || {}).value || '';
    if (jawab.trim().length < 3) {
      alert('📝 Isi dulu jawaban Jeda Sadar 2 sebelum lanjut!');
      const el = document.getElementById('mindful2Jawab');
      if (el) el.focus();
      return;
    }

    if (typeof D.onLapis2Selesai === 'function') D.onLapis2Selesai();

    if (E.areaLapis3) E.areaLapis3.style.display = 'block';
    D.updateProgressLapis('lapis3');

    if (E.btnLanjutLapis3) {
      E.btnLanjutLapis3.disabled = true;
      E.btnLanjutLapis3.textContent = '✅ Lapis 2 Selesai';
    }

    if (S.lapis3Dibaca) {
      D.tampilkanKontenLapis3SetelahBaca();
      setTimeout(function () {
        if (E.areaLapis3) E.areaLapis3.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
      return;
    }

    D.tampilkanModalPenamaan();
    if (window.dutaSimpanState) window.dutaSimpanState(D.config.stateKey, D.kumpulkanState(), { force: true });
  };

  D.tampilkanModalPenamaan = function () {
    if (modalPenamaanEl) { modalPenamaanEl.remove(); modalPenamaanEl = null; }
    if (bacaTimerInterval) { clearInterval(bacaTimerInterval); bacaTimerInterval = null; }

    const overlay = document.createElement('div');
    overlay.className = 'duta-penamaan-overlay';
    overlay.id = 'duta-penamaan-modal';

    const penamaanKonten = document.getElementById('penamaanKonten');
    const kontenHTML = penamaanKonten ? penamaanKonten.innerHTML : '<p>Konten penamaan konsep tidak ditemukan.</p>';
    const durasi = D.config.durasiBacaDetik;

    overlay.innerHTML =
      '<div class="duta-penamaan-box" role="dialog" aria-modal="true" aria-labelledby="dutaPenamaanTitle">' +
        '<div class="duta-penamaan-header">' +
          '<span class="dph-icon">📖</span>' +
          '<span id="dutaPenamaanTitle">Lapis 3 — Penamaan Konsep (Baca dulu ya!)</span>' +
        '</div>' +
        '<div class="duta-penamaan-body">' +
          '<div class="penamaan-box">' + kontenHTML + '</div>' +
        '</div>' +
        '<div class="duta-penamaan-footer">' +
          '<button type="button" class="btn-sudah-baca" id="btnSudahBaca" disabled>' +
            '<span class="bsb-progress" id="bsbProgress"></span>' +
            '<span id="bsbLabel">⏳ Baca dulu... (<span id="bsbDetik">' + durasi + '</span>s)</span>' +
          '</button>' +
          '<div class="duta-penamaan-timer" id="dutaPenamaanTimer">' +
            'Tombol aktif setelah ' + durasi + ' detik — supaya kamu benar-benar membaca.' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    modalPenamaanEl = overlay;
    document.body.style.overflow = 'hidden';

    const elBtn = document.getElementById('btnSudahBaca');
    const elProg = document.getElementById('bsbProgress');
    const elLabel = document.getElementById('bsbLabel');
    const elDetik = document.getElementById('bsbDetik');
    const elTimerInfo = document.getElementById('dutaPenamaanTimer');

    bacaCountdown = durasi;
    const totalDetik = durasi;

    requestAnimationFrame(function () {
      if (elProg) elProg.style.width = '0%';
    });

    bacaTimerInterval = setInterval(function () {
      bacaCountdown--;
      if (elDetik) elDetik.textContent = bacaCountdown;
      const persen = Math.round(((totalDetik - bacaCountdown) / totalDetik) * 100);
      if (elProg) elProg.style.width = persen + '%';

      if (bacaCountdown <= 0) {
        clearInterval(bacaTimerInterval);
        bacaTimerInterval = null;
        if (elBtn) { elBtn.disabled = false; elLabel.innerHTML = '✅ Sudah Membaca'; }
        if (elTimerInfo) {
          elTimerInfo.textContent = 'Terima kasih sudah membaca! Klik tombol untuk lanjut.';
          elTimerInfo.style.color = '#2d5a1e';
          elTimerInfo.style.fontWeight = '700';
        }
      }
    }, 1000);

    if (elBtn) {
      elBtn.addEventListener('click', function () {
        if (elBtn.disabled) return;
        S.lapis3Dibaca = true;
        D.tutupModalPenamaan();
        D.tampilkanKontenLapis3SetelahBaca();
        if (window.dutaSimpanState) {
          window.dutaSimpanState(D.config.stateKey, D.kumpulkanState(), { force: true });
        }
        setTimeout(function () {
          const elJeda = document.getElementById('mindful3');
          if (elJeda) elJeda.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      });
    }
  };

  D.tutupModalPenamaan = function () {
    if (bacaTimerInterval) { clearInterval(bacaTimerInterval); bacaTimerInterval = null; }
    if (modalPenamaanEl) { modalPenamaanEl.remove(); modalPenamaanEl = null; }
    document.body.style.overflow = '';
  };

  D.tampilkanKontenLapis3SetelahBaca = function () {
    const elMindful3 = document.getElementById('mindful3');
    if (elMindful3) elMindful3.classList.add('show');

    if (E.kuisKilatContent && !E.kuisKilatContent.dataset.built) {
      D.buildKuisKilat();
      E.kuisKilatContent.dataset.built = '1';
    }
  };

  // ============================================================
  // 6. KUIS KILAT
  // ============================================================
  D.buildKuisKilat = function () {
    if (!E.kuisKilatContent) return;
    E.kuisKilatContent.innerHTML = '';
    if (E.kuisKilatBox) E.kuisKilatBox.classList.add('show');

    kuisKilatData.forEach(function (soal, idx) {
      const div = document.createElement('div');
      div.className = 'kk-soal';
      div.dataset.index = idx;

      let opsiHtml = '';
      soal.opsi.forEach(function (opsi, oi) {
        opsiHtml +=
          '<label id="kk_label_' + idx + '_' + oi + '">' +
            '<input type="radio" name="kk_soal_' + idx + '" value="' + oi + '">' +
            '<span>' + opsi + '</span>' +
            '<span class="check-icon"></span>' +
          '</label>';
      });

      div.innerHTML =
        '<div class="kk-q"><strong>Soal ' + (idx + 1) + '.</strong> ' + soal.pertanyaan + '</div>' +
        '<div class="kk-opsi">' + opsiHtml + '</div>';
      E.kuisKilatContent.appendChild(div);

      div.querySelectorAll('label').forEach(function (lbl, oi) {
        lbl.addEventListener('click', function () {
          if (S.kuisKilatSubmitted) return;
          S.jawabanKuisKilat[idx] = oi;
          div.querySelectorAll('label').forEach(function (l2, oi2) {
            l2.style.background = oi2 === oi ? '#fff5f0' : '#fff';
            l2.style.borderColor = oi2 === oi ? '#ff8a5b' : '#e5dbd0';
            l2.querySelector('input').checked = (oi2 === oi);
          });
          D.cekKuisKilatSiap();
        });
      });
    });
  };

  D.cekKuisKilatSiap = function () {
    if (Object.keys(S.jawabanKuisKilat).length === kuisKilatData.length && !S.kuisKilatSubmitted) {
      setTimeout(function () {
        if (S.kuisKilatSubmitted) return;
        D.submitKuisKilat();
      }, 300);
    }
  };

  D.submitKuisKilat = function () {
    S.kuisKilatSubmitted = true;
    S.kuisKilatBenar = 0;

    kuisKilatData.forEach(function (soal, idx) {
      const selected = S.jawabanKuisKilat[idx];
      const div = E.kuisKilatContent.querySelector('[data-index="' + idx + '"]');
      if (!div) return;
      const labels = div.querySelectorAll('label');
      const benar = (selected === soal.kunci);

      labels.forEach(function (lbl, oi) {
        lbl.classList.add('disabled');
        lbl.querySelector('input').disabled = true;
        if (oi === selected) {
          lbl.classList.add(benar ? 'benar' : 'salah');
          lbl.querySelector('.check-icon').textContent = benar ? '✅' : '❌';
        }
        if (oi === soal.kunci && !benar) {
          lbl.classList.add('benar');
          lbl.querySelector('.check-icon').textContent = '✅';
        }
      });

      if (benar) S.kuisKilatBenar++;
    });

    if (E.kkHasil) {
      E.kkHasil.classList.add('show');
      E.kkHasil.innerHTML = '✅ Kuis Kilat selesai! Kamu benar <strong>' + S.kuisKilatBenar +
        '</strong> dari <strong>' + kuisKilatData.length + '</strong>.';
    }
    if (E.btnLanjutTes) E.btnLanjutTes.disabled = false;
    if (window.dutaSimpanState) window.dutaSimpanState(D.config.stateKey, D.kumpulkanState(), { force: true });
  };

  D.restoreKuisKilat = function () {
    if (!E.kuisKilatContent) return;
    kuisKilatData.forEach(function (soal, idx) {
      const div = E.kuisKilatContent.querySelector('[data-index="' + idx + '"]');
      if (!div) return;
      const labels = div.querySelectorAll('label');
      const selected = S.jawabanKuisKilat[idx];
      if (selected === undefined) return;
      labels.forEach(function (lbl, oi) {
        lbl.classList.add('disabled');
        const input = lbl.querySelector('input');
        if (input) input.disabled = true;
        if (oi === selected) {
          const benar = (selected === soal.kunci);
          lbl.classList.add(benar ? 'benar' : 'salah');
          const ic = lbl.querySelector('.check-icon');
          if (ic) ic.textContent = benar ? '✅' : '❌';
        }
        if (oi === soal.kunci && selected !== soal.kunci) {
          lbl.classList.add('benar');
          const ic = lbl.querySelector('.check-icon');
          if (ic) ic.textContent = '✅';
        }
      });
    });
    if (E.kkHasil) {
      E.kkHasil.classList.add('show');
      E.kkHasil.innerHTML = '✅ Kuis Kilat selesai! Kamu benar <strong>' + S.kuisKilatBenar +
        '</strong> dari <strong>' + kuisKilatData.length + '</strong>.';
    }
    if (E.btnLanjutTes) E.btnLanjutTes.disabled = false;
  };

  // ============================================================
  // 7. TES PEMAHAMAN
  // ============================================================
  D.lanjutKeTesPemahaman = function () {
    const jawab = (document.getElementById('mindful3Jawab') || {}).value || '';
    if (jawab.trim().length < 3) {
      alert('📝 Isi dulu jawaban Jeda Sadar 3 sebelum lanjut!');
      const el = document.getElementById('mindful3Jawab');
      if (el) el.focus();
      return;
    }

    if (E.tesSection) E.tesSection.classList.add('active');
    if (E.refleksiBox) E.refleksiBox.classList.add('show');
    D.renderSoal();
    D.updateTesProgress();

    D.updateProgressLapis('tes');
    if (window.dutaSimpanState) window.dutaSimpanState(D.config.stateKey, D.kumpulkanState(), { force: true });

    setTimeout(function () {
      if (E.tesSection) E.tesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  };

  D.renderSoal = function () {
    if (!E.soalContainer) return;
    E.soalContainer.innerHTML = '';
    soalTesData.forEach(function (soal, idx) {
      const div = document.createElement('div');
      div.className = 'soal-kuis';
      div.dataset.index = idx;

      let opsiHtml = '';
      soal.opsi.forEach(function (opsi, oi) {
        const id = 'soal' + idx + '_opt' + oi;
        opsiHtml +=
          '<label for="' + id + '" onclick="DUTA_TIK.pilihJawabanTes(' + idx + ', ' + oi + ')" id="label_' + idx + '_' + oi + '">' +
            '<input type="radio" name="soal' + idx + '" id="' + id + '" value="' + oi + '">' +
            '<span>' + opsi + '</span>' +
            '<span class="check-icon"></span>' +
          '</label>';
      });

      div.innerHTML =
        '<div class="pertanyaan">' +
          '<span class="soal-num">' + (idx + 1) + '</span>' +
          '<span>' + soal.pertanyaan + '</span>' +
        '</div>' +
        '<div class="opsi-kuis">' + opsiHtml + '</div>' +
        '<div class="jawaban-feedback" id="feedback_soal_' + idx + '"></div>';

      E.soalContainer.appendChild(div);
    });
  };

  D.pilihJawabanTes = function (soalIndex, optIndex) {
    if (S.tesSubmitted) return;
    const soalDiv = document.querySelector('.soal-kuis[data-index="' + soalIndex + '"]');
    if (!soalDiv) return;
    const labels = soalDiv.querySelectorAll('.opsi-kuis label');

    labels.forEach(function (label, idx) {
      label.classList.remove('selected');
      if (idx === optIndex) {
        label.classList.add('selected');
        label.querySelector('input').checked = true;
      } else {
        label.querySelector('input').checked = false;
      }
    });

    S.jawabanTes[soalIndex] = optIndex;
    D.updateTesProgress();
  };

  D.updateTesProgress = function () {
    if (!E.tesProgress) return;
    const total = soalTesData.length;
    const answered = Object.keys(S.jawabanTes).length;
    E.tesProgress.textContent = 'Terjawab: ' + answered + ' / ' + total;
  };

  D.periksaTes = function () {
    if (S.tesSubmitted) return;
    const total = soalTesData.length;
    const answered = Object.keys(S.jawabanTes).length;

    if (answered < total) {
      alert('⚠️ Kamu baru menjawab ' + answered + ' dari ' + total + ' soal. Selesaikan semua soal terlebih dahulu!');
      return;
    }

    let correct = 0;
    soalTesData.forEach(function (soal, idx) {
      if (S.jawabanTes[idx] === soal.kunci) correct++;
    });

    const lulus = correct >= D.config.ambangLulus;
    S.tesBenar = correct;
    S.tesSubmitted = true;

    soalTesData.forEach(function (soal, idx) {
      const selected = S.jawabanTes[idx];
      const soalDiv = document.querySelector('.soal-kuis[data-index="' + idx + '"]');
      if (!soalDiv) return;
      const labels = soalDiv.querySelectorAll('.opsi-kuis label');
      const feedback = document.getElementById('feedback_soal_' + idx);
      const isThisCorrect = (selected === soal.kunci);

      labels.forEach(function (label, oi) {
        label.classList.add('disabled');
        label.querySelector('input').disabled = true;

        if (oi === selected) {
          if (isThisCorrect) {
            label.classList.add('correct-answer');
            label.querySelector('.check-icon').textContent = '✅';
          } else {
            label.classList.add('wrong-answer');
            label.querySelector('.check-icon').textContent = '❌';
          }
        }
        if (lulus && oi === soal.kunci && !isThisCorrect) {
          label.classList.add('correct-answer');
          label.querySelector('.check-icon').textContent = '✅';
        }
      });

      if (isThisCorrect) {
        soalDiv.classList.add('correct');
        if (feedback) {
          feedback.className = 'jawaban-feedback benar';
          feedback.innerHTML = '✅ <strong>Benar!</strong>';
        }
      } else {
        soalDiv.classList.add('wrong');
        if (feedback) {
          feedback.className = 'jawaban-feedback salah';
          if (lulus) {
            feedback.innerHTML = '❌ <strong>Kurang tepat.</strong> Jawaban benar: <span class="kunci">' +
              soal.opsi[soal.kunci] + '</span><br>' + soal.penjelasan;
          } else {
            feedback.innerHTML = '❌ <strong>Kurang tepat.</strong> Coba baca kembali materi dan pikirkan jawaban yang benar.';
          }
        }
      }
    });

    if (E.btnPeriksaTes) {
      E.btnPeriksaTes.disabled = true;
      E.btnPeriksaTes.textContent = correct === total ? '✅ Semua Benar!' : '📊 Skor: ' + correct + '/' + total;
    }

    if (window.dutaSimpanState) window.dutaSimpanState(D.config.stateKey, D.kumpulkanState(), { force: true });

    D.tampilkanHasilTes(correct, total, lulus);
  };

  D.tampilkanHasilTes = function (correct, total, lulus) {
    if (!E.hasilTes) return;
    setTimeout(function () {
      E.hasilTes.classList.add('show');

      if (lulus) {
        S.tesSelesai = true;
        const icon = E.hasilTes.querySelector('#hasilIcon');
        const title = E.hasilTes.querySelector('#hasilTitle');
        const skor = E.hasilTes.querySelector('#hasilSkor');
        const desc = E.hasilTes.querySelector('#hasilDesc');
        if (icon) icon.textContent = '🏆';
        if (title) title.textContent = 'Selamat!';
        if (skor) skor.textContent = correct + ' / ' + total;
        if (desc) {
          desc.innerHTML = 'Kamu berhasil menyelesaikan bagian ini!<br><br>' +
            (D.config.fileBerikutnya ? 'Bagian berikutnya sekarang terbuka!' : 'Kuis Akhir sekarang terbuka!');
        }

        if (E.btnLanjutBagian) {
          E.btnLanjutBagian.classList.remove('locked');
          E.btnLanjutBagian.classList.add('primary');
        }
        if (E.hintLanjut) {
          E.hintLanjut.classList.remove('locked', 'warn');
          E.hintLanjut.classList.add('ready');
          E.hintLanjut.textContent = '✅ Bagian berikutnya sudah terbuka! Klik untuk melanjutkan.';
        }
        if (E.btnUlangiTes) E.btnUlangiTes.classList.remove('show');

        if (typeof D.onLulus === 'function') D.onLulus(correct, total);
      } else {
        const icon = E.hasilTes.querySelector('#hasilIcon');
        const title = E.hasilTes.querySelector('#hasilTitle');
        const skor = E.hasilTes.querySelector('#hasilSkor');
        const desc = E.hasilTes.querySelector('#hasilDesc');
        if (icon) icon.textContent = '📖';
        if (title) title.textContent = 'Perlu Belajar Lagi';
        if (skor) skor.textContent = correct + ' / ' + total;
        if (desc) {
          desc.innerHTML = 'Kamu baru menjawab benar ' + correct + ' dari ' + total + ' soal.<br>' +
            'Minimal ' + D.config.ambangLulus + ' soal benar untuk membuka bagian berikutnya.<br><br>' +
            'Pelajari kembali materinya, lalu klik <strong>🔄 Ulangi Tes Pemahaman</strong> di bawah.';
        }

        if (E.btnUlangiTes) E.btnUlangiTes.classList.add('show');
        if (E.hintLanjut) {
          E.hintLanjut.classList.remove('ready');
          E.hintLanjut.classList.add('warn');
          E.hintLanjut.textContent = '⚠️ Belum lulus — klik "Ulangi Tes Pemahaman" untuk mencoba lagi.';
        }
      }

      setTimeout(function () {
        E.hasilTes.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }, 700);
  };

  D.restoreTes = function () {
    soalTesData.forEach(function (soal, idx) {
      const selected = S.jawabanTes[idx];
      const soalDiv = document.querySelector('.soal-kuis[data-index="' + idx + '"]');
      if (!soalDiv || selected === undefined) return;
      const labels = soalDiv.querySelectorAll('.opsi-kuis label');
      const isCorrect = (selected === soal.kunci);
      labels.forEach(function (label, oi) {
        label.classList.add('disabled');
        const inp = label.querySelector('input');
        if (inp) inp.disabled = true;
        if (oi === selected) {
          label.classList.add(isCorrect ? 'correct-answer' : 'wrong-answer');
          const ic = label.querySelector('.check-icon');
          if (ic) ic.textContent = isCorrect ? '✅' : '❌';
        }
        if (isCorrect && oi === soal.kunci) {
          label.classList.add('correct-answer');
          const ic = label.querySelector('.check-icon');
          if (ic) ic.textContent = '✅';
        }
      });
      const feedback = document.getElementById('feedback_soal_' + idx);
      if (isCorrect) {
        soalDiv.classList.add('correct');
        if (feedback) {
          feedback.className = 'jawaban-feedback benar';
          feedback.innerHTML = '✅ <strong>Benar!</strong>';
        }
      } else {
        soalDiv.classList.add('wrong');
        if (feedback) {
          feedback.className = 'jawaban-feedback salah';
          feedback.innerHTML = '❌ <strong>Kurang tepat.</strong> Jawaban benar: <span class="kunci">' +
            soal.opsi[soal.kunci] + '</span><br>' + soal.penjelasan;
        }
      }
    });
    if (E.btnPeriksaTes) {
      E.btnPeriksaTes.disabled = true;
      E.btnPeriksaTes.textContent = '📊 Skor: ' + S.tesBenar + '/' + soalTesData.length;
    }
    D.tampilkanHasilTes(S.tesBenar, soalTesData.length, S.tesBenar >= D.config.ambangLulus);
  };

  D.ulangiTes = function () {
    S.jawabanTes = {};
    S.tesSubmitted = false;
    S.tesBenar = 0;
    S.tesSelesai = false;

    if (E.btnPeriksaTes) {
      E.btnPeriksaTes.disabled = false;
      E.btnPeriksaTes.textContent = '✅ Periksa Jawaban';
    }
    if (E.btnUlangiTes) E.btnUlangiTes.classList.remove('show');
    if (E.hasilTes) E.hasilTes.classList.remove('show');
    if (E.hintLanjut) {
      E.hintLanjut.classList.remove('ready', 'warn');
      E.hintLanjut.classList.add('locked');
      E.hintLanjut.textContent = '🔒 Selesaikan semua tahap untuk membuka bagian berikutnya';
    }

    D.renderSoal();
    D.updateTesProgress();
    if (E.tesSection) E.tesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ============================================================
  // 8. KIRIM NILAI BAGIAN
  // ============================================================
  let kirimTimeoutId = null;

  D.kirimNilaiBagian = async function () {
    const bagian = D.config.bagianAktif;
    const skor = Math.round(40 + (S.tesBenar / soalTesData.length) * 60);
    if (E.statusKirim) E.statusKirim.className = 'status-kirim info show';
    if (E.statusSpinner) E.statusSpinner.style.display = 'inline-block';
    if (E.statusKirimText) E.statusKirimText.innerHTML = 'Mengirim nilai bagian ini (' + skor + ')...';

    const oldRetry = E.statusKirim ? E.statusKirim.querySelector('.btn-retry') : null;
    if (oldRetry) oldRetry.remove();

    if (kirimTimeoutId) { clearTimeout(kirimTimeoutId); kirimTimeoutId = null; }
    let selesaiKirim = false;

    kirimTimeoutId = setTimeout(function () {
      if (selesaiKirim) return;
      selesaiKirim = true;
      D.tampilkanGagalKirim(skor, '⏱️ Koneksi lambat atau terputus.');
    }, 12000);

    try {
      const hasil = await window.kirimNilaiBagian(
        D.config.namaSheet, bagian, skor, D.config.totalBagian
      );
      if (selesaiKirim) return;
      selesaiKirim = true;
      clearTimeout(kirimTimeoutId);
      kirimTimeoutId = null;

      if (hasil && hasil.ok) {
        if (E.statusKirim) E.statusKirim.className = 'status-kirim success show';
        if (E.statusSpinner) E.statusSpinner.style.display = 'none';
        if (E.statusKirimText) E.statusKirimText.innerHTML = '✅ Nilai bagian ini (<strong>' + skor + '</strong>) berhasil dikirim.';
        return { ok: true, skor: skor };
      } else {
        D.tampilkanGagalKirim(skor, (hasil && hasil.error) || 'Terjadi kesalahan.');
        return { ok: false };
      }
    } catch (err) {
      if (selesaiKirim) return;
      selesaiKirim = true;
      clearTimeout(kirimTimeoutId);
      kirimTimeoutId = null;
      D.tampilkanGagalKirim(skor, err.message || 'Gagal terhubung.');
      return { ok: false };
    }
  };

  D.tampilkanGagalKirim = function (skor, pesan) {
    if (!E.statusKirim) return;
    E.statusKirim.className = 'status-kirim error show';
    if (E.statusSpinner) E.statusSpinner.style.display = 'none';
    if (E.statusKirimText) {
      E.statusKirimText.innerHTML = '⚠️ ' + pesan + ' Nilai: <strong>' + skor +
        '</strong>. Klik "Ulangi Kirim" untuk mencoba lagi.';
    }
    const oldRetry = E.statusKirim.querySelector('.btn-retry');
    if (oldRetry) oldRetry.remove();
    const btnRetry = document.createElement('button');
    btnRetry.className = 'btn-retry';
    btnRetry.type = 'button';
    btnRetry.textContent = '🔄 Ulangi Kirim';
    btnRetry.addEventListener('click', function () { D.kirimNilaiBagian(); });
    E.statusKirim.appendChild(btnRetry);
  };

  // ============================================================
  // 9. NAVIGASI BAGIAN
  // ============================================================
  D.lanjutKeBagianBerikutnya = async function () {
    if (!S.tesSelesai) {
      alert('🔒 Selesaikan tes pemahaman dengan benar terlebih dahulu!');
      return;
    }
    if (!D.config.fileBerikutnya) return;

    if (E.btnLanjutBagian) {
      E.btnLanjutBagian.disabled = true;
      E.btnLanjutBagian.textContent = '⏳ Mengirim...';
    }

    if (!E.statusKirim || !E.statusKirim.classList.contains('show')) {
      await D.kirimNilaiBagian();
    }

    if (E.btnLanjutBagian) {
      E.btnLanjutBagian.disabled = false;
      E.btnLanjutBagian.textContent = 'Lanjut →';
    }

    setTimeout(function () {
      if (window.dutaHapusState) window.dutaHapusState(D.config.stateKey);
      window.location.href = D.config.fileBerikutnya;
    }, 800);
  };

  // ============================================================
  // 10. FEEDBACK GURU (AI)
  // ============================================================
  D.cekTombolFeedback = function () {
    const refPel = (document.getElementById('refPelajaran') || {}).value || '';
    const refPen = (document.getElementById('refPenerapan') || {}).value || '';
    const exitT = (document.getElementById('exitTicket') || {}).value || '';
    const ada = (refPel.trim().length >= 3) || (refPen.trim().length >= 3) || (exitT.trim().length >= 3);
    if (E.btnMintaFeedback) E.btnMintaFeedback.disabled = !ada || S.aiFeedbackLoading;
    if (E.feedbackAiHint) {
      E.feedbackAiHint.textContent = ada
        ? 'Klik tombol untuk minta catatan dari guru.'
        : 'Isi Refleksi atau Exit Ticket dulu untuk mengaktifkan tombol.';
    }
  };

  D.renderFeedbackAi = function () {
    if (!E.feedbackAiBox) return;
    if (S.aiFeedback) {
      E.feedbackAiBox.classList.add('show');
      if (E.feedbackAiBody) E.feedbackAiBody.textContent = S.aiFeedback;
    } else {
      E.feedbackAiBox.classList.remove('show');
    }
  };

  D.mintaFeedbackGuru = async function () {
    if (S.aiFeedbackLoading) return;
    const refPel = (document.getElementById('refPelajaran') || {}).value || '';
    const refPen = (document.getElementById('refPenerapan') || {}).value || '';
    const exitT = (document.getElementById('exitTicket') || {}).value || '';
    if (refPel.trim().length < 3 && refPen.trim().length < 3 && exitT.trim().length < 3) {
      alert('📝 Isi Refleksi (PELAJARAN / PENERAPAN) atau Exit Ticket dulu ya.');
      return;
    }

    S.aiFeedbackLoading = true;
    if (E.btnMintaFeedback) {
      E.btnMintaFeedback.disabled = true;
      E.btnMintaFeedback.innerHTML = '<span class="fai-spin"></span> Meminta catatan...';
    }
    if (E.feedbackAiHint) E.feedbackAiHint.textContent = 'Mohon tunggu, guru sedang menulis catatan...';

    const skorBagian = Math.round(40 + (S.tesBenar / soalTesData.length) * 60);

    let ringkas = '';
    if (typeof D.ringkasHasilUntukAI === 'function') {
      try { ringkas = D.ringkasHasilUntukAI() || ''; } catch (e) {}
    }

    const payload = {
      modul: D.config.modulKey,
      bagian: D.config.bagianAktif,
      level: S.levelTantangan || '',
      skorTes: skorBagian,
      benarTes: S.tesBenar,
      totalTes: soalTesData.length,
      ringkasHasil: ringkas,
      mindful: {
        j1: (document.getElementById('mindful1Jawab') || {}).value || '',
        j2: (document.getElementById('mindful2Jawab') || {}).value || '',
        j3: (document.getElementById('mindful3Jawab') || {}).value || '',
        pilih: (document.getElementById('mindfulPilihJawab') || {}).value || ''
      },
      refleksi: { pelajaran: refPel, penerapan: refPen },
      exitTicket: exitT
    };

    let hasil;
    try {
      hasil = await window.dutaMintaFeedbackAI(payload);
    } catch (e) {
      hasil = { ok: false, error: e.message || 'Gagal terhubung' };
    }

    S.aiFeedbackLoading = false;

    if (hasil && hasil.ok && hasil.feedback) {
      S.aiFeedback = hasil.feedback;
      D.renderFeedbackAi();
      if (E.btnMintaFeedback) E.btnMintaFeedback.innerHTML = '🔁 Minta Feedback Lagi';
      if (E.feedbackAiHint) E.feedbackAiHint.textContent = 'Catatan guru tersimpan. Bisa lanjut ke bagian berikutnya.';
      if (window.dutaSimpanState) window.dutaSimpanState(D.config.stateKey, D.kumpulkanState(), { force: true });
    } else {
      const pesan = (hasil && hasil.error) || 'Gagal minta feedback. Coba lagi.';
      alert('⚠️ ' + pesan);
      if (E.btnMintaFeedback) E.btnMintaFeedback.innerHTML = '🧑‍🏫 Minta Feedback';
      if (E.feedbackAiHint) E.feedbackAiHint.textContent = 'Gagal. Klik tombol untuk coba lagi.';
    }

    D.cekTombolFeedback();
  };

  // ============================================================
  // 11. STATE
  // ============================================================
  D.kumpulkanState = function () {
    const dasar = {
      lapis3Dibaca: S.lapis3Dibaca,
      levelTantangan: S.levelTantangan,
      tantanganSelesai: S.tantanganSelesai,
      jawabanKuisKilat: S.jawabanKuisKilat,
      kuisKilatSubmitted: S.kuisKilatSubmitted,
      kuisKilatBenar: S.kuisKilatBenar,
      jawabanTes: S.jawabanTes,
      tesSubmitted: S.tesSubmitted,
      tesBenar: S.tesBenar,
      tesSelesai: S.tesSelesai,
      mindfulPilihJawab: (document.getElementById('mindfulPilihJawab') || {}).value || '',
      mindful2Jawab: (document.getElementById('mindful2Jawab') || {}).value || '',
      mindful3Jawab: (document.getElementById('mindful3Jawab') || {}).value || '',
      refPelajaran: (document.getElementById('refPelajaran') || {}).value || '',
      refPenerapan: (document.getElementById('refPenerapan') || {}).value || '',
      exitTicket: (document.getElementById('exitTicket') || {}).value || '',
      aiFeedback: S.aiFeedback
    };
    let kustom = {};
    if (typeof D.stateKustom === 'function') {
      try { kustom = D.stateKustom() || {}; } catch (e) {}
    }
    return Object.assign(dasar, kustom);
  };

  D.restoreState = function (s) {
    if (!s || typeof s !== 'object') return;
    S.lapis3Dibaca       = !!s.lapis3Dibaca;
    S.levelTantangan     = s.levelTantangan || null;
    S.tantanganSelesai   = s.tantanganSelesai || {};
    S.jawabanKuisKilat   = s.jawabanKuisKilat || {};
    S.kuisKilatSubmitted = !!s.kuisKilatSubmitted;
    S.kuisKilatBenar     = Number(s.kuisKilatBenar) || 0;
    S.jawabanTes         = s.jawabanTes || {};
    S.tesSubmitted       = !!s.tesSubmitted;
    S.tesBenar           = Number(s.tesBenar) || 0;
    S.tesSelesai         = !!s.tesSelesai;
    S.aiFeedback         = s.aiFeedback || '';

    const isi = function (id, val) {
      if (!val) return;
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    isi('mindfulPilihJawab', s.mindfulPilihJawab);
    isi('mindful2Jawab', s.mindful2Jawab);
    isi('mindful3Jawab', s.mindful3Jawab);
    isi('refPelajaran', s.refPelajaran);
    isi('refPenerapan', s.refPenerapan);
    isi('exitTicket', s.exitTicket);

    if (typeof D.pulihkanTampilan === 'function') {
      try { D.pulihkanTampilan(s); } catch (e) {}
    }

    D.renderFeedbackAi();
    D.cekTombolFeedback();
  };

  D.tawarkanRestore = function () {
    const s = window.dutaAmbilState ? window.dutaAmbilState(D.config.stateKey) : null;
    if (!s) return false;
    if (typeof D.bolehTawarkanRestore === 'function' && !D.bolehTawarkanRestore(s)) return false;

    window.tampilkanModal({
      judul: '🔄 Lanjutkan Aktivitas?',
      pesan:
        '<p style="margin-bottom:0.7rem;">Kami menemukan progres belajar yang tersimpan di perangkat ini.</p>' +
        '<p style="margin-bottom:0.7rem;">Kamu bisa <strong>melanjutkan dari terakhir</strong> atau <strong>mulai dari awal</strong>.</p>',
      tombolLanjut: '▶️ Lanjutkan',
      onLanjut: function () { D.restoreState(s); }
    });
    return true;
  };

  // ============================================================
  // 12. INIT
  // ============================================================
  D.init = function (opts) {
    const o = opts || {};

    D.config = Object.assign(D.config, {
      namaSheet: o.namaSheet || D.config.namaSheet,
      modulKey: o.modulKey || D.config.modulKey,
      totalBagian: o.totalBagian || D.config.totalBagian,
      ambangLulus: o.ambangLulus || D.config.ambangLulus,
      durasiBacaDetik: o.durasiBacaDetik || D.config.durasiBacaDetik,
      stateKey: o.stateKey || D.config.stateKey,
      bagianAktif: o.bagianAktif || D.config.bagianAktif,
      fileBerikutnya: o.fileBerikutnya || '',
      fileSebelumnya: o.fileSebelumnya || ''
    });

    kuisKilatData    = o.kuisKilatData    || [];
    soalTesData      = o.soalTesData      || [];
    tantanganDasar   = o.tantanganDasar   || [];
    tantanganReguler = o.tantanganReguler || [];
    tantanganBonus   = o.tantanganBonus   || [];

    E = {
      progressLapis: document.getElementById('progressLapis'),
      feedbackBox: document.getElementById('feedbackBox'),
      fbIcon: document.getElementById('fbIcon'),
      fbText: document.getElementById('fbText'),

      areaSimulasi: document.getElementById('area-simulasi'),
      areaPilihLevel: document.getElementById('areaPilihLevel'),
      areaLapis2: document.getElementById('areaLapis2'),
      areaLapis3: document.getElementById('areaLapis3'),

      levelOptions: document.getElementById('levelOptions'),
      levelBadge: document.getElementById('levelBadge'),
      levelBadgeText: document.getElementById('levelBadgeText'),
      mindfulPilihLevel: document.getElementById('mindfulPilihLevel'),
      btnLanjutLapis2: document.getElementById('btnLanjutLapis2'),

      lapis2LevelLabel: document.getElementById('lapis2LevelLabel'),
      lapis2JumlahTantangan: document.getElementById('lapis2JumlahTantangan'),
      tantanganList: document.getElementById('tantanganList'),
      mindful2: document.getElementById('mindful2'),
      btnLanjutLapis3: document.getElementById('btnLanjutLapis3'),

      kuisKilatBox: document.getElementById('kuisKilatBox'),
      kuisKilatContent: document.getElementById('kuisKilatContent'),
      kkHasil: document.getElementById('kkHasil'),
      btnLanjutTes: document.getElementById('btnLanjutTes'),

      tesSection: document.getElementById('tesSection'),
      soalContainer: document.getElementById('soalContainer'),
      tesProgress: document.getElementById('tesProgress'),
      btnPeriksaTes: document.getElementById('btnPeriksaTes'),
      btnUlangiTes: document.getElementById('btnUlangiTes'),
      hasilTes: document.getElementById('hasilTes'),
      refleksiBox: document.getElementById('refleksiBox'),

      btnLanjutBagian: document.getElementById('btnLanjutBagian'),
      hintLanjut: document.getElementById('hintLanjut'),

      statusKirim: document.getElementById('statusKirim'),
      statusKirimText: document.getElementById('statusKirimText'),
      statusSpinner: document.getElementById('statusSpinner'),

      feedbackAiBox: document.getElementById('feedbackAiBox'),
      feedbackAiBody: document.getElementById('feedbackAiBody'),
      btnMintaFeedback: document.getElementById('btnMintaFeedback'),
      feedbackAiHint: document.getElementById('feedbackAiHint')
    };

    const safe = function (el, ev, fn) { if (el) el.addEventListener(ev, fn); };

    safe(E.btnLanjutLapis2, 'click', D.lanjutKeLapis2);
    safe(E.btnLanjutLapis3, 'click', D.lanjutKeLapis3);
    safe(E.btnLanjutTes, 'click', D.lanjutKeTesPemahaman);
    safe(E.btnPeriksaTes, 'click', D.periksaTes);
    safe(E.btnUlangiTes, 'click', D.ulangiTes);
    if (E.btnLanjutBagian) {
      if (typeof o.onKlikLanjutBagian === 'function') {
        E.btnLanjutBagian.addEventListener('click', o.onKlikLanjutBagian);
      } else {
        E.btnLanjutBagian.addEventListener('click', D.lanjutKeBagianBerikutnya);
      }
    }
    safe(E.btnMintaFeedback, 'click', D.mintaFeedbackGuru);

    if (E.levelOptions) {
      E.levelOptions.querySelectorAll('.level-option').forEach(function (el) {
        el.addEventListener('click', function () { D.pilihLevel(el.dataset.level); });
      });
    }

    ['refPelajaran', 'refPenerapan', 'exitTicket'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', D.cekTombolFeedback);
        el.addEventListener('change', D.cekTombolFeedback);
      }
    });

    D.onLulus = o.onLulus || null;
    D.onLapis2Selesai = o.onLapis2Selesai || null;
    D.stateKustom = o.stateKustom || null;
    D.pulihkanTampilan = o.pulihkanTampilan || null;
    D.ringkasHasilUntukAI = o.ringkasHasilUntukAI || null;
    D.bolehTawarkanRestore = o.bolehTawarkanRestore || null;

    D.renderFeedbackAi();
    D.cekTombolFeedback();

    if (window.dutaAutoSave) {
      window.dutaAutoSave(D.config.stateKey, D.kumpulkanState, 5000);
    }
    if (window.dutaPasangAutoSaveInput) {
      window.dutaPasangAutoSaveInput(D.config.stateKey, D.kumpulkanState, [
        document.getElementById('mindful1Jawab'),
        document.getElementById('mindfulPilihJawab'),
        document.getElementById('mindful2Jawab'),
        document.getElementById('mindful3Jawab'),
        document.getElementById('refPelajaran'),
        document.getElementById('refPenerapan'),
        document.getElementById('exitTicket')
      ]);
    }

    window.addEventListener('beforeunload', function () {
      if (bacaTimerInterval) clearInterval(bacaTimerInterval);
      if (modalPenamaanEl) modalPenamaanEl.remove();
    });

    return D;
  };

  // ============================================================
  // 13. EKSPOR INTERNAL
  // ============================================================
  D.getLevel = function () { return S.levelTantangan; };
  D.setLevel = function (v) { S.levelTantangan = v; };
  D.isLapis3Dibaca = function () { return S.lapis3Dibaca; };
  D.setLapis3Dibaca = function (v) { S.lapis3Dibaca = !!v; };
  D.getTesBenar = function () { return S.tesBenar; };
  D.isTesSelesai = function () { return S.tesSelesai; };
  D.setTesSelesai = function (v) { S.tesSelesai = !!v; };
  D.getAiFeedback = function () { return S.aiFeedback; };
  D.setAiFeedback = function (v) { S.aiFeedback = v || ''; };

  console.log('✅ scripttik.js siap — panggil DUTA_TIK.init({...}) di tiap file aktivitas TIK.');
})();