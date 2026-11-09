# Data Dictionary

Dokumen ini mencatat rancangan field aplikasi berdasarkan keputusan bisnis dan
audit `MainSheet`. Ini dokumentasi rancangan, bukan implementasi database atau
proses impor.

## Status keputusan

Aturan **FINAL** dirujuk dari [business-rules.md](./business-rules.md). Hal yang
belum ditetapkan tercantum di bagian [perlu konfirmasi](#hal-yang-perlu-dikonfirmasi).

## Tiket dan sumber

| Field | Sumber | Tipe rancangan | Makna/transformasi | Validasi |
|---|---|---|---|---|
| `Ticket.incident` | `INCIDENT` (A) | String, PK | Ejaan awal yang disimpan persis. | Perbandingan case-sensitive, misalnya kolasi `utf8mb4_0900_as_cs`; ditetapkan via migration SQL dan diuji di MySQL 8.0/Prisma. |
| `Ticket.incidentMatchKey` | Turunan `INCIDENT` (A) | String, unique | Lookup key; trim karakter Unicode `White_Space` awal/akhir saja, case-insensitive. | Kolasi misalnya `utf8mb4_0900_as_ci`; migration SQL dan uji lookup/upsert. Raw tidak diubah. |
| `Ticket.incidentSourceRaw` | `INCIDENT` (A) | String | Nilai sumber terbaru secara utuh, termasuk kapitalisasi/spasi. | Bukan key; jangan normalisasi atau overwrite dengan match key. |
| `Ticket.sourceStatus` | `STATUS` (K) | String nullable | Status sumber asli, terpisah dari enum dashboard. | NULL tetap dapat dibedakan dari nilai terisi. |
| `Ticket.status` | `STATUS` (K) | Enum `OPEN`/`CLOSED` | Setelah trim + uppercase: `CLOSED` → `CLOSED`; `BACKEND`, `MEDIACARE`, `FINALCHECK`, dan nilai non-CLOSED lain → `OPEN`. NULL/kosong → `OPEN`. | Proses sync menetapkan status secara eksplisit; `STATUS FUNGSI` tidak digunakan. |
| `Ticket.statusNeedsReview` | `STATUS` (K) | Boolean | Penanda status sumber kosong/NULL. | Kosong/NULL → true; nilai mentah tetap di `sourceStatus`. |
| `Ticket.sourceServiceType` | `SERVICE TYPE` (H) | String nullable | Nilai sumber layanan mentah. | Simpan raw utuh; tidak trim/ubah kapitalisasi pada nilai ini, termasuk saat FK tiket menunjuk fallback. |
| `ServiceType.sourceValue` | `SERVICE TYPE` (H) | String | Nilai referensi sumber asli. | Disimpan apa adanya; bukan lookup key. |
| `ServiceType.sourceValueMatchKey` | Turunan `ServiceType.sourceValue` | String, unique | Key pencocokan yang dibuat aplikasi setelah trim whitespace awal/akhir. | Kolasi `utf8mb4_0900_as_ci`; migration SQL menetapkan kolasi dan unique constraint pada key ini. |
| `ServiceType.dashboardCategory` | `SERVICE TYPE` (H) | Enum | Kategori hasil mapping. | Nilai non-kosong tidak dikenal dipetakan ke `UNCLASSIFIED`; tiket tidak dihilangkan. |
| `Ticket.serviceTypeId` | Relasi aplikasi | `UNSIGNED SMALLINT`, FK wajib | Relasi wajib ke ServiceType. | Nilai dikenal menunjuk katalog masing-masing; nilai unknown atau kosong/NULL menunjuk satu fallback `UNCLASSIFIED`. |
| `Ticket.serviceTypeNeedsReview` | Validasi SERVICE TYPE | Boolean | Penanda nilai unknown atau sumber NULL/kosong/whitespace-only. | True untuk nilai tersebut; false untuk nilai dikenal. |
| `Ticket.reportedAt` | `REPORTED DATE` (D) | Timestamp, wajib | Waktu mulai; parse sebagai `Asia/Jakarta`, simpan UTC. | Kosong/tidak valid: baris gagal/perlu pemeriksaan dan bukan tiket produktif. |
| `Ticket.resolvedAt` | `RESOLVE DATE` (BM) | Timestamp nullable | Waktu selesai; parse sebagai `Asia/Jakarta`, simpan UTC. | Kosong → NULL; lebih awal dari reportedAt → anomali. |
| `resolutionDurationSeconds` | Turunan `resolvedAt - reportedAt` | Integer nullable, query-time | Durasi dalam detik, tidak disimpan sebagai kolom terhitung. | NULL jika resolvedAt NULL; jangan gunakan TTR. |
| `Ticket.lastSeenAt` | Waktu proses sync | Timestamp nullable | Waktu terakhir tiket terlihat pada pembacaan lengkap. | Update hanya setelah pembacaan lengkap sukses; tidak digunakan untuk menghapus tiket. |

### Mapping kategori SERVICE TYPE

| Nilai sumber setelah trim/case-insensitive match | Kategori |
|---|---|
| `ASTINET` | `DATIN` |
| `INTERNET`, `VOICE` | `HSI` |
| `LOC_AP`, `WIFI` | `WIFI` |
| `SITE`, `INTERNET_OLO` | `SQUAT` |
| `METRO-E`, `MM_IPVPN`, `NON_NUMBERING` | `UNCLASSIFIED` |
| Nilai non-kosong tidak dikenal | `UNCLASSIFIED` |

`Ticket.sourceServiceType` dan `ServiceType.sourceValue` tetap menyimpan
nilai sumber asli. `sourceValueMatchKey` dibuat aplikasi dari `sourceValue`
dengan trim whitespace tepi, lalu dicocokkan melalui kolasi
`utf8mb4_0900_as_ci`; migration SQL menambahkan unique constraint pada key
tersebut. Setiap nilai sumber yang dikenal mempunyai row katalog masing-masing.
Satu row fallback wajib di-bootstrap sebelum sync pertama dengan
`sourceValue = 'UNCLASSIFIED'`, `sourceValueMatchKey = 'UNCLASSIFIED'`, dan
`dashboardCategory = UNCLASSIFIED`; row itu harus tetap aktif. Unique key
dengan kolasi case-insensitive mencegah duplikasi fallback. Raw unknown yang
non-kosong dan raw NULL/kosong/whitespace-only menunjuk fallback tanpa
membuat row katalog baru; nilai mentah tetap persis di `sourceServiceType`.
`serviceTypeNeedsReview` true untuk unknown atau raw kosong/NULL, false untuk
nilai yang dikenal. Mapping baru yang disetujui dilakukan melalui perubahan
katalog terkontrol.

Bootstrap yang direncanakan: dalam transaksi, insert satu row dengan nilai
`UNCLASSIFIED` kanonis dan gunakan unique key `sourceValueMatchKey` untuk
menjadikan insert aman saat diulang/bersamaan. Setelah insert/upsert, baca row
berdasarkan key dengan lock dan verifikasi bahwa `sourceValue` serta key tepat
`UNCLASSIFIED`, kategorinya `UNCLASSIFIED`, dan `isActive = true`. Ketidakcocokan
harus membatalkan transaksi dan meminta pemeriksaan manual, bukan memperbaiki
row secara diam-diam. Bootstrap belum dijalankan ke database.

## Teknisi

| Field | Sumber | Tipe rancangan | Makna/transformasi | Validasi |
|---|---|---|---|---|
| `Technician.id` | Dibuat aplikasi | UUID String, PK | Identitas internal stabil; tiket mereferensikan ID ini. | Tidak berubah saat NIK diedit. |
| `Technician.sourceNik` | `NIK Teknisi` (EM) | String/VARCHAR nullable, unique, `VARCHAR(64)` | NIK sumber Sheets dan kunci rekonsiliasi sumber. | String, bukan numerik; harus cocok `^[0-9]{4,8}$`; case-sensitive, nilai persis dan leading zero dipertahankan. Backend dan CHECK database memvalidasi. NIK kosong tidak membuat record. NIK valid yang belum dikenal masuk antrean konflik, bukan membuat teknisi otomatis. |
| `Technician.nik` | Awalnya `NIK Teknisi` (EM), dapat diedit | String/VARCHAR nullable, unique, `VARCHAR(64)` | NIK aplikasi yang ditampilkan/digunakan. | Aturan format sama: `^[0-9]{4,8}$`; case-sensitive; nilai awal dari sourceNik setelah verifikasi; sinkronisasi tidak menimpa edit manual. |
| `Ticket.technicianSourceNikRaw` | `NIK Teknisi` (EM) | String/VARCHAR nullable, `VARCHAR(64)` | NIK sumber yang datang untuk tiket tertentu. | Validasi format sebelum disimpan; simpan persis, termasuk leading zero. Konflik tidak mengubah relasi teknisi yang sudah ada. |
| `Ticket.technicianId` | Relasi aplikasi | UUID nullable, FK | Relasi ke teknisi yang ditetapkan secara manual. | Tidak pernah auto-link ketika NULL; bila terisi, sync mempertahankan relasi. Setiap perubahan relasi dicatat pada `TicketTechnicianLinkHistory` dalam transaksi yang sama. |
| `Ticket.technicianNeedsReview` | Validasi NIK | Boolean | NIK kosong atau belum terverifikasi sehingga keterkaitan teknisi belum dipastikan. | Bukan bukti perubahan identitas; tidak menghilangkan tiket valid. |
| `Ticket.technicianSourceConflict` | Rekonsiliasi sync | Boolean | NIK sumber berbeda dari identitas SOURCE aktif teknisi yang sudah terhubung, termasuk bila match ke teknisi lain. | Buat konflik; jangan mengganti `Ticket.technicianId` atau `Technician.sourceNik` otomatis. Ticket tanpa `technicianId` juga tidak auto-link; kandidat masuk pemeriksaan manual. |
| `Technician.name` | Atribut aplikasi; awalnya `Nama Teknisi Handle` (DW) | String nullable | Nama yang disimpan/disetujui. Bukan key. | Perbedaan nama sumber tidak menimpa nama ini otomatis. |
| `Technician.sourceName` | `Nama Teknisi Handle` (DW) | String nullable | Nama sumber terakhir yang diamati. | Konflik mengaktifkan nameNeedsReview; histori variasi penuh tidak disimpan. |
| `Technician.nameNeedsReview` | Validasi nama | Boolean | Menandai nama sumber berbeda untuk NIK sumber sama. | Perlu pemeriksaan; jangan overwrite otomatis. |
| `Technician.isActive` | Data aplikasi | Boolean | Status aktif/nonaktif soft. | Nonaktif tidak menghapus data/relasi; historis tetap masuk laporan. |

### Histori penautan tiket-teknisi

| Field | Sumber | Tipe rancangan | Makna/transformasi | Validasi |
|---|---|---|---|---|
| `TicketTechnicianLinkHistory.id` | Dibuat aplikasi | UUID String, PK | ID event histori. | Histori tidak dihapus melalui alur aplikasi normal. |
| `TicketTechnicianLinkHistory.ticketIncident` | `Ticket.incident` | `VARCHAR(128)`, FK wajib | Tiket yang relasinya berubah. | Character set dan kolasi sama persis dengan `Ticket.incident` (`utf8mb4_0900_as_cs`); FK `RESTRICT`. |
| `TicketTechnicianLinkHistory.previousTechnicianId` | Relasi sebelumnya | UUID nullable, FK | Teknisi yang terhubung sebelum perubahan. | NULL hanya untuk penautan pertama; FK `RESTRICT`. |
| `TicketTechnicianLinkHistory.newTechnicianId` | Relasi baru | UUID wajib, FK | Teknisi tujuan yang baru ditautkan. | Harus menunjuk `Technician.id` valid; FK `RESTRICT`. |
| `TicketTechnicianLinkHistory.actionByUserId` | Aktor manual | UUID wajib, FK | User yang melakukan tindakan. | FK `RESTRICT`; semua perubahan relasi memerlukan aktor. |
| `TicketTechnicianLinkHistory.actionType` | Tindakan manual | Enum | `MANUAL_LINK` untuk tautan/pergantian biasa; `CONFLICT_RESOLUTION` untuk hasil keputusan konflik; `CORRECTION` untuk memperbaiki relasi keliru. | Hanya nilai enum tersebut yang diizinkan; sync tidak dapat menjadi aktor atau membuat event ini. |
| `TicketTechnicianLinkHistory.reason` | Alasan tindakan | String/VARCHAR(1000), wajib | Alasan penautan/pergantian/koreksi. | Tidak kosong; divalidasi sebelum perubahan. |
| `TicketTechnicianLinkHistory.createdAt` | Waktu tindakan | `DATETIME(3)`, wajib | Waktu tindakan dalam UTC. | Ditulis pada transaksi yang sama dengan perubahan `Ticket.technicianId`. |
| Unique/index | Model histori | PK + index | Index `(ticketIncident, createdAt)`, `previousTechnicianId`, `(newTechnicianId, createdAt)`, `(actionByUserId, createdAt)`. | Tidak ada unique constraint tambahan karena satu tiket dapat berubah berkali-kali, termasuk dalam waktu yang sama. |

FK `previousTechnicianId` dan `newTechnicianId` memakai relasi Prisma eksplisit
bernama `TicketTechnicianPrevious` dan `TicketTechnicianNew`, masing-masing
berpasangan dengan field balik berbeda pada `Technician`. Relasi tiket dan
aktor juga bernama eksplisit. Semua FK UUID bertipe `CHAR(36)` dengan
character set dan collation yang sama dengan PK User/Technician
(`utf8mb4_0900_as_cs`), ditetapkan via migration SQL. `ticketIncident` bertipe
`VARCHAR(128)` dengan character set/collation persis sama seperti
`Ticket.incident` (`utf8mb4_0900_as_cs`). Seluruh FK menggunakan `RESTRICT`,
bukan `CASCADE` atau `SET NULL`.

Satu service transaksi Prisma mengunci tiket, membaca teknisi sebelumnya dari
database, memvalidasi aktor, target, action type, dan alasan, lalu
memperbarui relasi serta membuat histori secara atomik. Resolver konflik yang
juga mengubah tautan memasukkan perubahan status konflik ke transaksi yang
sama. Gagal satu operasi berarti rollback seluruhnya. Tidak digunakan trigger;
perubahan SQL langsung di luar service masih dapat melewati histori sehingga
akses tulis database harus dibatasi. Unlink ke NULL tidak didukung karena
`newTechnicianId` wajib valid. Soft deactivation tidak menghapus histori atau
relasinya.

### Histori identitas teknisi

| Field | Sumber | Tipe rancangan | Makna/transformasi | Validasi |
|---|---|---|---|---|
| `TechnicianIdentityHistory.id` | Dibuat aplikasi | UUID String, PK | Identitas rekaman histori. | Baris histori tidak di-hard-delete. |
| `TechnicianIdentityHistory.technicianId` | Relasi aplikasi | UUID String, FK wajib | Pemilik identitas teknisi. | FK memakai RESTRICT. |
| `TechnicianIdentityHistory.nik` | `NIK Teknisi` atau edit manual | String/VARCHAR(64) | NIK yang berlaku pada interval identitas. | Harus cocok `^[0-9]{4,8}$`; case-sensitive; pertahankan nilai persis dan nol di depan. |
| `TechnicianIdentityHistory.identityKind` | Sumber/perubahan aplikasi | Enum `SOURCE`, `APPLICATION`, `BOTH` | Menentukan apakah NIK merupakan identitas sumber, aplikasi, atau sama untuk keduanya. | SOURCE harus sama dengan `Technician.sourceNik`; APPLICATION sama dengan `Technician.nik`; BOTH sama dengan keduanya. |
| `TechnicianIdentityHistory.activeNikKey` | Turunan dari NIK aktif | String nullable, unique, max 64 karakter | NIK persis pada row aktif. | Kolasi case-sensitive yang sama dengan `sourceNik`/`nik`. Aktif: sama dengan NIK pada row, `validTo`/`closedAt` NULL. Tertutup: key NULL. Unique lintas jenis/teknisi; perubahan atomik bersama current fields. |
| `validFrom`, `validTo` | Waktu mulai/akhir berlaku | Timestamp; `validTo` nullable | Interval kapan NIK berlaku. | `validTo >= validFrom`; untuk row tertutup harus sama dengan `closedAt`. |
| `recordedAt` | Waktu pencatatan | Timestamp | Kapan row histori dicatat; bukan waktu mulai berlaku. | Terpisah dari `validFrom`. |
| `closedAt`, `closedByUserId` | Waktu/aktor penutupan | Timestamp nullable; UUID nullable FK | Kapan dan oleh siapa row aktif ditutup. | Untuk row tertutup `closedAt = validTo`; FK RESTRICT. |
| `recordedByUserId`, `recordedBySyncLogId` | User manual atau SyncLog sumber | UUID nullable FK | Audit pencatat. | Tepat satu diisi; ditegakkan CHECK/migration SQL. |
| `changeReason` | Pemeriksaan manual | String nullable | Alasan perubahan atau hasil review. | Tidak menyimpan data sensitif yang tidak diperlukan. |

NIK resmi harus cocok dengan regex ASCII `^[0-9]{4,8}$`. Simpan sebagai
`String`/`VARCHAR(64)`, bukan tipe numerik; jangan trim, konversi angka,
mengubah case, atau menghapus leading zero. Backend memvalidasi sebelum
operasi identitas. Migration menambahkan CHECK MySQL 8.0 pada semua kolom NIK
yang tersimpan untuk pencocokan (termasuk `sourceNik`, `nik`, histori NIK,
`activeNikKey`, NIK konflik, dan NIK sumber pada tiket). Untuk kolom nullable,
CHECK mengizinkan NULL dan memvalidasi nilai non-NULL dengan pola tersebut.
Sebelum menerapkan CHECK ke data lama, audit nilai yang tidak cocok; jangan
memperbaiki atau mengubah NIK yang ada tanpa keputusan manual.

`Technician.sourceNik`, `Technician.nik`, dan
`TechnicianIdentityHistory.activeNikKey` memakai kolasi case-sensitive yang
sama (misalnya `utf8mb4_0900_as_cs`), ditetapkan via migration SQL. Semua
kolom NIK lain yang dipakai untuk pencocokan identitas juga memakai kolasi
case-sensitive. Unique
constraint pada `activeNikKey` mencegah duplikasi lintas identitas
SOURCE/APPLICATION; unique constraint current pada `sourceNik` dan `nik`
mencegah duplikasi dalam masing-masing kolom. Validasi transaksi menjaga
current fields konsisten dengan histori aktif dan memeriksa benturan lintas
kolom sebelum perubahan disimpan.

Untuk row aktif `BOTH`, perubahan `Technician.nik` menutup row BOTH lalu
membuat SOURCE aktif dengan NIK sumber lama dan APPLICATION aktif dengan NIK
baru. Perubahan `Technician.sourceNik` yang telah disetujui menutup row BOTH
lalu membuat APPLICATION aktif dengan NIK aplikasi lama dan SOURCE aktif
dengan NIK sumber baru. Kolom current dan semua row history diperbarui dalam
satu transaksi. Jika nilainya sama kembali, simpan satu row BOTH aktif.

### Histori konflik identitas teknisi

| Field | Sumber | Tipe rancangan | Makna/transformasi | Validasi |
|---|---|---|---|---|
| `TechnicianIdentityConflict.id` | Dibuat aplikasi | UUID String, PK | Identitas event konflik yang immutable untuk sync. | Tidak hard-delete. |
| `ticketIncident` | `Ticket.incident` | String, FK wajib | Tiket tempat NIK tidak dikenal/berkonflik ditemukan. | Tipe, panjang, character set, dan kolasi sama persis dengan `Ticket.incident` agar FK MySQL valid; case-sensitive, FK RESTRICT. |
| `suspectedTechnicianId` | Relasi tiket atau hasil pemeriksaan | UUID nullable, FK | Teknisi yang diduga terkait. | NULL bila belum dapat ditentukan; tidak membuat teknisi duplikat. |
| `resolvedTechnicianId` | Keputusan pemeriksa | UUID nullable, FK | Teknisi yang ditetapkan setelah pemeriksaan manual. | Tidak mengubah `Ticket.technicianId` otomatis; penautan tiket memerlukan tindakan manual eksplisit. |
| Relasi `suspectedTechnician` / `resolvedTechnician` | `TechnicianIdentityConflict` | Relasi Prisma bernama eksplisit | `SuspectedIdentityConflicts` dan `ResolvedIdentityConflict`. | Masing-masing dipasangkan dengan field balik terpisah pada `Technician`; keduanya tidak boleh ambigu. |
| `sourceNik` | `NIK Teknisi` (EM) | String/VARCHAR | NIK yang menimbulkan konflik, disimpan apa adanya. | Tidak ditimpa sync berikutnya. |
| `foundAt`, `detectedBySyncLogId` | SyncLog pendeteksi | Timestamp; UUID FK wajib | Waktu dan proses saat konflik ditemukan. | Unique `(ticketIncident, detectedBySyncLogId)` mencegah duplikasi retry run sama. Deteksi run berbeda disimpan sebagai event terpisah; deduplikasi pekerjaan PENDING berdasarkan `(ticketIncident, sourceNik)` adalah grouping logis antrean, bukan unique constraint, didukung index `(ticketIncident, sourceNik, status)`. Satu keputusan menyelesaikan seluruh grup secara atomik. |
| `status` | Hasil review manual | Enum `PENDING`, `APPROVED`, `REJECTED` | Status resolusi konflik. | Sinkronisasi tidak mengubah status; transisi diputuskan petugas. |
| `reviewedByUserId`, `reviewedAt`, `decisionReason` | Pemeriksa | UUID nullable FK; timestamp; String nullable | Siapa/kapan memeriksa dan alasan keputusan. | Pending belum punya reviewer/waktu/alasan; keputusan final wajib memiliki reviewer, waktu, dan alasan. APPROVED wajib memiliki resolvedTechnicianId. FK RESTRICT. |

## Akun dan permission

| Field/relasi | Sumber | Tipe rancangan | Makna/aturan |
|---|---|---|---|
| `User.id` | Dibuat aplikasi | UUID String, PK | Identitas akun. |
| `User.roleId` | Role aplikasi | UUID String, FK wajib | Tepat satu role utama: `SUPERUSER`, `HELPDESK`, atau `SUPERVISOR`; bukan relasi UserRole. |
| `User.createdByUserId` | Pembuat akun | UUID String, self-FK nullable | Mencatat pembuat; NULL hanya untuk akun SUPERUSER bootstrap. |
| `User.primarySuperuserKey` | Bootstrap | String nullable, unique | Hanya bootstrap menetapkan `PRIMARY`. CHECK membatasi nilai ke NULL/`PRIMARY`; unique nullable membatasi satu marker. Trigger SQL memastikan marker PRIMARY iff role SUPERUSER pada setiap insert/update user, dan perubahan role/marker dilakukan atomik. Role sistem SUPERUSER dilindungi agar tidak diganti nama/dihapus; akses SQL dibatasi dan server memvalidasi setiap perubahan. |
| `User.passwordHash` | Password yang ditetapkan | String NOT NULL untuk login lokal | Hash adaptif saja; password asli tidak disimpan atau dapat dilihat. Jika mekanisme nonlokal dipilih, kebutuhan field perlu ditinjau sebelum schema. |
| `User.isActive` | Pengelolaan akun | Boolean | Akun nonaktif tidak dapat login. |
| `Role.isSystem`, `Permission.isSystem` | Seed sistem | Boolean | Menandai definisi akses yang dilindungi. Role/permission sistem dan mapping role-permission tidak dapat dihapus atau diedit melalui menu biasa. |
| `RolePermission` | Katalog akses | Junction Role-Permission | Permission yang diberikan melalui role; FK RESTRICT, tanpa cascade untuk menghapus histori/definisi sistem. |
| `UserPermission.id` | Dibuat aplikasi | UUID String, PK | Satu catatan grant agar re-grant memiliki rekaman terpisah; tidak dihapus saat revoke. |
| `UserPermission.grantedByUserId`, `grantedAt` | Aktor/waktu grant | UUID FK, timestamp | Siapa dan kapan memberikan permission; aktor dipertahankan oleh FK RESTRICT. |
| `UserPermission.revokedByUserId`, `revokedAt` | Aktor/waktu revoke | UUID nullable FK, timestamp nullable | Siapa dan kapan mencabut grant; revoke memperbarui row menjadi revoked, bukan hard-delete. |
| `UserPermission.activeGrantKey` | Generated column MySQL | Kolom nullable `CHAR(36)`; generated oleh SQL migration | `permissionId` saat aktif, NULL saat revoked. Prisma schema menyertakan kolom sebagai `Unsupported("char(36)")?` dan unique gabungan `(userId,activeGrantKey)` agar kolom/index tetap tercatat untuk Migrate; generated expression hanya ditetapkan SQL. Kolom tidak tersedia di Prisma Client. Inspeksi langsung memakai parameterized `$queryRaw` read-only. |
| `UserPermission` aktif | Hasil evaluasi | Grant dengan `revokedAt = NULL` | Permission langsung efektif; lock user dan cek di server dalam transaksi. Revoke update row aktif; re-grant membuat row baru. |

Semua otorisasi dilakukan di server. SUPERUSER dibuat lewat bootstrap.
Pengelolaan user tidak boleh mengizinkan self-escalation atau pemberian role/
permission SUPERUSER; SUPERUSER hanya dapat mengatur privilege akun yang
dibuatnya sesuai aturan bisnis.

Database enforcement memakai CHECK pada nilai marker, unique nullable
`primarySuperuserKey`, serta BEFORE INSERT/UPDATE trigger pada `users` yang
membandingkan role tujuan dengan marker pada `NEW` dan menolak ketidakcocokan
dengan `SIGNAL`. Role SUPERUSER harus dilindungi dari rename/delete; perubahan
role dan marker harus berada dalam satu update/operasi atomik. DDL trigger,
hak akun database bootstrap, serta pengujian enforcement masih harus dibuat
dan diverifikasi pada MySQL 8.0; CHECK saja tidak dapat memeriksa role di
tabel lain.

Permission administratif tidak boleh memberi kemampuan tidak langsung untuk
menetapkan SUPERUSER atau memodifikasi katalog akses sistem. User hanya
dinonaktifkan, tidak dihapus permanen. Relasi pembuat, pemberi, pencabut,
pemrakarsa, dan pencatat histori memakai RESTRICT agar audit tidak terputus.

## Sinkronisasi dan pencatatan

| Field | Model | Tipe | Makna |
|---|---|---|---|
| `SyncLog.status` | `SyncLog` | Enum | `RUNNING`, `SUCCEEDED`, `PARTIAL`, atau `FAILED`. |
| `inserted`, `updated`, `unchanged`, `skipped`, `failed` | `SyncLog` | Integer nonnegatif | Hasil percobaan terakhir; tanggal pelaporan invalid masuk failed/perlu review, bukan agregat lintas retry. |
| `startedAt`, `finishedAt` | `SyncLog` | Timestamp | Waktu mulai dan selesai; finish nullable selama run berlangsung. |
| `runKey` | `SyncLog` | UUID String, unique | Identitas satu proses logis; retry mempertahankan runKey dan memperbarui record yang sama. |
| `attemptCount`, `lastAttemptAt` | `SyncLog` | Integer; timestamp | Jumlah dan waktu percobaan terakhir; retry menaikkan attemptCount dan memperbarui lastAttemptAt, mengatur status RUNNING, serta mengosongkan finishedAt. |
| `initiatedByUserId` | `SyncLog` | UUID nullable, FK | User pemrakarsa; nullable untuk proses terjadwal. |
| `failureDetails` | `SyncLog` | JSON nullable, maksimum 64 KiB | Hanya nomor baris, kode error, dan informasi teknis tersanitasi; tanpa PII, raw cell, password, token, credential. Batas divalidasi aplikasi. |
| `errorCode`, `errorSummary` | `SyncLog` | String nullable | Ringkasan kegagalan tersanitasi, bukan konten baris sumber. |
| Counter hasil percobaan | `SyncLog` | Integer nonnegatif | `inserted`, `updated`, `unchanged`, `skipped`, dan `failed` mencatat hasil percobaan terakhir, bukan agregat retry; reset saat retry mulai dan diisi kembali setelah percobaan selesai. |
| Batas dan retensi log | `SyncLog` | Batas 64 KiB; retensi 365 hari | Ukuran `failureDetails` divalidasi aplikasi; 365 hari hanya untuk SyncLog tanpa referensi histori. Log yang direferensikan diarsipkan tanpa memutus FK. Histori identitas, konflik, dan grant/revoke tidak dihapus permanen. |

## Konteks audit sumber

Audit baca-saja `MainSheet` menemukan 62 baris data dan 168 header.
`INCIDENT` terisi dan unik pada snapshot audit tersebut; ini bukan jaminan data
masa depan selalu valid. Audit juga menemukan enam header `a` kosong dan 39
header `Column…`; 38 placeholder kosong dan `Column78` terisi. Kolom ambigu
tidak otomatis menjadi field aplikasi hanya karena terisi.

## Hal yang perlu dikonfirmasi

- Kompatibilitas collation `utf8mb4_0900_as_ci`, trim whitespace Unicode, dan
  penerapan unique lookup/upsert pada MySQL/Prisma.
- Uji teknis kolasi NIK case-sensitive yang sama dan CHECK regex
  `^[0-9]{4,8}$` pada kolom NIK, termasuk leading zero, keunikan, serta
  benturan lintas identitas SOURCE/APPLICATION.
- Dukungan definisi Unicode `White_Space` pada runtime pembentuk `incidentMatchKey`
  dan konsistensinya dengan kolasi/database.
- Uji teknis normalisasi `SERVICE TYPE` (trim whitespace tepi,
  case-insensitive, unknown → `UNCLASSIFIED`) dan konsistensi katalog.
- Verifikasi implementasi bahwa fallback `UNCLASSIFIED` dibuat idempotent
  sebelum sync pertama, tidak dapat diduplikasi, dan unknown tidak membuat row
  katalog baru.
- Uji integrasi bahwa setiap perubahan `Ticket.technicianId` pada jalur
  aplikasi menghasilkan tepat satu histori dalam transaksi yang sama; uji
  implementasi MySQL/Prisma belum dilakukan.
- Format tanggal yang benar-benar diterima dari Sheets dan prosedur koreksi
  tanggal invalid/anomali.
- Matriks permission role, katalog permission, mekanisme bootstrap/recovery,
  SSO/MFA, dan invalidasi sesi setelah reset password.
- Kewenangan dan bukti persetujuan untuk penyelesaian konflik `sourceNik`;
  retensi histori identitas/nama teknisi dan prosedur resolusi.
- Representasi `NIK Teknisi` pada Sheets/API agar nol di depan tidak hilang.
- Uji aplikasi untuk batas JSON `failureDetails` 64 KiB dan proses retensi
  SyncLog 365 hari yang hanya menghapus record tanpa referensi; definisi retensi
  untuk log lain tetap perlu keputusan.
- Uji enforcement database/server bahwa marker `PRIMARY` dan role `SUPERUSER`
  selalu cocok dua arah.
- Definisi kandidat tambahan seperti `CUSTOMER ID`, `CUSTOMER NAME`, lokasi,
  kontak, teks bebas, dan `Column78`; minimisasi data pribadi tetap berlaku.
