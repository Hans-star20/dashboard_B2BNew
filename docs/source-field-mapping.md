# Source Field Mapping

Pemetaan rancangan antara `MainSheet` dan model aplikasi. Spreadsheet adalah
sumber **READ-ONLY**. Implementasi pembacaan, validasi, transformasi, dan
penyimpanan dijelaskan pada [google-sheets-sync.md](./google-sheets-sync.md).

## Pemetaan utama

| Posisi | Header sumber persis | Model.field | Tipe rancangan | Transformasi / validasi |
|---|---|---|---|---|
| A | `INCIDENT` | `Ticket.incident`, `Ticket.incidentMatchKey`, `Ticket.incidentSourceRaw` | String | `incident` menyimpan ejaan awal dan dibandingkan case-sensitive; `incidentMatchKey` memangkas karakter Unicode `White_Space` di tepi saja dan dibandingkan case-insensitive; `incidentSourceRaw` menyimpan nilai Sheets terbaru secara utuh. Kosong/duplikat match key gagal/perlu review. |
| K | `STATUS` | `Ticket.sourceStatus`, `Ticket.status`, `Ticket.statusNeedsReview` | String nullable; enum wajib; Boolean | Raw dipertahankan. Setelah trim + uppercase: `CLOSED` → `CLOSED`; `BACKEND`, `MEDIACARE`, `FINALCHECK`, dan nilai non-CLOSED lain → `OPEN`. NULL/kosong → `OPEN` dan `statusNeedsReview = true`; `STATUS FUNGSI` bukan sumber. |
| H | `SERVICE TYPE` | `Ticket.sourceServiceType`, `Ticket.serviceTypeId`, `Ticket.serviceTypeNeedsReview`, `ServiceType.sourceValue`, `ServiceType.sourceValueMatchKey`, `ServiceType.dashboardCategory` | String nullable; FK wajib; Boolean; enum | Raw tidak diubah. Nilai dikenal memakai katalog masing-masing; unknown dan NULL/kosong memakai fallback aktif `UNCLASSIFIED`, tanpa membuat katalog baru. Flag review true untuk unknown/kosong; false untuk nilai dikenal. Match key trim tepi, `utf8mb4_0900_as_ci`, unique. |
| EM | `NIK Teknisi` | `Technician.sourceNik`, `Technician.nik`, `TechnicianIdentityHistory` | `String`/`VARCHAR(64)` nullable | Bukan PK atau tipe numerik. NIK resmi harus cocok `^[0-9]{4,8}$`; validasi backend dan CHECK database. Case-sensitive; simpan persis termasuk leading zero, jangan trim/ubah case. Nilai NIK lama yang tidak cocok tidak boleh diubah otomatis; perlu keputusan manual sebelum constraint migration. NIK valid tidak dikenal masuk review, bukan pembuatan teknisi otomatis. Setelah verifikasi manual, identitas dibuat/diubah atomik. Histori mencatat SOURCE/APPLICATION/BOTH. |
| EM | `NIK Teknisi` | `Ticket.technicianSourceNikRaw`, `Ticket.technicianNeedsReview`, `Ticket.technicianSourceConflict`, `TechnicianIdentityConflict.sourceNik` | `String`/`VARCHAR(64)` nullable; Boolean | Validasi NIK sebelum disimpan, tetap pertahankan ejaan sumber termasuk leading zero. Kolom NIK pencocokan memakai kolasi case-sensitive dan keunikan exact sesuai jenis key. `technicianNeedsReview` berarti NIK kosong/belum terverifikasi; `technicianSourceConflict` berarti NIK berbeda dari SOURCE aktif teknisi yang terhubung. Review tidak mengubah `Ticket.technicianId` atau identitas otomatis. |
| DW | `Nama Teknisi Handle` | `Technician.sourceName`, `Technician.name`, `Technician.nameNeedsReview` | String nullable; Boolean | Nama adalah atribut, bukan key. Variasi nama untuk `sourceNik` sama ditandai; jangan menimpa nama tersimpan secara otomatis. |
| — | UUID internal | `Technician.id`, `Ticket.technicianId` | UUID String; FK nullable | PK internal dan relasi historis; stabil terhadap perubahan NIK aplikasi. Sync tidak menautkan atau mengubah relasi. |
| — | Tindakan manual / persetujuan konflik | `TechnicianIdentityHistory.validFrom`, `validTo`, `recordedAt`, `closedAt`, `recordedByUserId`, `recordedBySyncLogId`, `closedByUserId` | Timestamp; FK user/SyncLog nullable | `validFrom`/`validTo` adalah waktu berlaku; `recordedAt` waktu catatan dibuat; `closedAt` waktu histori ditutup dan harus sama dengan `validTo`. Tepat satu pencatat user atau SyncLog. |
| — | Tindakan manual penautan teknisi | `TicketTechnicianLinkHistory.ticketIncident`, `previousTechnicianId`, `newTechnicianId`, `actionByUserId`, `actionType`, `reason`, `createdAt` | String/UUID FK; enum; timestamp | Satu histori untuk setiap perubahan relasi dalam transaksi yang sama; previous nullable hanya untuk tautan pertama; new technician, aktor, dan alasan wajib. Sync dilarang mengubah relasi. |
| D | `REPORTED DATE` | `Ticket.reportedAt` | Timestamp wajib | Parse berdasarkan format terverifikasi dan zona `Asia/Jakarta`, simpan konsisten sebagai UTC. Kosong/tidak valid → baris gagal/perlu pemeriksaan, bukan tiket produktif. |
| BM | `RESOLVE DATE` | `Ticket.resolvedAt` | Timestamp nullable | Parse sumber Asia/Jakarta dan simpan UTC. Kosong → NULL. Jika lebih awal daripada `reportedAt`, anomali. |
| — | Turunan D dan BM | `resolutionDurationSeconds` | Integer nullable, dihitung saat query | `resolvedAt - reportedAt` dalam detik. NULL bila belum selesai; TTR bukan sumber. |

### Mapping `SERVICE TYPE` final

| Nilai sumber setelah aplikasi trim whitespace awal/akhir dan case-insensitive match | Kategori |
|---|---|
| `ASTINET` | `DATIN` |
| `INTERNET`, `VOICE` | `HSI` |
| `LOC_AP`, `WIFI` | `WIFI` |
| `SITE`, `INTERNET_OLO` | `SQUAT` |
| `METRO-E`, `MM_IPVPN`, `NON_NUMBERING` | `UNCLASSIFIED` |
| Nilai non-kosong lain yang tidak dikenal | `UNCLASSIFIED` |

Nilai `SERVICE TYPE` asli dipertahankan pada `Ticket.sourceServiceType`.
`ServiceType.sourceValue` menyimpan nilai referensi asli; aplikasi membentuk
`sourceValueMatchKey` dengan memangkas whitespace awal/akhir. Database
menggunakan kolasi case-insensitive (misalnya `utf8mb4_0900_as_ci`) dan unique
constraint pada `sourceValueMatchKey`, bukan field raw. Variasi case/spasi tepi
berlaku hanya untuk pencocokan; raw tidak berubah. Nilai non-kosong tak
dikenal masuk `UNCLASSIFIED`. SERVICE TYPE NULL, string kosong, atau
whitespace-only juga diarahkan ke fallback dan menandai
`Ticket.serviceTypeNeedsReview = true`; simpan nilai sumber sebagai NULL,
string kosong, atau whitespace apa adanya di `Ticket.sourceServiceType`.
Jangan hilangkan tiket.

Setiap nilai sumber yang dikenal memakai entri katalog tersendiri, termasuk
`METRO-E`, `MM_IPVPN`, dan `NON_NUMBERING` yang berkategori `UNCLASSIFIED`.
Satu entri fallback berkunci `UNCLASSIFIED` harus di-bootstrap secara
idempotent sebelum sync pertama. Unique constraint pada
`sourceValueMatchKey` dengan kolasi `utf8mb4_0900_as_ci` mencegah duplikasi
sentinel setelah trim key dan pencocokan case-insensitive; fallback harus
tetap aktif dan tidak boleh dihapus. Raw non-kosong yang tidak dikenal maupun
raw NULL/kosong/whitespace menunjuk sentinel tanpa membuat row katalog baru.
Raw tetap persis di `Ticket.sourceServiceType` dan `serviceTypeNeedsReview`
true untuk nilai tersebut. Nilai dikenal memakai katalog masing-masing dan
flag false. Nilai baru yang disetujui untuk mapping diproses lewat perubahan
katalog terkontrol dan tidak mengubah raw.

Rancangan bootstrap idempotent: dalam transaksi insert nilai fallback kanonis
dengan `sourceValueMatchKey` unik sebagai conflict key; setelah insert/upsert,
baca row tersebut dengan lock dan verifikasi bahwa source value dan key tepat
`UNCLASSIFIED`, category `UNCLASSIFIED`, serta aktif. Jika row bertabrakan
secara case-insensitive tetapi nilainya berbeda atau tidak aktif, rollback dan
minta keputusan manual, jangan mengubahnya diam-diam. Bootstrap belum
dijalankan ke database.

## Pencocokan INCIDENT

`Ticket.incident` mempertahankan identifier sumber pada saat tiket pertama
dibuat; `incidentSourceRaw` menyimpan nilai sumber asli terkini tanpa
normalisasi. `incidentMatchKey` memangkas karakter Unicode `White_Space` di
awal/akhir saja; whitespace internal, tanda baca, dan representasi Unicode
lainnya tidak diubah. Perbandingan case-insensitive dilakukan melalui kolasi
`utf8mb4_0900_as_ci` setelah kompatibilitas diverifikasi. `incident` memakai
kolasi case-sensitive seperti `utf8mb4_0900_as_cs`. Kedua kolasi harus
ditetapkan melalui migration SQL dan diuji pada MySQL 8.0 serta Prisma
lookup/upsert.
Jangan menulis comparison key kembali ke kolom raw. Variasi case/whitespace
tepi mengarah ke satu tiket dan upsert memakai `incidentMatchKey`.

## Rekonsiliasi teknisi

Tiket merujuk `Technician.id`, bukan NIK. `nik` aplikasi dapat diedit manual
dan tidak ditimpa sync. Sinkronisasi tidak pernah auto-link tiket dengan
`technicianId = NULL`, termasuk ketika NIK cocok dengan `sourceNik` teknisi
yang diketahui. Relasi yang telah ada selalu dipertahankan. Bila NIK sumber
berubah untuk teknisi yang telah terhubung, simpan nilai masuk pada
`Ticket.technicianSourceNikRaw`, aktifkan `technicianSourceConflict` dan
`technicianNeedsReview`, dan tunggu pemeriksaan manual; jangan relink otomatis.
Jika NIK masuk cocok dengan teknisi lain selain yang telah terhubung, catat
konflik dan jangan mengganti `Ticket.technicianId`. Jika tiket belum tertaut,
tetap jangan auto-link walaupun NIK cocok dengan teknisi yang diketahui;
masukkan kandidat untuk keputusan manual. Semua penautan/pergantian/koreksi
relasi dilakukan manual melalui satu service transaksi dan dicatat pada
`TicketTechnicianLinkHistory`. Konflik tidak dengan sendirinya mengubah
identitas atau relasi. Nama sumber berbeda
mengaktifkan `nameNeedsReview`; jangan menimpa `Technician.name`.
Teknisi nonaktif tetap terhubung untuk laporan histori.

Setiap perubahan `Ticket.technicianId` memperbarui tiket dan membuat tepat satu
histori dalam transaksi database yang sama. Service mengunci tiket dan
mengambil teknisi sebelumnya dari record aktual, memvalidasi user, teknisi
tujuan, alasan, dan action type, lalu melakukan update + insert histori dalam
transaksi interaktif Prisma. Kegagalan apa pun membatalkan keduanya. Saat
penyelesaian konflik juga mengubah tautan, perubahan keputusan konflik,
relasi, dan histori terjadi atomik dengan action `CONFLICT_RESOLUTION`;
penyelesaian konflik identitas sendiri tidak auto-link tiket.

Enum tindakan adalah `MANUAL_LINK` (tautan pertama/pergantian manual biasa),
`CONFLICT_RESOLUTION` (perubahan tautan sebagai hasil keputusan konflik), dan
`CORRECTION` (perbaikan relasi yang keliru).
`previousTechnicianId` NULL hanya pada penautan pertama; `newTechnicianId`,
`actionByUserId`, dan alasan nonkosong wajib. Seluruh FK RESTRICT. Trigger
database tidak diasumsikan/digunakan; direct SQL di luar service masih dapat
melewati audit dan harus dicegah melalui pembatasan akses tulis. Unlink ke
NULL tidak didukung karena teknisi baru wajib valid. Histori tidak dihapus
oleh sync atau penonaktifan teknisi.

NIK kosong tidak membuat teknisi anonim: `technicianId = NULL`, dan baris tiket
yang valid tetap dapat disimpan dengan penanda pemeriksaan. NIK sumber/nilai
aplikasi bertipe String/VARCHAR(64), bukan numerik, agar nol di depan serta
ejaan persis tetap terjaga. Format perusahaan adalah 4-8 digit ASCII
(`^[0-9]{4,8}$`); backend memvalidasi sebelum pencocokan atau perubahan, dan
CHECK MySQL 8.0 menegakkannya pada kolom NIK tersimpan. `sourceNik`, `nik`,
`TechnicianIdentityHistory.nik`, `activeNikKey`, dan kolom NIK tiket/konflik
yang digunakan untuk pencocokan memakai kolasi case-sensitive yang konsisten.
Nilai unik dibandingkan exact, dengan benturan diperiksa lintas SOURCE dan
APPLICATION; unique pada setiap kolom current saja tidak cukup. Sebelum
menambah CHECK ke data lama, audit nilai yang tidak cocok dan selesaikan
secara manual; jangan melakukan normalisasi atau penggantian nilai otomatis.

`technicianNeedsReview` menyatakan bahwa NIK kosong atau belum diverifikasi
sehingga keterkaitan teknisi belum dipastikan. `technicianSourceConflict`
menyatakan NIK sumber berbeda dari identitas SOURCE aktif teknisi yang telah
terhubung. Menyelesaikan conflict tidak otomatis mengganti `Ticket.technicianId`;
perubahan identitas dan penautan tiket dilakukan manual sesuai keputusan
pemeriksa.

NIK valid yang belum ditemukan pada `sourceNik` tidak langsung membuat
Technician. Buat conflict PENDING untuk review. Petugas memutuskan apakah
teknisi baru atau perubahan identitas lama; pembuatan/perubahan dilakukan
manual dan atomik, setelah memeriksa keunikan NIK aktif. Tiket tanpa
`technicianId` tetap belum tertaut selama pemeriksaan dan memerlukan tindakan
manual eksplisit untuk ditautkan kemudian. Tiket historis tidak dihubungkan
ulang otomatis.

Jika `identityKind = BOTH` berubah:

- NIK aplikasi berubah: tutup BOTH lama; buat SOURCE aktif dengan NIK sumber
  lama dan APPLICATION aktif dengan NIK aplikasi baru.
- NIK sumber berubah setelah persetujuan: tutup BOTH lama; buat APPLICATION
  aktif dengan NIK aplikasi lama dan SOURCE aktif dengan NIK sumber baru.

Update `Technician.sourceNik`, `Technician.nik`, serta penutupan/pembuatan
histori dilakukan atomik. Jika nilai keduanya kembali sama, gabungkan menjadi
satu BOTH aktif. `validFrom`/`validTo` menyatakan masa berlaku; `recordedAt`
adalah waktu pencatatan; `closedAt` harus sama dengan `validTo`. Row aktif
memiliki `validTo`, `closedAt` NULL dan `activeNikKey = nik`; row tertutup
memiliki kedua waktu penutupan dan `activeNikKey` NULL. `validTo >= validFrom`.
Tepat satu dari `recordedByUserId` atau `recordedBySyncLogId` diisi. Unique
`activeNikKey` melindungi kepemilikan aktif lintas jenis/teknisi.

### Riwayat konflik identitas

`TechnicianIdentityConflict` menyimpan `ticketIncident`,
`suspectedTechnicianId` nullable, `resolvedTechnicianId` nullable, `sourceNik`,
`foundAt`, status `PENDING`/`APPROVED`/`REJECTED`, `detectedBySyncLogId`,
`reviewedByUserId`, `reviewedAt`, dan `decisionReason`. Kandidat dugaan tidak
ditimpa oleh teknisi hasil keputusan. `APPROVED` mengisi teknisi yang
ditetapkan; `REJECTED` tidak mengubah identitas aktif. Setiap tiket/run
tercatat sekali; sync berikutnya tidak menimpa status atau detail review. Row
tidak hard-delete; FK menggunakan RESTRICT.
`ticketIncident` memakai tipe, panjang, character set, dan kolasi yang sama
dengan `Ticket.incident` (case-sensitive) untuk kompatibilitas FK MySQL.

Jika konflik PENDING yang sama ditemukan di run berbeda, setiap deteksi
disimpan sebagai event terpisah. Antrean mengelompokkan event PENDING dengan
`(ticketIncident, sourceNik)` yang sama (NIK case-sensitive) sebagai satu
pekerjaan. Satu keputusan manual menyelesaikan seluruh event PENDING grup itu
secara atomik; temuan setelah grup selesai dapat menjadi pekerjaan baru.
Pengelompokan adalah deduplikasi logis query antrean, bukan unique constraint;
unique database tetap pada pasangan `(ticketIncident, detectedBySyncLogId)`.

## Field yang bukan sumber utama dashboard

| Posisi | Header | Perlakuan |
|---|---|---|
| FI | `STATUS FUNGSI` | Tidak digunakan sebagai sumber status dashboard. |
| BL | `GUARANTE STATUS` | Kolom berbeda; bukan sumber status dashboard. |
| B | `TTR CUSTOMER` | Tidak digunakan untuk durasi dashboard. |
| BD | `TTR AGENT` | Tidak digunakan untuk durasi dashboard. |
| BE | `TTR MITRA` | Tidak digunakan untuk durasi dashboard. |
| BF | `TTR NASIONAL` | Tidak digunakan untuk durasi dashboard. |
| BG | `TTR PENDING` | Tidak digunakan untuk durasi dashboard. |
| BH | `TTR REGION` | Tidak digunakan untuk durasi dashboard. |
| BI | `TTR WITEL` | Tidak digunakan untuk durasi dashboard. |
| BJ | `TTR END TO END` | Tidak digunakan untuk durasi dashboard. |
| EI | `TTR REALTIME` | Tidak digunakan untuk durasi dashboard. |
| FJ | `TTR CUST` | Tidak digunakan untuk durasi dashboard. |

## Kandidat tambahan — perlu persetujuan

| Posisi | Header | Temuan audit / catatan |
|---|---|---|
| M | `TICKET ID GAMAS` | Identifier; 1/62 terisi. Hubungan ke `INCIDENT` belum dipastikan. |
| U | `SOURCE TICKET` | 62/62 terisi; domain belum dikonfirmasi. |
| W | `EXTERNAL TICKET ID` | 36/62 terisi; sistem asal dan uniqueness belum dikonfirmasi. |
| AB | `CUSTOMER ID` | 59/62 terisi; data sensitif, belum masuk rancangan inti. |
| AC | `CUSTOMER NAME` | 62/62 terisi; PII, tidak masuk rancangan inti. |
| AD | `SERVICE ID` | 62/62 terisi; definisi/relasi belum dikonfirmasi. |
| AE | `SERVICE NO` | 62/62 terisi; definisi belum dikonfirmasi. |
| I | `WITEL` | 62/62 terisi; dimensi lokasi potensial, definisi perlu konfirmasi. |
| J | `WORKZONE` | 62/62 terisi; definisi perlu konfirmasi. |
| AN | `REGION` | 62/62 terisi; hierarki lokasi perlu konfirmasi. |
| DU | `BRANCH` | 62/62 terisi; definisi dan relasi perlu konfirmasi. |
| DV | `SERVICE AREA` | 62/62 terisi; definisi perlu konfirmasi. |
| FF | `STO` | 62/62 terisi; hierarki perlu konfirmasi. |
| F | `OWNER` | 7/62 terisi; identitas/peran perlu konfirmasi. |
| AU | `TECHNICIAN` | 53/62 terisi; jangan anggap identik dengan `NIK Teknisi`. |
| BQ | `IMPACTED SITE` | 8/62 terisi; kemungkinan teks/lokasi sensitif. |
| DX | `Column78` | 62/62 terisi; placeholder, arti belum diketahui. |

Kontak pelanggan, serial perangkat, lokasi rinci, Telegram ID, dan narasi bebas
tidak masuk rancangan inti tanpa kebutuhan, minimisasi, dan kontrol akses yang
disetujui. Audit juga menemukan enam header `a` kosong dan 38 placeholder
`Column…` kosong; jangan memberi makna pada placeholder tanpa konfirmasi.
