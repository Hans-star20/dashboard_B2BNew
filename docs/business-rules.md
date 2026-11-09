# Business Rules

Dokumen ini mencatat keputusan bisnis untuk rancangan B2B Dashboard. Aturan
berlabel **FINAL** telah disepakati; aturan **PERLU KONFIRMASI** belum diputuskan
dan tidak boleh diisi dengan asumsi.

## Identitas tiket — FINAL

- Sumber identitas adalah `INCIDENT` (A), unik lintas periode menurut pemilik
  proses.
- Identifier disimpan sebagai String. Pencocokan tiket mengabaikan kapitalisasi
  dan memangkas karakter Unicode `White_Space` di awal/akhir **hanya untuk
  pencocokan**. Whitespace internal tidak diubah; tidak ada normalisasi Unicode
  atau penghapusan tanda baca.
- Nilai sumber asli tetap disimpan tanpa normalisasi permanen. Case atau
  whitespace tepi yang berbeda harus menemukan tiket yang sama, bukan membuat
  duplikat.
- `incident` menyimpan ejaan awal dan dibandingkan case-sensitive (misalnya
  kolasi `utf8mb4_0900_as_cs`); `incidentMatchKey` memakai kolasi
  case-insensitive (misalnya `utf8mb4_0900_as_ci`) untuk trim+case matching.
  Tetapkan keduanya melalui migration SQL dan verifikasi MySQL 8.0 serta Prisma
  lookup/upsert. `incidentSourceRaw` menyimpan nilai sumber terbaru secara utuh.
  Jangan menulis hasil trim/lowercase kembali ke field sumber.
- `INCIDENT` kosong atau duplikat setelah normalisasi pencocokan adalah baris
  gagal/perlu pemeriksaan; jangan memilih record secara arbitrer.

## Status tiket — FINAL

- Sumber status dashboard hanya `STATUS` (K); simpan status sumber terpisah.
- Simpan nilai mentah `STATUS` pada `sourceStatus`.
- Setelah trim spasi dan normalisasi huruf besar/kecil, `CLOSED` dipetakan
  menjadi status internal `CLOSED`.
- `BACKEND`, `MEDIACARE`, `FINALCHECK`, dan semua nilai non-CLOSED lainnya
  dipetakan menjadi `OPEN`.
- Nilai NULL/kosong menjadi `OPEN` dan `statusNeedsReview = true`.
- `STATUS FUNGSI` (FI) dan `GUARANTE STATUS` (BL) adalah kolom berbeda dan bukan
  sumber status dashboard.

## Kategori layanan — FINAL

- Sumber adalah `SERVICE TYPE` (H); simpan nilai sumber.
- Aplikasi membentuk `sourceValueMatchKey` dengan trim whitespace awal/akhir;
  lookup memakai kolasi database case-insensitive. Nilai raw tidak diubah.
- Tiket kategori `UNCLASSIFIED` tidak boleh dihilangkan.
- Nilai yang tidak dikenal dipetakan ke `UNCLASSIFIED` dan tiket tetap
  diproses; nilai raw tetap tersedia untuk audit.
- `Ticket.sourceServiceType` selalu mempertahankan teks sumber asli, termasuk
  ketika `Ticket.serviceTypeId` menunjuk fallback.
- Setiap nilai SERVICE TYPE yang dikenal memakai entri katalog masing-masing.
  Nilai non-kosong yang belum dikenal tidak membuat entri katalog baru dan
  menggunakan satu entri fallback `ServiceType` dengan
  `sourceValue = 'UNCLASSIFIED'` dan kategori `UNCLASSIFIED`.
- Entri fallback wajib tersedia sebelum sinkronisasi pertama. Key unik
  `sourceValueMatchKey` dengan kolasi `utf8mb4_0900_as_ci` mencegah duplikasi
  setelah trim whitespace tepi dan pencocokan case-insensitive. Bootstrap
  fallback bersifat idempotent; sync tidak membuat entri katalog. Fallback
  wajib tetap aktif dan tidak boleh dihapus/nonaktifkan.
- SERVICE TYPE NULL, string kosong, atau whitespace-only memakai fallback
  `UNCLASSIFIED`. Pertahankan raw tepat seperti sumber (`NULL`, string kosong,
  atau whitespace); jangan menggantinya dengan sentinel. Set
  `Ticket.serviceTypeNeedsReview = true`.
- Nilai non-kosong tak dikenal juga memakai fallback tanpa membuat katalog
  baru dan menandai `serviceTypeNeedsReview = true`. Nilai yang dikenal memakai
  katalog masing-masing dan menandai flag false.
- Nilai baru yang kemudian disetujui untuk dipetakan ditambahkan melalui
  perubahan mapping/katalog terkontrol; tiket terkait boleh diarahkan ke
  entri baru tanpa menimpa `sourceServiceType`. Mapping kategori berikut tetap
  dipertahankan:

| Nilai sumber setelah trim/case-insensitive match | Kategori dashboard |
|---|---|
| `ASTINET` | `DATIN` |
| `INTERNET`, `VOICE` | `HSI` |
| `LOC_AP`, `WIFI` | `WIFI` |
| `SITE`, `INTERNET_OLO` | `SQUAT` |
| `METRO-E`, `MM_IPVPN`, `NON_NUMBERING` | `UNCLASSIFIED` |
| Nilai non-kosong tidak dikenal | `UNCLASSIFIED` |

## Identitas dan rekonsiliasi teknisi — FINAL

- PK teknisi adalah UUID `Technician.id`, bukan NIK. Tiket mengacu pada UUID
  internal sehingga perubahan NIK tidak memutus histori.
- `sourceNik` adalah NIK sumber Sheets; `nik` adalah NIK aplikasi yang dapat
  diedit. Keduanya String/VARCHAR, maksimum 64 karakter, case-sensitive, dan
  mempertahankan leading zero. NIK tidak di-trim atau dinormalisasi.
- NIK resmi perusahaan hanya terdiri dari digit ASCII 0-9 dengan panjang 4
  sampai 8 karakter; validasi tepatnya `^[0-9]{4,8}$`. Nilai disimpan sebagai
  String/VARCHAR(64), bukan angka, dan harus dipertahankan persis termasuk
  leading zero. Backend dan constraint database memvalidasi format ini.
- Semua kolom NIK yang dipakai untuk pencocokan identitas memakai kolasi
  case-sensitive dan keunikan exact. Perubahan terhadap NIK lama yang tidak
  lolos aturan baru tidak boleh dinormalisasi atau diperbaiki otomatis;
  lakukan pemeriksaan dan keputusan manual sebelum constraint migration
  diterapkan.
- `sourceNik`, `nik`, dan `TechnicianIdentityHistory.activeNikKey` memakai
  aturan perbandingan/kolasi case-sensitive yang konsisten. Benturan diperiksa
  lintas identitas SOURCE dan APPLICATION, bukan hanya dalam kolom sejenis.
- Setelah pemeriksaan manual menetapkan NIK sebagai teknisi baru, inisialisasi
  `sourceNik` dan `nik` dari sumber dalam transaksi bersama histori. Sinkronisasi
  tidak membuat teknisi baru hanya karena NIK belum dikenal dan tidak menimpa
  edit manual `nik`.
- NIK kosong tidak boleh direkayasa atau menghasilkan teknisi anonim. Simpan
  tiket tanpa relasi teknisi dan tandai untuk pemeriksaan.
- NIK sumber yang sama mengidentifikasi teknisi yang sama. NIK kosong tidak
  dimasukkan ke unique identity.
- Nilai kosong diperlakukan sebagai NULL/perlu pemeriksaan. Benturan identitas
  aktif lintas teknisi/jenis tidak boleh menghasilkan teknisi atau identitas
  ganda.
- `Nama Teknisi Handle` (DW) adalah atribut nama, bukan key. Jika nama sumber
  berbeda untuk `sourceNik` yang sama, tandai `nameNeedsReview`; jangan otomatis
  mengganti nama tersimpan/disetujui.
- Teknisi yang dinonaktifkan tetap tersimpan dan tetap digunakan pada laporan
  historis, tetapi tidak ditawarkan sebagai pilihan operasional baru.

### Konflik perubahan NIK sumber — FINAL

Jika NIK sumber berbeda dari identitas teknisi yang telah terhubung, jangan
otomatis mengubah `sourceNik`, menghubungkan ulang tiket, atau membuat teknisi
duplikat. Pertahankan relasi UUID yang ada, simpan NIK yang datang pada konteks
tiket, tandai konflik dan minta pemeriksaan manual.

Setelah pemeriksaan menyetujui perubahan, identitas NIK lama ditutup tetapi
tetap tersimpan di histori; NIK baru dapat menjadi `sourceNik` aktif. Simpan
aktor dan waktu perubahan. Tiket lama tetap terhubung ke UUID teknisi yang sama
dan tidak dihubungkan ulang. Satu NIK aktif hanya boleh dimiliki satu teknisi,
baik NIK sumber maupun aplikasi; semua nilai bertipe String agar nol di depan
dipertahankan. Jika NIK lama masih dipakai sebagai `nik` aplikasi, identitas itu
tetap aktif sebagai identitas aplikasi teknisi yang sama. NIK baru yang telah
dimiliki teknisi lain tidak boleh dialihkan otomatis. Edit manual NIK aplikasi
juga harus dicatat dengan aktor/waktu.

Jika row histori aktif adalah `BOTH`:

- Perubahan NIK aplikasi: tutup row `BOTH`; buat row `SOURCE` aktif untuk NIK
  sumber lama dan row `APPLICATION` aktif untuk NIK aplikasi baru.
- Perubahan NIK sumber yang telah disetujui: tutup row `BOTH`; buat row
  `APPLICATION` aktif untuk NIK aplikasi lama dan row `SOURCE` aktif untuk NIK
  sumber baru.

Pembaruan kolom current `Technician.sourceNik`/`nik` dan seluruh perubahan
histori dilakukan atomik. Bila nilai sumber dan aplikasi kembali sama, satu row
`BOTH` aktif menggantikan dua row. Keunikan NIK aktif diperiksa lintas semua
teknisi dan jenis identitas.

### NIK sumber valid yang belum dikenal — FINAL

- Jangan otomatis membuat teknisi hanya karena NIK sumber valid tidak ditemukan
  pada `Technician.sourceNik`; NIK itu mungkin perubahan identitas teknisi lama.
- Buat rekaman `TechnicianIdentityConflict` berstatus `PENDING` dan masukkan ke
  antrean pemeriksaan. Catat tiket, NIK sumber, SyncLog pendeteksi, serta
  teknisi yang diduga terkait bila ada.
- Jika NIK masuk ditemukan hanya sebagai NIK aplikasi (`nik`) atau pada histori
  identitas, itu tetap bukan bukti untuk auto-link ke `sourceNik`; masukkan
  antrean pemeriksaan dan cegah pembuatan identitas aktif duplikat.
- Petugas memutuskan secara manual apakah NIK merupakan teknisi baru atau
  perubahan identitas teknisi lama. Pembuatan atau perubahan identitas dilakukan
  setelah keputusan, dalam transaksi atomik bersama histori identitas.
- Tiket yang belum memiliki `technicianId` tetap belum terhubung selama review.
  Setelah keputusan, tautan tiket tersebut memerlukan tindakan manual eksplisit;
  sinkronisasi tidak menghubungkan ulang tiket historis secara otomatis.
- Jika NIK aktif telah dimiliki teknisi lain, jangan membuat identitas duplikat
  atau mengalihkan kepemilikan otomatis.
- Sinkronisasi tidak pernah auto-link tiket yang `technicianId`-nya NULL,
  meskipun NIK cocok dengan teknisi yang diketahui. Relasi yang sudah ada
  dipertahankan; kandidat yang cocok masuk pemeriksaan manual. Jika tiket
  terhubung ke teknisi A tetapi NIK cocok dengan teknisi B (B != A), catat
  konflik dan jangan mengganti `technicianId`.
- Semua keputusan penautan/perubahan relasi teknisi dilakukan manual dan
  dicatat pada `TicketTechnicianLinkHistory`; konflik tidak mengubah relasi
  dengan sendirinya. Sinkronisasi tidak pernah mengubah `Ticket.technicianId`.

### Penanda pemeriksaan NIK pada tiket — FINAL

- `technicianNeedsReview = true` berarti NIK tiket kosong atau belum
  terverifikasi sehingga tiket belum dapat dipastikan tertaut ke teknisi yang
  benar. Flag ini sendiri bukan bukti perubahan identitas.
- `technicianSourceConflict = true` berarti NIK sumber yang datang berbeda
  dari identitas SOURCE aktif teknisi yang telah terhubung.
- Review konflik tidak mengubah `Ticket.technicianId` atau
  `Technician.sourceNik` secara otomatis. Setelah review, perubahan identitas
  dan/atau penautan tiket memerlukan tindakan manual eksplisit dan atomik.

### Histori konflik identitas — FINAL

`TechnicianIdentityConflict` mencatat tiket, teknisi dugaan (nullable), NIK
sumber konflik, waktu ditemukan, status `PENDING`/`APPROVED`/`REJECTED`, SyncLog
pendeteksi, pemeriksa, waktu pemeriksaan, dan alasan keputusan. Sinkronisasi
tidak menimpa keputusan yang sudah tercatat dan tidak menghapus rekaman konflik.
Review mencatat aktor/waktu; FK melindungi histori. Koreksi keputusan yang telah
final harus menjadi tindakan/audit baru, bukan penghapusan.

Jika konflik PENDING yang sama ditemukan pada run berbeda, setiap run menjadi
event deteksi tersendiri yang tetap disimpan. Antrean review mengelompokkan
event PENDING dengan pasangan `(ticketIncident, sourceNik)` (NIK dibandingkan
case-sensitive), sehingga ada satu pekerjaan review untuk grup tersebut.
Keputusan manual menyelesaikan seluruh event PENDING dalam grup secara
atomik; temuan baru setelah grup selesai dapat membentuk pekerjaan review baru.
Pengelompokan ini adalah deduplikasi logis antrean, bukan unique constraint
database; event setiap run tetap dipertahankan.

### Histori penautan tiket-teknisi — FINAL

`TicketTechnicianLinkHistory` merekam penautan pertama, pergantian teknisi,
dan koreksi relasi tiket. Setiap perubahan `Ticket.technicianId` wajib
menghasilkan tepat satu histori dalam transaksi database yang sama. Tipe
tindakan dibatasi pada `MANUAL_LINK`, `CONFLICT_RESOLUTION`, dan `CORRECTION`.
`MANUAL_LINK` mencakup tautan pertama/pergantian manual biasa;
`CONFLICT_RESOLUTION` digunakan bila perubahan relasi merupakan hasil
keputusan konflik identitas; `CORRECTION` memperbaiki relasi yang keliru.
Penautan pertama memiliki `previousTechnicianId = NULL`; `newTechnicianId`
wajib menunjuk teknisi valid. Setiap tindakan harus dilakukan oleh user dan
memiliki alasan nonkosong.

Penyelesaian `TechnicianIdentityConflict` tetap manual. Jika keputusan manual
juga mengubah tautan tiket, perubahan status/review konflik, relasi tiket, dan
histori penautan dilakukan atomik; gunakan `CONFLICT_RESOLUTION`. Persetujuan
konflik identitas saja tidak otomatis menautkan atau menghubungkan ulang tiket.
Koreksi keputusan final dicatat sebagai tindakan baru, tidak menghapus histori
lama.

Implementasi menggunakan satu service transaksi Prisma sebagai satu-satunya
jalur aplikasi untuk menulis `Ticket.technicianId`; service mengunci tiket,
mengambil nilai sebelumnya dari database, memvalidasi aktor/teknisi/alasan,
lalu menulis relasi dan histori bersama. Kegagalan salah satu operasi
membatalkan seluruh transaksi. Trigger tidak diasumsikan atau digunakan.
Tidak ada route, sync job, atau repository lain yang boleh menulis field itu
langsung; akses Prisma untuk update relasi hanya diekspos melalui service
tersebut. Perubahan langsung di luar service aplikasi dapat melewati audit,
sehingga akses tulis database juga harus dibatasi. Unlink ke NULL tidak
disediakan oleh model ini karena `newTechnicianId` wajib menunjuk teknisi yang valid.
Histori tidak boleh dihapus oleh aplikasi, sync, atau soft deactivation;
teknisi nonaktif tetap direferensikan oleh histori.

## User, role, dan permission — FINAL

- Setiap akun memiliki tepat satu role utama: `SUPERUSER`, `HELPDESK`, atau
  `SUPERVISOR`. Role direlasikan langsung dari user; tidak ada many-to-many
  `UserRole`.
- Permission fleksibel: role memperoleh permission melalui `RolePermission`;
  grant khusus per akun didukung melalui `UserPermission`. Permission efektif
  merupakan gabungan keduanya. Seluruh otorisasi wajib diperiksa di server.
- SUPERUSER dapat CRUD akun pengguna, mengatur/reset password, dan mengubah
  privilege akun yang dibuatnya.
- Akun pengguna tidak dihapus permanen; nonaktifkan akun. Relasi pembuat,
  pemberi, dan pencabut permission mempertahankan histori dan tidak memakai
  cascade yang memutus histori.
- Grant permission mencatat pemberi dan waktu. Revoke mencatat pencabut dan
  waktu pada histori grant; re-grant membuat event grant baru. Histori grant
  atau revoke tidak dihapus secara fisik.
- Satu grant aktif maksimal untuk kombinasi user/permission. Grant/revoke
  mengunci user penerima dan berjalan dalam transaksi; revoke hanya mengubah
  grant aktif, sedangkan re-grant membuat row baru. Unique constraint database
  atas generated `activeGrantKey` bersama user menjadi pertahanan race terakhir;
  index non-unique saja tidak cukup. Prisma schema tetap mencatat kolom sebagai
  `Unsupported("char(36)")?` dan unique gabungan `(userId, activeGrantKey)`;
  SQL migration menetapkan ekspresi generated. Jangan menghilangkan field/
  constraint dari schema atau menerima migration berikutnya sebelum DDL
  generated dan unique key diverifikasi.
- Untuk login lokal, `User.passwordHash` wajib dan hanya berisi hash adaptif;
  password asli tidak disimpan, ditampilkan, maupun dapat dilihat siapa pun.
  Reset mengganti hash. Pilihan autentikasi nonlokal perlu ditetapkan sebelum
  implementasi jika ingin mengubah kebutuhan field ini.
- Akun nonaktif tidak dapat login.
- Tepat satu SUPERUSER utama dibuat melalui bootstrap server yang terlindungi
  dan idempotent. Constraint unik pada penanda akun utama mencegah akun utama
  kedua. Menu biasa tidak menyediakan pembuatan SUPERUSER kedua.
- Nilai tetap `primarySuperuserKey = 'PRIMARY'` hanya dapat dipasang oleh
  bootstrap. Satu-satunya hubungan yang sah adalah dua arah: akun bertanda
  PRIMARY wajib memiliki role `SUPERUSER`, dan hanya akun bertanda PRIMARY
  yang boleh memiliki role `SUPERUSER`.
- Unique nullable marker membatasi jumlah akun PRIMARY menjadi satu; CHECK
  membatasi nilainya ke NULL atau `PRIMARY`. Trigger SQL pada insert/update
  user memeriksa hubungan dua arah dengan role akhir di baris yang sama.
  Perubahan `roleId` dan marker harus menjadi satu update/operasi atomik.
  Role sistem SUPERUSER tidak boleh diubah namanya atau dihapus, akses SQL
  untuk mengubah marker/role SUPERUSER dibatasi ke jalur bootstrap, dan
  pemeriksaan server-side wajib pada setiap perubahan.
- Pengguna tidak dapat memberikan atau menaikkan role/permission untuk dirinya
  sendiri. Menu pengelolaan user tidak boleh mengubah role target menjadi
  `SUPERUSER` atau memberikan privilege SUPERUSER. Validasi ini wajib di server.
- Role, permission sistem, dan mapping permission role tidak dapat dihapus atau
  dimodifikasi melalui menu biasa. Permission administratif tidak boleh
  memberikan privilege SUPERUSER secara tidak langsung, termasuk melalui
  kemampuan mengubah katalog role/permission atau grant hak lain.
- SUPERUSER hanya mengelola akun yang dibuatnya sesuai aturan bisnis.

### Detail tata kelola akses — PERLU KONFIRMASI

Matriks permission baseline HELPDESK/SUPERVISOR, katalog permission lengkap,
prosedur pemulihan akun bootstrap, SSO/MFA, pencabutan sesi saat reset, dan
retensi audit grant/revoke perlu ditetapkan sebelum implementasi.

## Soft deactivation dan histori — FINAL

- Technician dan ServiceType yang telah memiliki histori tiket tidak dihapus
  secara fisik. Gunakan `isActive` untuk menonaktifkan.
- Tiket historis tetap terhubung; FK mencegah penghapusan record terkait.
- Teknisi nonaktif tidak tersedia sebagai pilihan operasional baru, tetapi tetap
  masuk dalam laporan produktivitas/histori.
- ServiceType nonaktif tidak tersedia untuk proses operasional baru, tetapi
  tidak menghapus klasifikasi atau histori tiket.
- Penonaktifan tidak menghapus data maupun relasi.

## Tanggal dan durasi penyelesaian — FINAL

- `REPORTED DATE` (D) adalah waktu mulai dan wajib valid untuk tiket produktif.
  Baris dengan tanggal kosong atau tidak valid tidak diproses sebagai tiket
  produktif; catat sebagai gagal/perlu pemeriksaan.
- `RESOLVE DATE` (BM) adalah waktu selesai dan boleh kosong.
- Durasi = `RESOLVE DATE - REPORTED DATE`, dihitung saat query dalam detik.
  `RESOLVE DATE` kosong menghasilkan durasi NULL. Kolom TTR tidak digunakan
  sebagai sumber durasi.
- Jika tanggal selesai lebih awal dari tanggal pelaporan, tandai sebagai
  anomali dan jangan sajikan sebagai durasi normal.
- Zona waktu sumber adalah `Asia/Jakarta`; simpan instant konsisten sebagai UTC
  setelah parsing sumber.

### Parsing tanggal — PERLU KONFIRMASI

Format input dan parsing serial tanggal Sheets, presisi pembulatan detik, dan
prosedur koreksi tanggal anomali perlu ditetapkan serta diuji. Jangan
mengasumsikan format berdasarkan contoh tunggal atau locale mesin.

## Prinsip sumber data — FINAL

- Google Sheets hanya sumber READ-ONLY. Tidak menulis balik atau mengubah
  spreadsheet.
- Jangan menghapus tiket lokal hanya karena tidak ditemukan pada satu
  pembacaan. Pembaruan `lastSeenAt` hanya sah setelah pembacaan lengkap sukses.
- Retry untuk satu proses sinkronisasi menggunakan `runKey` yang sama. Pembacaan
  Sheets yang tidak lengkap tidak boleh menyebabkan penghapusan/penonaktifan
  histori tiket atau pembaruan `lastSeenAt` seolah pembacaan lengkap sukses.
- Pertahankan field raw ketika transformasi diterapkan.
- Jangan memberi arti pada header duplikat, placeholder (termasuk `Column78`),
  atau kolom ambigu tanpa konfirmasi pemilik data.

### Retensi dan ukuran SyncLog — FINAL

`failureDetails` hanya boleh mencatat nomor baris, kode error, dan informasi
teknis tersanitasi; tidak boleh berisi PII, nilai cell mentah, password, token,
atau credential. Ukuran `failureDetails` maksimum 64 KiB dan wajib divalidasi
oleh aplikasi sebelum insert/update.

Counter `inserted`, `updated`, `unchanged`, `skipped`, dan `failed` mencatat
hasil percobaan terakhir, bukan agregat lintas retry. Retry memakai `runKey`
yang sama, menaikkan `attemptCount`, memperbarui `lastAttemptAt`, mengatur
status `RUNNING`, mengosongkan `finishedAt`, dan mereset counter hasil sebelum
percobaan baru dimulai. Setelah selesai, counter menyimpan hasil percobaan itu.

Retensi SyncLog adalah 365 hari hanya untuk record yang tidak direferensikan
oleh histori. SyncLog yang dirujuk histori identitas/konflik tidak dihapus
permanen; arsip wajib mempertahankan record/ID dan FK. Histori identitas,
konflik identitas, serta grant/revoke permission tidak dihapus permanen.
Kebijakan retensi untuk jenis log lain tetap perlu ditetapkan. Retensi log
tidak memberi izin menghapus tiket historis akibat pembacaan Sheets yang tidak
lengkap.
