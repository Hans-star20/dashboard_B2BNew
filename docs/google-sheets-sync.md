# Google Sheets Ticket Sync

Sinkronisasi manual membaca seluruh tab `MainSheet` dari spreadsheet
`TIF BGES DISTRIC BEKASI` dengan scope OAuth read-only. Nilai tiket dan hasil
validasi tidak dikirim ke browser; antarmuka hanya menerima status dan
ringkasan jumlah.

## Konfigurasi dan akses

Server harus memiliki `GOOGLE_SHEETS_SPREADSHEET_ID`,
`GOOGLE_SERVICE_ACCOUNT_EMAIL`, dan `GOOGLE_PRIVATE_KEY` serta `DATABASE_URL`.
Kredensial Google tidak memakai awalan `NEXT_PUBLIC_`. Route
`/api/sheets-sync` memeriksa sesi dan permission `tickets.sync` di server.
Migration menambahkan definisi permission dan hanya mengaitkannya dengan role
`SUPERUSER` kanonis yang sudah ada; role lain tidak memperoleh akses otomatis.

## Proses

- `GET /api/sheets-sync` mengembalikan log terakhir hanya untuk pemegang
  permission.
- `POST /api/sheets-sync` memeriksa origin, sesi, dan permission, lalu membaca
  sheet dan memvalidasi header wajib beserta setiap baris sebelum transaksi
  tiket dimulai.
- Sync memakai upsert `incidentMatchKey`, tidak menghapus tiket yang hilang
  dari snapshot, dan menulis `lastSeenAt` hanya sesudah pembacaan sheet lengkap.
- Penulisan tiket, konflik identitas, katalog layanan statis, dan hasil
  `SyncLog` dilakukan dalam transaksi Prisma. Kegagalan transaksi membatalkan
  seluruh perubahan tiket.
- Kegagalan autentikasi/pembacaan sumber hanya memperbarui log kegagalan dan
  tidak mengubah tiket.
- `rowsRead` menghitung baris berisi setelah header. Jumlah diproses adalah
  `inserted + updated + unchanged`; baris validasi dicatat sebagai `skipped`,
  sedangkan kegagalan transaksi dicatat sebagai `failed`.
- Detail validasi hanya menyimpan nomor baris dan kode kesalahan, bukan nilai
  sel, NIK, token, private key, atau payload Google.

Tanggal serial Google Sheets dan teks tanggal ISO atau `d/M/yyyy` dibaca
sebagai waktu Asia/Jakarta dan disimpan sebagai UTC. `RESOLVE DATE` kosong
disimpan NULL; durasi resolusi diturunkan dari `resolvedAt - reportedAt` dan
NULL ketika belum selesai.

Permission `tickets.sync` dapat diberikan secara eksplisit oleh Superuser
utama melalui pengelolaan permission akun, selain grant role `SUPERUSER`.
Jalankan migration baru dengan `npx prisma migrate deploy` sebelum memakai
endpoint.
